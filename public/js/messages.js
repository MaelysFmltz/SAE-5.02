/**
 * Logique front-end de la page de conversation (views/conversation.ejs) :
 * envoi d'un message, réception (polling), marquage en lu, ajout de
 * participants à une conversation de groupe.
 */
(function () {
  'use strict';

  const scriptTag = document.currentScript;
  const idConversation = Number(scriptTag.dataset.conversationId);
  const estGroupe = scriptTag.dataset.isGroup === 'true';
  const idUserCourant = Number(scriptTag.dataset.userId);

  const chatMessages = document.getElementById('chat-messages');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const btnGroupMembers = document.getElementById('btn-group-members');
  const headerTitle = document.querySelector('.header-title');

  const POLL_INTERVAL_MS = 3000;

  function formatHeure(dateEnvoi) {
    return new Date(dateEnvoi).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function idsDejaAffiches() {
    const ids = new Set();
    chatMessages.querySelectorAll('.bubble[data-id]').forEach((el) => {
      ids.add(Number(el.dataset.id));
    });
    return ids;
  }

  /**
   * Construit une bulle de message en DOM pur (textContent), jamais via
   * innerHTML, pour ne jamais interpréter le contenu d'un message comme
   * du HTML.
   */
  function creerBulle(message) {
    const bulle = document.createElement('div');
    bulle.className = 'bubble ' + (message.idUser === idUserCourant ? 'mine' : 'theirs');
    bulle.dataset.id = String(message.idMessage);

    const texte = document.createTextNode(message.contenu);
    bulle.appendChild(texte);

    const meta = document.createElement('div');
    meta.className = 'bubble-meta';
    meta.textContent = formatHeure(message.dateEnvoi);
    bulle.appendChild(meta);

    return bulle;
  }

  async function chargerNouveauxMessages() {
    let messages;

    try {
      const res = await fetch(`/api/conversations/${idConversation}/messages`);

      if (!res.ok) {
        return;
      }

      messages = await res.json();
    } catch (err) {
      console.error('Erreur de récupération des messages :', err);
      return;
    }

    if (!Array.isArray(messages)) {
      return;
    }

    const dejaAffiches = idsDejaAffiches();
    let aRecuNouveauxMessages = false;

    messages.forEach((message) => {
      if (dejaAffiches.has(message.idMessage)) {
        return;
      }

      chatMessages.appendChild(creerBulle(message));
      aRecuNouveauxMessages = true;
    });

    if (aRecuNouveauxMessages) {
      scrollToBottom();

      fetch(`/api/conversations/${idConversation}/read`, {
        method: 'PUT'
      }).catch(() => {});
    }
  }

  chatForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const contenu = chatInput.value.trim();

    if (contenu.length === 0) {
      return;
    }

    const submitBtn = chatForm.querySelector('.chat-send-btn');
    submitBtn.disabled = true;

    try {
      const res = await fetch(`/api/conversations/${idConversation}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenu })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Impossible d’envoyer le message.');
        return;
      }

      chatMessages.appendChild(creerBulle(data));
      chatInput.value = '';
      scrollToBottom();
    } catch (err) {
      console.error('Erreur envoi message :', err);
      alert('Erreur réseau lors de l’envoi du message.');
    } finally {
      submitBtn.disabled = false;
      chatInput.focus();
    }
  });

  scrollToBottom();
  setInterval(chargerNouveauxMessages, POLL_INTERVAL_MS);

  // ============================================================
  // GESTION DU GROUPE (membres, ajout/retrait, renommage)
  // ============================================================

  if (estGroupe && btnGroupMembers) {
    btnGroupMembers.addEventListener('click', async () => {
      let membres;

      try {
        const res = await fetch(`/api/conversations/${idConversation}/members`);

        if (!res.ok) {
          alert('Impossible de récupérer les membres du groupe.');
          return;
        }

        const data = await res.json();
        membres = data.membres || [];
      } catch (err) {
        console.error('Erreur récupération membres :', err);
        alert('Erreur réseau lors de la récupération des membres.');
        return;
      }

      ouvrirGestionGroupe(membres);
    });
  }

  function creerOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'add-participant-overlay';

    const panel = document.createElement('div');
    panel.className = 'add-participant-panel';
    overlay.appendChild(panel);

    document.body.appendChild(overlay);

    return { overlay, panel };
  }

  async function ouvrirGestionGroupe(membres) {
    const estCreateurCourant = membres.some(
      (m) => m.idUser === idUserCourant && !!m.estCreateur
    );

    const { overlay, panel } = creerOverlay();

    const titre = document.createElement('h2');
    titre.textContent = 'Membres du groupe';
    panel.appendChild(titre);

    const liste = document.createElement('div');
    liste.className = 'add-participant-list';

    membres.forEach((membre) => {
      const ligne = document.createElement('div');
      ligne.className = 'group-member-row';

      const pseudo = document.createElement('span');
      pseudo.textContent = (membre.estCreateur ? '👑 ' : '') + '@' + membre.pseudo;
      ligne.appendChild(pseudo);

      if (estCreateurCourant && membre.idUser !== idUserCourant) {
        const btnRetirer = document.createElement('button');
        btnRetirer.type = 'button';
        btnRetirer.className = 'btn-remove-member';
        btnRetirer.textContent = 'Retirer';
        btnRetirer.addEventListener('click', async () => {
          if (!confirm(`Retirer @${membre.pseudo} du groupe ?`)) {
            return;
          }

          btnRetirer.disabled = true;

          try {
            const res = await fetch(
              `/api/conversations/${idConversation}/members/${membre.idUser}`,
              { method: 'DELETE' }
            );

            const data = await res.json();

            if (!res.ok) {
              alert(data.error || 'Impossible de retirer ce membre.');
              btnRetirer.disabled = false;
              return;
            }

            overlay.remove();
            window.location.reload();
          } catch (err) {
            console.error('Erreur retrait membre :', err);
            alert('Erreur réseau lors du retrait du membre.');
            btnRetirer.disabled = false;
          }
        });

        ligne.appendChild(btnRetirer);
      }

      liste.appendChild(ligne);
    });

    panel.appendChild(liste);

    if (estCreateurCourant) {
      panel.appendChild(document.createElement('hr'));
      await ajouterSectionAjoutParticipants(panel, membres);

      panel.appendChild(document.createElement('hr'));
      ajouterSectionRenommage(panel, overlay);
    }

    const actions = document.createElement('div');
    actions.className = 'add-participant-actions';

    const btnFermer = document.createElement('button');
    btnFermer.type = 'button';
    btnFermer.className = 'btn-secondary';
    btnFermer.textContent = 'Fermer';
    btnFermer.addEventListener('click', () => overlay.remove());

    actions.appendChild(btnFermer);
    panel.appendChild(actions);
  }

  async function ajouterSectionAjoutParticipants(panel, membresActuels) {
    const sousTitre = document.createElement('h3');
    sousTitre.textContent = 'Ajouter des amis';
    panel.appendChild(sousTitre);

    let amis;

    try {
      const res = await fetch(`/api/friendships/${idUserCourant}/amis`);
      const data = res.ok ? await res.json() : [];
      amis = Array.isArray(data) ? data : (data.amis || []);
    } catch (err) {
      console.error('Erreur récupération amis :', err);
      amis = [];
    }

    const idsActuels = new Set(membresActuels.map((m) => m.idUser));
    const amisDisponibles = amis.filter((ami) => !idsActuels.has(ami.idUser));

    if (amisDisponibles.length === 0) {
      const vide = document.createElement('p');
      vide.className = 'empty-conversations';
      vide.textContent = 'Tous vos amis sont déjà dans ce groupe.';
      panel.appendChild(vide);
      return;
    }

    const liste = document.createElement('div');
    liste.className = 'add-participant-list';

    amisDisponibles.forEach((ami) => {
      const label = document.createElement('label');
      label.className = 'add-participant-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = String(ami.idUser);

      const pseudo = document.createElement('span');
      pseudo.textContent = '@' + ami.pseudo;

      label.appendChild(checkbox);
      label.appendChild(pseudo);
      liste.appendChild(label);
    });

    panel.appendChild(liste);

    const btnAjouter = document.createElement('button');
    btnAjouter.type = 'button';
    btnAjouter.className = 'btn-primary';
    btnAjouter.textContent = 'Ajouter au groupe';
    btnAjouter.addEventListener('click', async () => {
      const idsSelectionnes = Array.from(
        liste.querySelectorAll('input[type="checkbox"]:checked')
      ).map((el) => Number(el.value));

      if (idsSelectionnes.length === 0) {
        alert('Sélectionnez au moins un ami à ajouter.');
        return;
      }

      btnAjouter.disabled = true;

      try {
        const res = await fetch(`/api/conversations/${idConversation}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idUsers: idsSelectionnes })
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.error || 'Impossible d’ajouter ces participants.');
          return;
        }

        window.location.reload();
      } catch (err) {
        console.error('Erreur ajout participants :', err);
        alert('Erreur réseau lors de l’ajout des participants.');
      } finally {
        btnAjouter.disabled = false;
      }
    });

    panel.appendChild(btnAjouter);
  }

  function ajouterSectionRenommage(panel, overlay) {
    const sousTitre = document.createElement('h3');
    sousTitre.textContent = 'Renommer le groupe';
    panel.appendChild(sousTitre);

    const inputTitre = document.createElement('input');
    inputTitre.type = 'text';
    inputTitre.className = 'group-title-input';
    inputTitre.maxLength = 100;
    inputTitre.value = scriptTag.dataset.titreGroupe || '';
    panel.appendChild(inputTitre);

    const btnRenommer = document.createElement('button');
    btnRenommer.type = 'button';
    btnRenommer.className = 'btn-primary';
    btnRenommer.textContent = 'Renommer';
    btnRenommer.addEventListener('click', async () => {
      const nouveauTitre = inputTitre.value.trim();

      if (nouveauTitre.length === 0) {
        alert('Le nom du groupe ne peut pas être vide.');
        return;
      }

      btnRenommer.disabled = true;

      try {
        const res = await fetch(`/api/conversations/${idConversation}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titreGroupe: nouveauTitre })
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.error || 'Impossible de renommer le groupe.');
          return;
        }

        if (headerTitle) {
          headerTitle.textContent = data.titreGroupe;
        }

        document.title = data.titreGroupe + ' — Pixora';
        overlay.remove();
      } catch (err) {
        console.error('Erreur renommage groupe :', err);
        alert('Erreur réseau lors du renommage du groupe.');
      } finally {
        btnRenommer.disabled = false;
      }
    });

    panel.appendChild(btnRenommer);
  }
})();
