/*
 * Modal partagé entre le feed et le profil pour créer un Duo
 * (photo/vidéo personnelle affichée à côté de l'originale) ou
 * un collage (vidéo personnelle associée à la vidéo originale).
 */
document.addEventListener('DOMContentLoaded', () => {

    const overlay = document.getElementById('remix-modal-overlay');
    const form = document.getElementById('remix-form');
    const title = document.getElementById('remix-modal-title');
    const idPubliInput = document.getElementById('remix-idPubli');
    const modeInput = document.getElementById('remix-mode');
    const mediaInput = document.getElementById('remix-media');
    const mediaLabel = document.getElementById('remix-media-label');
    const messageEl = document.getElementById('remix-modal-message');
    const submitBtn = document.getElementById('remix-modal-submit');

    if (!overlay || !form) {
        return;
    }

    function ouvrirRemixModal(idPubli, mode) {
        idPubliInput.value = idPubli;
        modeInput.value = mode;
        messageEl.textContent = '';
        form.reset();
        idPubliInput.value = idPubli;
        modeInput.value = mode;

        if (mode === 'collage') {
            title.textContent = 'Créer un collage';
            mediaLabel.textContent = 'Votre vidéo';
            mediaInput.setAttribute('accept', 'video/mp4,video/webm,video/ogg,video/quicktime');
        } else {
            title.textContent = 'Créer un Duo';
            mediaLabel.textContent = 'Votre photo ou vidéo';
            mediaInput.setAttribute(
                'accept',
                'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/ogg,video/quicktime'
            );
        }

        overlay.classList.add('open');
    }

    window.creerDuo = (idPubli) => ouvrirRemixModal(idPubli, 'duo');
    window.creerCollage = (idPubli) => ouvrirRemixModal(idPubli, 'collage');

    window.fermerRemixModal = (event) => {
        if (event && event.target !== overlay) {
            return;
        }

        overlay.classList.remove('open');
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const idPubli = idPubliInput.value;
        const mode = modeInput.value;

        if (!mediaInput.files[0]) {
            messageEl.textContent = 'Sélectionnez un fichier.';
            return;
        }

        const formData = new FormData(form);

        submitBtn.disabled = true;
        submitBtn.textContent = 'Création...';
        messageEl.textContent = '';

        try {
            const response = await fetch(
                `/api/publications/${idPubli}/${mode}`,
                {
                    method: 'POST',
                    credentials: 'same-origin',
                    body: formData
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || 'Erreur lors de la création.'
                );
            }

            window.location.reload();

        } catch (error) {
            console.error('Erreur remix :', error);
            messageEl.textContent = error.message;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Créer';
        }
    });
});
