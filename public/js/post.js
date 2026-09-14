const form =
    document.getElementById('upload-form');

const imageInput =
    document.getElementById('image');

const preview =
    document.getElementById('preview');

const previewContainer =
    document.getElementById('preview-container');

const message =
    document.getElementById('message');


const MAX_SIZE =
    20 * 1024 * 1024;


let previewUrl = null;


/*
 * ============================================================
 * PRÉVISUALISATION
 * ============================================================
 */

imageInput.addEventListener(
    'change',
    function () {

        const file =
            imageInput.files[0];


        message.textContent = '';


        if (!file) {

            hidePreview();

            return;
        }


        /*
         * Vérification JPEG.
         */
        if (file.type !== 'image/jpeg') {

            imageInput.value = '';

            hidePreview();

            message.textContent =
                'Veuillez sélectionner une image JPEG.';

            return;
        }


        /*
         * Vérification taille.
         */
        if (file.size > MAX_SIZE) {

            imageInput.value = '';

            hidePreview();

            message.textContent =
                'L’image ne doit pas dépasser 20 Mo.';

            return;
        }


        /*
         * Supprimer l'ancienne URL.
         */
        if (previewUrl) {

            URL.revokeObjectURL(
                previewUrl
            );
        }


        /*
         * Créer une URL temporaire.
         */
        previewUrl =
            URL.createObjectURL(file);


        preview.src =
            previewUrl;


        previewContainer.style.display =
            'block';

    }
);


/*
 * ============================================================
 * ENVOI DU FORMULAIRE
 * ============================================================
 */

form.addEventListener(
    'submit',
    async function (event) {

        event.preventDefault();


        const file =
            imageInput.files[0];


        if (!file) {

            message.textContent =
                'Veuillez sélectionner une image.';

            return;
        }


        if (file.type !== 'image/jpeg') {

            message.textContent =
                'Seules les images JPEG sont autorisées.';

            return;
        }


        if (file.size > MAX_SIZE) {

            message.textContent =
                'L’image ne doit pas dépasser 20 Mo.';

            return;
        }


        /*
         * FormData.
         */
        const formData =
            new FormData();


        formData.append(
            'image',
            file
        );


        formData.append(
            'contenuPub',
            document.getElementById(
                'contenuPub'
            ).value
        );


        formData.append(
            'visibilite',
            document.getElementById(
                'visibilite'
            ).value
        );


        message.textContent =
            'Publication en cours...';


        try {

            const response =
                await fetch(
                    '/post/upload',
                    {
                        method: 'POST',
                        credentials: 'same-origin',
                        body: formData
                    }
                );


            const data =
                await response.json();


            /*
             * Session expirée.
             */
            if (response.status === 401) {

                message.textContent =
                    data.error ||
                    'Votre session a expiré.';

                setTimeout(() => {

                    window.location.href = '/';

                }, 1000);

                return;
            }


            /*
             * Erreur.
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
                data.message ||
                'Image publiée avec succès.';


            /*
             * Petit délai pour laisser
             * apparaître le message.
             */
            setTimeout(() => {

                /*
                 * Le post est maintenant en BDD.
                 *
                 * Le Feed va donc le récupérer
                 * automatiquement.
                 */
                window.location.href =
                    '/home';

            }, 500);


        } catch (error) {

            console.error(
                'Erreur publication :',
                error
            );


            message.textContent =
                error.message ||
                'Erreur réseau lors de la publication.';

        }

    }
);


/*
 * ============================================================
 * MASQUER LA PRÉVISUALISATION
 * ============================================================
 */

function hidePreview() {

    if (previewUrl) {

        URL.revokeObjectURL(
            previewUrl
        );

        previewUrl = null;
    }


    preview.src = '';


    previewContainer.style.display =
        'none';
}