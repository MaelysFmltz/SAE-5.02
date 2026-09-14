document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('upload-form');

    const mediaInput =
        document.getElementById('media');

    const previewContainer =
        document.getElementById('preview-container');

    const imagePreview =
        document.getElementById('image-preview');

    const videoPreview =
        document.getElementById('video-preview');

    const message =
        document.getElementById('message');


    if (!form || !mediaInput) {
        console.error('Formulaire de publication introuvable.');
        return;
    }


    let previewUrl = null;


    /*
     * =========================
     * CHOIX DU FICHIER
     * =========================
     */

    mediaInput.addEventListener('change', () => {

        const file = mediaInput.files[0];

        /*
         * Nettoyage de l'ancien aperçu.
         */
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }

        imagePreview.style.display = 'none';
        videoPreview.style.display = 'none';
        previewContainer.style.display = 'none';

        imagePreview.src = '';
        videoPreview.src = '';

        message.textContent = '';


        if (!file) {
            return;
        }


        const isImage =
            file.type.startsWith('image/');

        const isVideo =
            file.type.startsWith('video/');


        /*
         * Format non autorisé.
         */
        if (!isImage && !isVideo) {

            message.textContent =
                'Veuillez sélectionner une image ou une vidéo.';

            mediaInput.value = '';

            return;
        }


        /*
         * =========================
         * LIMITES
         * =========================
         */

        const maxSize = isImage
            ? 20 * 1024 * 1024
            : 100 * 1024 * 1024;


        if (file.size > maxSize) {

            message.textContent = isImage
                ? 'L’image ne doit pas dépasser 20 Mo.'
                : 'La vidéo ne doit pas dépasser 100 Mo.';

            mediaInput.value = '';

            return;
        }


        /*
         * =========================
         * APERÇU
         * =========================
         */

        previewUrl =
            URL.createObjectURL(file);


        /*
         * PHOTO
         */
        if (isImage) {

            imagePreview.src = previewUrl;

            imagePreview.style.display = 'block';

            videoPreview.style.display = 'none';

            previewContainer.style.display = 'block';
        }


        /*
         * VIDÉO
         */
        if (isVideo) {

            videoPreview.src = previewUrl;

            videoPreview.style.display = 'block';

            imagePreview.style.display = 'none';

            previewContainer.style.display = 'block';

            /*
             * Permet au navigateur de charger
             * la vidéo pour l'aperçu.
             */
            videoPreview.load();
        }

    });


    /*
     * =========================
     * PUBLICATION
     * =========================
     */

    form.addEventListener('submit', async (event) => {

        event.preventDefault();


        const file =
            mediaInput.files[0];


        if (!file) {

            message.textContent =
                'Veuillez sélectionner une photo ou une vidéo.';

            return;
        }


        /*
         * Vérification côté navigateur.
         */

        const isImage =
            file.type.startsWith('image/');

        const isVideo =
            file.type.startsWith('video/');


        if (!isImage && !isVideo) {

            message.textContent =
                'Format de fichier non autorisé.';

            return;
        }


        const maxSize = isImage
            ? 20 * 1024 * 1024
            : 100 * 1024 * 1024;


        if (file.size > maxSize) {

            message.textContent = isImage
                ? 'L’image ne doit pas dépasser 20 Mo.'
                : 'La vidéo ne doit pas dépasser 100 Mo.';

            return;
        }


        /*
         * FormData.
         *
         * Le nom "media" doit correspondre à :
         *
         * upload.single('media')
         */
        const formData =
            new FormData(form);


        /*
         * On s'assure qu'un seul fichier
         * est envoyé dans "media".
         */
        formData.delete('media');

        formData.append(
            'media',
            file
        );


        message.textContent =
            'Publication en cours...';


        try {

            const response =
                await fetch(
                    '/post/upload',
                    {
                        method: 'POST',
                        body: formData
                    }
                );


            /*
             * Le serveur doit répondre en JSON.
             */
            const contentType =
                response.headers.get('content-type') || '';


            let data;


            if (
                contentType.includes(
                    'application/json'
                )
            ) {

                data =
                    await response.json();

            } else {

                const text =
                    await response.text();

                console.error(
                    'Réponse serveur :',
                    text
                );

                throw new Error(
                    'Le serveur a renvoyé une réponse inattendue.'
                );
            }


            /*
             * Erreur serveur.
             */
            if (!response.ok) {

                throw new Error(
                    data.error ||
                    'Erreur lors de la publication.'
                );
            }


            /*
             * Publication réussie.
             */
            message.textContent =
                'Publication réussie !';


            /*
             * On revient sur le feed.
             * La publication sera visible dedans.
             */
            setTimeout(() => {

                window.location.href =
                    '/home';

            }, 300);


        } catch (error) {

            console.error(
                'Erreur :',
                error
            );

            message.textContent =
                error.message ||
                'Une erreur est survenue.';
        }

    });

});