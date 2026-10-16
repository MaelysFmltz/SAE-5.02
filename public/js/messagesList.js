/**
 * Logique front-end de la liste des conversations (views/messages.ejs) :
 * création d'une conversation de groupe.
 */
(function () {
  'use strict';

  const scriptTag = document.currentScript;
  const idUserCourant = Number(scriptTag.dataset.userId);
  const btnNewGroup = document.getElementById('btn-new-group');

  if (!btnNewGroup) {
    return;
  }

  btnNewGroup.addEventListener('click', async () => {
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

    if (amis.length < 2) {
      alert('Il vous faut au moins 2 amis pour créer un groupe.');
      return;
    }

    ouvrirCreationGroupe(amis);
  });

  function ouvrirCreationGroupe(amis) {
    const overlay = document.createElement('div');
    overlay.className = 'add-participant-overlay';

    const panel = document.createElement('div');
    panel.className = 'add-participant-panel';

    const titre = document.createElement('h2');
    titre.textContent = 'Nouveau groupe';
    panel.appendChild(titre);

    const inputTitre = document.createElement('input');
    inputTitre.type = 'text';
    inputTitre.placeholder = 'Nom du groupe (optionnel)';
    inputTitre.maxLength = 100;
    inputTitre.className = 'group-title-input';
    panel.appendChild(inputTitre);

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
    btnValider.textContent = 'Créer';
    btnValider.addEventListener('click', async () => {
      const idsSelectionnes = Array.from(
        liste.querySelectorAll('input[type="checkbox"]:checked')
      ).map((el) => Number(el.value));

      if (idsSelectionnes.length < 2) {
        alert('Sélectionnez au moins 2 amis pour créer un groupe.');
        return;
      }

      btnValider.disabled = true;

      try {
        const res = await fetch('/api/conversations/group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            membres: idsSelectionnes,
            titreGroupe: inputTitre.value.trim() || null
          })
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.error || 'Impossible de créer le groupe.');
          return;
        }

        window.location.href = `/messages/${data.idConversation}`;
      } catch (err) {
        console.error('Erreur création groupe :', err);
        alert('Erreur réseau lors de la création du groupe.');
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
