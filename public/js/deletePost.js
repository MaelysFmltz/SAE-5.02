document.addEventListener('DOMContentLoaded', () => {

    document.addEventListener('click', async (event) => {

        const button =
            event.target.closest('.delete-post');

        if (!button) {
            return;
        }


        const idPubli =
            button.dataset.id;

        if (!idPubli) {

            console.error(
                'Identifiant de publication manquant.'
            );

            return;
        }


        const confirmation =
            window.confirm(
                'Voulez-vous vraiment supprimer cette publication ?'
            );


        if (!confirmation) {
            return;
        }


        /*
         * Désactive le bouton pendant la requête
         * pour éviter plusieurs suppressions.
         */
        button.disabled = true;
        button.textContent = 'Suppression...';


        try {

            const response =
                await fetch(
                    `/api/publications/api/${idPubli}`,
                    {
                        method: 'DELETE',
                        credentials: 'include',
                        headers: {
                            'Accept': 'application/json'
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
                    'Réponse serveur :',
                    text
                );

                throw new Error(
                    'Réponse inattendue du serveur.'
                );
            }


            /*
             * Erreur.
             */
            if (!response.ok) {

                throw new Error(
                    data.error ||
                    'Impossible de supprimer la publication.'
                );
            }


            /*
             * Suppression réussie.
             */
            const postElement =
                button.closest(
                    '.publication-card'
                );


            if (postElement) {

                postElement.remove();
            }


        } catch (error) {

            console.error(
                'Erreur suppression :',
                error
            );


            alert(
                error.message ||
                'Une erreur est survenue lors de la suppression.'
            );


            button.disabled = false;
            button.textContent = 'Supprimer';
        }

    });

});

