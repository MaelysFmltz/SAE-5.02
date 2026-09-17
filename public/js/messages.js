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
  const estCreateurCourant = scriptTag.dataset.estCreateur === 'true';

  const chatMessages = document.getElementById('chat-messages');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const btnGroupMembers = document.getElementById('btn-group-members');
  const btnDeleteConversation = document.getElementById('btn-delete-conversation');
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

  // Icônes SVG statiques (jamais de contenu utilisateur ici, donc innerHTML
  // est sans risque) pour les actions sur les bulles de message, dans le
  // même style "feather" que les icônes déjà utilisées dans le header.
  const ICONES_SVG = {
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
  };

  function creerBoutonIcone(nomIcone, titre) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'bubble-action';
    bouton.title = titre;
    bouton.innerHTML = ICONES_SVG[nomIcone];
    return bouton;
  }

  function bullesAffichees() {
    const map = new Map();
    chatMessages.querySelectorAll('.bubble[data-id]').forEach((el) => {
      map.set(Number(el.dataset.id), el);
    });
    return map;
  }

  /**
   * Construit une bulle de message en DOM pur (textContent), jamais via
   * innerHTML, pour ne jamais interpréter le contenu d'un message comme
   * du HTML. Affiche "modifié" si le message a été édité, ou un texte de
   * substitution s'il a été supprimé (trace, comme WhatsApp).
   */
  function creerBulle(message) {
    const bulle = document.createElement('div');
    const estAMoi = message.idUser === idUserCourant;
    bulle.className = 'bubble ' + (estAMoi ? 'mine' : 'theirs') + (message.supprime ? ' deleted' : '');
    bulle.dataset.id = String(message.idMessage);

    if (message.supprime) {
      const texteSupprime = document.createElement('span');
      texteSupprime.className = 'bubble-deleted-text';
      texteSupprime.textContent = 'Ce message a été supprimé';
      bulle.appendChild(texteSupprime);

      const meta = document.createElement('div');
      meta.className = 'bubble-meta';
      meta.textContent = formatHeure(message.dateEnvoi);
      bulle.appendChild(meta);

      return bulle;
    }

    const texte = document.createElement('span');
    texte.className = 'bubble-text';
    texte.textContent = message.contenu;
    bulle.appendChild(texte);

    const meta = document.createElement('div');
    meta.className = 'bubble-meta';
    meta.textContent = formatHeure(message.dateEnvoi) + (message.dateModification ? ' · modifié' : '');
    bulle.appendChild(meta);

    // Chacun peut modifier/supprimer ses propres messages ; le chef d'un
    // groupe peut en plus supprimer (modération) les messages des autres.
    const peutModifier = estAMoi;
    const peutSupprimer = estAMoi || (estGroupe && estCreateurCourant);

    if (peutModifier || peutSupprimer) {
      const actions = document.createElement('div');
      actions.className = 'bubble-actions';

      if (peutModifier) {
        const btnEdit = creerBoutonIcone('edit', 'Modifier');
        btnEdit.addEventListener('click', () => activerEditionMessage(bulle, message));
        actions.appendChild(btnEdit);
      }

      if (peutSupprimer) {
        const btnDelete = creerBoutonIcone('trash', 'Supprimer');
        btnDelete.addEventListener('click', () => supprimerMessage(message, bulle));
        actions.appendChild(btnDelete);
      }

      bulle.appendChild(actions);
    }

    return bulle;
  }

  /**
   * Remplace le texte d'une bulle par un champ d'édition. La bulle est
   * marquée "editing" pour que le polling ne l'écrase pas pendant la saisie.
   */
  function activerEditionMessage(bulle, message) {
    if (bulle.classList.contains('editing')) {
      return;
    }

    bulle.classList.add('editing');
    bulle.innerHTML = '';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'bubble-edit-input';
    input.maxLength = 2000;
    input.value = message.contenu;
    bulle.appendChild(input);

    const controles = document.createElement('div');
    controles.className = 'bubble-edit-controls';

    const btnAnnuler = creerBoutonIcone('cross', 'Annuler');
    btnAnnuler.addEventListener('click', () => bulle.replaceWith(creerBulle(message)));

    const btnValider = creerBoutonIcone('check', 'Valider');
    btnValider.addEventListener('click', () => validerEditionMessage(bulle, message, input, btnValider));

    controles.appendChild(btnAnnuler);
    controles.appendChild(btnValider);
    bulle.appendChild(controles);

    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        btnValider.click();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        btnAnnuler.click();
      }
    });
  }

  async function validerEditionMessage(bulle, message, input, btnValider) {
    const nouveauContenu = input.value.trim();

    if (nouveauContenu.length === 0) {
      alert('Le message ne peut pas être vide.');
      return;
    }

    btnValider.disabled = true;

    try {
      const res = await fetch(`/api/conversations/${idConversation}/messages/${message.idMessage}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenu: nouveauContenu })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Impossible de modifier le message.');
        btnValider.disabled = false;
        return;
      }

      bulle.replaceWith(creerBulle(data));
    } catch (err) {
      console.error('Erreur modification message :', err);
      alert('Erreur réseau lors de la modification du message.');
      btnValider.disabled = false;
    }
  }

  async function supprimerMessage(message, bulle) {
    if (!confirm('Supprimer ce message ?')) {
      return;
    }

    try {
      const res = await fetch(`/api/conversations/${idConversation}/messages/${message.idMessage}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Impossible de supprimer ce message.');
        return;
      }

      bulle.replaceWith(creerBulle(data));
    } catch (err) {
      console.error('Erreur suppression message :', err);
      alert('Erreur réseau lors de la suppression du message.');
    }
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

    const affichees = bullesAffichees();
    let aRecuNouveauxMessages = false;

    messages.forEach((message) => {
      const existante = affichees.get(message.idMessage);

      if (existante) {
        // Ne pas écraser une bulle en cours d'édition par l'utilisateur
        if (!existante.classList.contains('editing')) {
          existante.replaceWith(creerBulle(message));
        }
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
  // Enrichit immédiatement les bulles rendues côté serveur (boutons
  // modifier/supprimer) au lieu d'attendre le premier polling.
  chargerNouveauxMessages();
  setInterval(chargerNouveauxMessages, POLL_INTERVAL_MS);

  // ============================================================
  // SUPPRESSION D'UNE CONVERSATION DIRECTE
  // ============================================================

  if (!estGroupe && btnDeleteConversation) {
    btnDeleteConversation.addEventListener('click', async () => {
      if (!confirm('Supprimer cette conversation ? Elle sera supprimée pour vous et pour l’autre personne.')) {
        return;
      }

      btnDeleteConversation.disabled = true;

      try {
        const res = await fetch(`/api/conversations/${idConversation}`, { method: 'DELETE' });
        const data = await res.json();

        if (!res.ok) {
          alert(data.error || 'Impossible de supprimer la conversation.');
          btnDeleteConversation.disabled = false;
          return;
        }

        window.location.href = '/messages';
      } catch (err) {
        console.error('Erreur suppression conversation :', err);
        alert('Erreur réseau lors de la suppression de la conversation.');
        btnDeleteConversation.disabled = false;
      }
    });
  }

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

    if (estCreateurCourant) {
      const btnSupprimerGroupe = document.createElement('button');
      btnSupprimerGroupe.type = 'button';
      btnSupprimerGroupe.className = 'btn-remove-member';
      btnSupprimerGroupe.textContent = 'Supprimer le groupe';
      btnSupprimerGroupe.addEventListener('click', async () => {
        if (!confirm('Supprimer ce groupe pour tout le monde ? Cette action est irréversible.')) {
          return;
        }

        btnSupprimerGroupe.disabled = true;

        try {
          const res = await fetch(`/api/conversations/${idConversation}`, { method: 'DELETE' });
          const data = await res.json();

          if (!res.ok) {
            alert(data.error || 'Impossible de supprimer le groupe.');
            btnSupprimerGroupe.disabled = false;
            return;
          }

          window.location.href = '/messages';
        } catch (err) {
          console.error('Erreur suppression groupe :', err);
          alert('Erreur réseau lors de la suppression du groupe.');
          btnSupprimerGroupe.disabled = false;
        }
      });

      actions.appendChild(btnSupprimerGroupe);
    } else {
      const btnQuitter = document.createElement('button');
      btnQuitter.type = 'button';
      btnQuitter.className = 'btn-remove-member';
      btnQuitter.textContent = 'Quitter le groupe';
      btnQuitter.addEventListener('click', async () => {
        if (!confirm('Quitter ce groupe ?')) {
          return;
        }

        btnQuitter.disabled = true;

        try {
          const res = await fetch(`/api/conversations/${idConversation}/leave`, { method: 'POST' });
          const data = await res.json();

          if (!res.ok) {
            alert(data.error || 'Impossible de quitter le groupe.');
            btnQuitter.disabled = false;
            return;
          }

          window.location.href = '/messages';
        } catch (err) {
          console.error('Erreur pour quitter le groupe :', err);
          alert('Erreur réseau lors de la sortie du groupe.');
          btnQuitter.disabled = false;
        }
      });

      actions.appendChild(btnQuitter);
    }

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
