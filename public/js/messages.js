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
  const btnAddParticipant = document.getElementById('btn-add-participant');

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
  // AJOUT DE PARTICIPANTS (conversations de groupe uniquement)
  // ============================================================

  if (estGroupe && btnAddParticipant) {
    btnAddParticipant.addEventListener('click', async () => {
      let amis;

      try {
        const res = await fetch(`/api/friendships/${idUserCourant}/amis`);

        if (!res.ok) {
          alert('Impossible de récupérer votre liste d’amis.');
          return;
        }

        const data = await res.json();
        amis = Array.isArray(data) ? data : (data.amis || []);
      } catch (err) {
        console.error('Erreur récupération amis :', err);
        alert('Erreur réseau lors de la récupération de vos amis.');
        return;
      }

      if (amis.length === 0) {
        alert('Vous n’avez aucun ami à ajouter à cette conversation.');
        return;
      }

      ouvrirSelectionAmis(amis);
    });
  }

  function ouvrirSelectionAmis(amis) {
    const overlay = document.createElement('div');
    overlay.className = 'add-participant-overlay';

    const panel = document.createElement('div');
    panel.className = 'add-participant-panel';

    const titre = document.createElement('h2');
    titre.textContent = 'Ajouter des participants';
    panel.appendChild(titre);

    const liste = document.createElement('div');
    liste.className = 'add-participant-list';

    amis.forEach((ami) => {
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

    const actions = document.createElement('div');
    actions.className = 'add-participant-actions';

    const btnAnnuler = document.createElement('button');
    btnAnnuler.type = 'button';
    btnAnnuler.className = 'btn-secondary';
    btnAnnuler.textContent = 'Annuler';
    btnAnnuler.addEventListener('click', () => overlay.remove());

    const btnValider = document.createElement('button');
    btnValider.type = 'button';
    btnValider.className = 'btn-primary';
    btnValider.textContent = 'Ajouter';
    btnValider.addEventListener('click', async () => {
      const idsSelectionnes = Array.from(
        liste.querySelectorAll('input[type="checkbox"]:checked')
      ).map((el) => Number(el.value));

      if (idsSelectionnes.length === 0) {
        alert('Sélectionnez au moins un ami à ajouter.');
        return;
      }

      btnValider.disabled = true;

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

        overlay.remove();
        window.location.reload();
      } catch (err) {
        console.error('Erreur ajout participants :', err);
        alert('Erreur réseau lors de l’ajout des participants.');
      } finally {
        btnValider.disabled = false;
      }
    });

    actions.appendChild(btnAnnuler);
    actions.appendChild(btnValider);
    panel.appendChild(actions);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }
})();
