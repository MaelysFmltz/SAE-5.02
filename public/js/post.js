const form =
    document.getElementById('postForm');

const submitButton =
    document.getElementById('submitButton');

const message =
    document.getElementById('message');

const progressContainer =
    document.getElementById('progressContainer');

const progressBar =
    document.getElementById('progressBar');

const progressText =
    document.getElementById('progressText');


function showMessage(
    text,
    type
) {
    message.textContent = text;

    message.className = type;

    message.style.display = 'block';
}


function hideMessage() {
    message.textContent = '';

    message.className = '';

    message.style.display = 'none';
}


/*
 * ============================================================
 * ENVOI DU FORMULAIRE
 * ============================================================
 */

form.addEventListener(
    'submit',
    async (event) => {
        event.preventDefault();

        hideMessage();

        const videoInput =
            document.getElementById('video');

        const contenuInput =
            document.getElementById('contenuPub');


        /*
         * ========================================================
         * VERIFICATION DE LA VIDEO
         * ========================================================
         */

        if (
            videoInput.files.length > 0
        ) {
            const video =
                videoInput.files[0];

            const maxSize =
                50 * 1024 * 1024;

            if (
                video.size > maxSize
            ) {
                showMessage(
                    'La vidéo ne peut pas dépasser 50 Mo.',
                    'error'
                );

                return;
            }

            const allowedExtensions = [
                '.mp4',
                '.mov',
                '.avi',
                '.webm'
            ];

            const filename =
                video.name.toLowerCase();

            const validExtension =
                allowedExtensions.some(
                    (extension) =>
                        filename.endsWith(
                            extension
                        )
                );

            if (!validExtension) {
                showMessage(
                    'Format vidéo non autorisé. Utilisez MP4, MOV, AVI ou WebM.',
                    'error'
                );

                return;
            }
        }


        /*
         * ========================================================
         * VERIFICATION DU CONTENU
         * ========================================================
         *
         * Une publication doit contenir au minimum :
         *
         * - du texte
         * OU
         * - une vidéo
         */

        const hasText =
            contenuInput.value.trim().length > 0;

        const hasVideo =
            videoInput.files.length > 0;

        if (
            !hasText &&
            !hasVideo
        ) {
            showMessage(
                'Ajoutez du texte ou une vidéo.',
                'error'
            );

            return;
        }


        /*
         * ========================================================
         * CREATION DU FORMDATA
         * ========================================================
         *
         * L'idUser n'est volontairement PAS envoyé.
         *
         * Le serveur récupère l'utilisateur depuis le JWT
         * contenu dans le cookie HTTP-only.
         */

        const formData =
            new FormData();

        formData.append(
            'contenuPub',
            contenuInput.value
        );

        if (hasVideo) {
            formData.append(
                'video',
                videoInput.files[0]
            );
        }


        /*
         * ========================================================
         * PREPARATION DE L'ENVOI
         * ========================================================
         */

        submitButton.disabled = true;

        progressContainer.style.display =
            'block';

        progressBar.value = 0;

        progressText.textContent =
            'Envoi : 0 %';


        try {
            const result =
                await uploadPublication(
                    formData
                );


            /*
             * ====================================================
             * SUCCES
             * ====================================================
             */

            showMessage(
                result.message ||
                    'Publication créée avec succès.',
                'success'
            );

            form.reset();

            progressBar.value = 100;

            progressText.textContent =
                'Envoi : 100 %';

        } catch (error) {

            showMessage(
                error.message ||
                    'Une erreur est survenue.',
                'error'
            );

        } finally {

            submitButton.disabled = false;

            setTimeout(
                () => {
                    progressContainer.style.display =
                        'none';
                },
                1500
            );
        }
    }
);


/*
 * ============================================================
 * ENVOI DE LA PUBLICATION
 * ============================================================
 */

function uploadPublication(
    formData
) {
    return new Promise(
        (resolve, reject) => {

            const xhr =
                new XMLHttpRequest();


            /*
             * POST /post
             */

            xhr.open(
                'POST',
                '/post',
                true
            );


            /*
             * ====================================================
             * COOKIE D'AUTHENTIFICATION
             * ====================================================
             *
             * IMPORTANT :
             *
             * Nous ne récupérons PAS le JWT en JavaScript.
             *
             * Le cookie HTTP-only "token" est automatiquement
             * envoyé par le navigateur avec cette requête.
             *
             * Aucun Authorization: Bearer n'est nécessaire.
             */

            xhr.withCredentials = true;


            /*
             * ====================================================
             * PROGRESSION DE L'UPLOAD
             * ====================================================
             */

            xhr.upload.addEventListener(
                'progress',
                (event) => {

                    if (
                        !event.lengthComputable
                    ) {
                        return;
                    }

                    const percentage =
                        Math.round(
                            (
                                event.loaded /
                                event.total
                            ) * 100
                        );

                    progressBar.value =
                        percentage;

                    progressText.textContent =
                        `Envoi : ${percentage} %`;
                }
            );


            /*
             * ====================================================
             * REPONSE HTTP
             * ====================================================
             */

            xhr.addEventListener(
                'load',
                () => {

                    let data;

                    try {
                        data =
                            JSON.parse(
                                xhr.responseText
                            );

                    } catch (error) {

                        reject(
                            new Error(
                                'Réponse invalide du serveur.'
                            )
                        );

                        return;
                    }


                    /*
                     * Requête réussie.
                     */

                    if (
                        xhr.status >= 200 &&
                        xhr.status < 300
                    ) {
                        resolve(data);

                        return;
                    }


                    /*
                     * Erreur retournée par le serveur.
                     */

                    reject(
                        new Error(
                            data.error ||
                                'La publication n’a pas pu être créée.'
                        )
                    );
                }
            );


            /*
             * ====================================================
             * ERREUR RESEAU
             * ====================================================
             */

            xhr.addEventListener(
                'error',
                () => {
                    reject(
                        new Error(
                            'Impossible de contacter le serveur.'
                        )
                    );
                }
            );


            /*
             * ====================================================
             * ANNULATION
             * ====================================================
             */

            xhr.addEventListener(
                'abort',
                () => {
                    reject(
                        new Error(
                            'L’envoi a été annulé.'
                        )
                    );
                }
            );


            /*
             * Envoi de la requête.
             */

            xhr.send(
                formData
            );
        }
    );
}
