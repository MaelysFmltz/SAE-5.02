document.addEventListener(
'DOMContentLoaded',
() => {


    const form =
        document.getElementById(
            'upload-form'
        );


    const mediaInput =
        document.getElementById(
            'media'
        );


    const previewContainer =
        document.getElementById(
            'preview-container'
        );


    const imagePreview =
        document.getElementById(
            'image-preview'
        );


    const videoPreview =
        document.getElementById(
            'video-preview'
        );


    const message =
        document.getElementById(
            'message'
        );


    if (
        !form ||
        !mediaInput
    ) {

        console.error(
            'Formulaire de publication introuvable.'
        );

        return;
    }


    /*
     * =====================================================
     * CONSTANTES
     * =====================================================
     */

    const IMAGE_MAX_SIZE =
        20 * 1024 * 1024;


    const VIDEO_MAX_SIZE =
        100 * 1024 * 1024;


    const ALLOWED_IMAGE_TYPES = [
        'image/jpeg',
        'image/png',
        'image/webp'
    ];


    const ALLOWED_VIDEO_TYPES = [
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/quicktime'
    ];


    let previewUrl = null;


    /*
     * =====================================================
     * FONCTIONS UTILITAIRES
     * =====================================================
     */


    function clearPreview() {

        if (previewUrl) {

            URL.revokeObjectURL(
                previewUrl
            );

            previewUrl = null;
        }


        imagePreview.style.display =
            'none';

        videoPreview.style.display =
            'none';

        previewContainer.style.display =
            'none';


        imagePreview.src =
            '';

        videoPreview.pause();

        videoPreview.removeAttribute(
            'src'
        );

        videoPreview.load();
    }


    function clearMessage() {

        message.textContent =
            '';
    }


    function getMediaType(file) {

        if (
            ALLOWED_IMAGE_TYPES.includes(
                file.type
            )
        ) {

            return 'image';
        }


        if (
            ALLOWED_VIDEO_TYPES.includes(
                file.type
            )
        ) {

            return 'video';
        }


        return null;
    }


    function validateFile(file) {

        const type =
            getMediaType(file);


        if (!type) {

            return {
                valid: false,
                error:
                    'Veuillez sélectionner une image ou une vidéo dans un format autorisé.'
            };
        }


        const maxSize =
            type === 'image'
                ? IMAGE_MAX_SIZE
                : VIDEO_MAX_SIZE;


        if (
            file.size > maxSize
        ) {

            return {
                valid: false,
                error:
                    type === 'image'
                        ? 'L’image ne doit pas dépasser 20 Mo.'
                        : 'La vidéo ne doit pas dépasser 100 Mo.'
            };
        }


        return {
            valid: true,
            type
        };
    }


    /*
     * =====================================================
     * CHOIX DU FICHIER
     * =====================================================
     */

    mediaInput.addEventListener(
        'change',
        () => {

            clearPreview();
            clearMessage();


            const file =
                mediaInput.files[0];


            if (!file) {
                return;
            }


            const validation =
                validateFile(file);


            if (!validation.valid) {

                message.textContent =
                    validation.error;

                mediaInput.value =
                    '';

                return;
            }


            /*
             * Création de l'aperçu local.
             */
            previewUrl =
                URL.createObjectURL(
                    file
                );


            /*
             * IMAGE
             */
            if (
                validation.type ===
                'image'
            ) {

                imagePreview.src =
                    previewUrl;


                imagePreview.style.display =
                    'block';


                previewContainer.style.display =
                    'block';


                return;
            }


            /*
             * VIDÉO
             */
            if (
                validation.type ===
                'video'
            ) {

                videoPreview.src =
                    previewUrl;


                videoPreview.style.display =
                    'block';


                previewContainer.style.display =
                    'block';


                videoPreview.load();
            }
        }
    );


    /*
     * =====================================================
     * PUBLICATION
     * =====================================================
     */

    form.addEventListener(
        'submit',
        async (event) => {

            event.preventDefault();


            clearMessage();


            const file =
                mediaInput.files[0];


            /*
             * Aucun fichier.
             */
            if (!file) {

                message.textContent =
                    'Veuillez sélectionner une photo ou une vidéo.';

                return;
            }


            /*
             * Nouvelle validation avant l'envoi.
             *
             * Elle évite de dépendre uniquement
             * de l'événement "change".
             */
            const validation =
                validateFile(file);


            if (!validation.valid) {

                message.textContent =
                    validation.error;

                return;
            }


            /*
             * Désactivation du bouton pour éviter
             * plusieurs envois simultanés.
             */
            const submitButton =
                form.querySelector(
                    'button[type="submit"]'
                );


            if (submitButton) {

                submitButton.disabled =
                    true;

                submitButton.textContent =
                    'Publication...';
            }


            /*
             * =================================================
             * FORMDATA
             * =================================================
             */

            const formData =
                new FormData(form);


            /*
             * Le champ "media" doit être exactement celui
             * attendu par upload.single('media').
             */
            formData.delete(
                'media'
            );


            formData.append(
                'media',
                file
            );


            message.textContent =
                'Publication en cours...';


            try {

                const response =
                    await fetch(
                        '/api/publications/upload',
                        {
                            method: 'POST',

                            /*
                             * Le JWT est dans le cookie
                             * httpOnly "token".
                             */
                            credentials: 'include',

                            body: formData,

                            headers: {
                                'Accept':
                                    'application/json'
                            }
                        }
                    );


                const contentType =
                    response.headers.get(
                        'content-type'
                    ) || '';


                let data = {};


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
                        'Réponse serveur inattendue :',
                        text
                    );


                    throw new Error(
                        'Le serveur a renvoyé une réponse inattendue.'
                    );
                }


                /*
                 * =================================================
                 * ERREUR
                 * =================================================
                 */

                if (!response.ok) {

                    throw new Error(
                        data.error ||
                        'Erreur lors de la publication.'
                    );
                }


                /*
                 * =================================================
                 * SUCCÈS
                 * =================================================
                 */

                message.textContent =
                    'Publication réussie !';


                /*
                 * Le serveur a créé la publication.
                 * On retourne au feed pour l'afficher.
                 */
                setTimeout(
                    () => {

                        window.location.href =
                            '/home';

                    },
                    300
                );

            } catch (error) {

                console.error(
                    'Erreur publication :',
                    error
                );


                message.textContent =
                    error.message ||
                    'Une erreur est survenue lors de la publication.';


                /*
                 * Le bouton est réactivé uniquement
                 * en cas d'échec.
                 */
                if (submitButton) {

                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        'Publier';
                }
            }

        }
    );


    /*
     * =====================================================
     * NETTOYAGE
     * =====================================================
     */

    window.addEventListener(
        'beforeunload',
        () => {

            if (previewUrl) {

                URL.revokeObjectURL(
                    previewUrl
                );

                previewUrl = null;
            }
        }
    );

}


);
