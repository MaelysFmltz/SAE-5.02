const form = document.getElementById('upload-form');
const imageInput = document.getElementById('image');
const preview = document.getElementById('preview');
const previewContainer = document.getElementById('preview-container');
const message = document.getElementById('message');
const postsContainer = document.getElementById('posts');

const MAX_SIZE = 20 * 1024 * 1024;

let previewUrl = null;


/*
 * ============================================================
 * PRÉVISUALISATION DE L'IMAGE
 * ============================================================
 */

imageInput.addEventListener('change', function () {

    const file = imageInput.files[0];

    message.textContent = '';

    if (!file) {
        hidePreview();
        return;
    }

    /*
     * Vérification JPEG
     */
    if (file.type !== 'image/jpeg') {

        imageInput.value = '';

        hidePreview();

        message.textContent =
            'Veuillez sélectionner une image JPEG.';

        return;
    }

    /*
     * Vérification taille
     */
    if (file.size > MAX_SIZE) {

        imageInput.value = '';

        hidePreview();

        message.textContent =
            'L’image ne doit pas dépasser 20 Mo.';

        return;
    }

    /*
     * Suppression de l'ancienne URL
     */
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
    }

    /*
     * Création de l'URL temporaire
     */
    previewUrl = URL.createObjectURL(file);

    /*
     * Affichage immédiat
     */
    preview.src = previewUrl;

    previewContainer.style.display = 'block';

});


/*
 * ============================================================
 * ENVOI DU FORMULAIRE
 * ============================================================
 */

form.addEventListener('submit', async function (event) {

    event.preventDefault();

    const file = imageInput.files[0];

    if (!file) {

        message.textContent =
            'Veuillez sélectionner une image.';

        return;
    }

    /*
     * Vérification JPEG
     */
    if (file.type !== 'image/jpeg') {

        message.textContent =
            'Seules les images JPEG sont autorisées.';

        return;
    }

    /*
     * Vérification taille
     */
    if (file.size > MAX_SIZE) {

        message.textContent =
            'L’image ne doit pas dépasser 20 Mo.';

        return;
    }

    /*
     * FormData
     */
    const formData = new FormData();

    formData.append('image', file);

    formData.append(
        'contenuPub',
        document.getElementById('contenuPub').value
    );

    formData.append(
        'visibilite',
        document.getElementById('visibilite').value
    );

    message.textContent = 'Publication en cours...';

    try {

        const response = await fetch('/post/upload', {

            method: 'POST',

            credentials: 'same-origin',

            body: formData

        });

        const data = await response.json();

        /*
         * Token invalide
         */
        if (response.status === 401) {

            localStorage.removeItem('token');
            localStorage.removeItem('user');

            message.textContent =
                data.error ||
                'Votre session a expiré. Reconnectez-vous.';

            return;
        }

        /*
         * Erreur serveur
         */
        if (!response.ok) {

            throw new Error(
                data.error ||
                'Erreur lors de la publication.'
            );

        }

        console.log('Publication reçue :', data);
        console.log('URL de l’image :', data.post?.url);
        console.log('Nom du fichier :', data.post?.nomMedia);

        /*
         * Publication réussie
         */
        message.textContent =
            data.message ||
            'Image publiée avec succès.';

        /*
         * Ajout immédiat du post
         */
        if (data.post) {

            addPostToPage(data.post);

        }

        /*
         * Réinitialisation
         */
        form.reset();

        hidePreview();

    } catch (error) {

        console.error('Erreur publication :', error);

        message.textContent =
            error.message ||
            'Erreur réseau lors de la publication.';

    }

});


/*
 * ============================================================
 * AJOUTER UNE PUBLICATION À LA PAGE
 * ============================================================
 */

function addPostToPage(post) {

    /*
     * Supprimer "Aucune photo publiée"
     */
    const emptyMessage =
        postsContainer.querySelector('.empty');

    if (emptyMessage) {
        emptyMessage.remove();
    }


    /*
     * ARTICLE
     */
    const article =
        document.createElement('article');

    article.className = 'post';


    /*
     * HEADER
     */
    const header =
        document.createElement('div');

    header.className = 'post-header';


    /*
     * UTILISATEUR
     */
    const user =
        document.createElement('div');

    user.className = 'post-user';

    user.textContent =
        post.pseudo || 'Utilisateur';


    /*
     * DATE
     */
    const date =
        document.createElement('div');

    date.className = 'post-date';

    date.textContent =
        post.datePubli || '';


    header.appendChild(user);
    header.appendChild(date);


    /*
     * IMAGE
     */
    const image =
        document.createElement('img');

    image.className = 'post-image';

    /*
     * On utilise directement l'URL
     * renvoyée par le serveur.
     */
    let imageUrl = post.url;

    /*
     * Sécurité au cas où post.url
     * n'existerait pas.
     */
    if (!imageUrl && post.nomMedia) {

        imageUrl =
            `/uploads/${encodeURIComponent(post.nomMedia)}`;

    }

    console.log('Chargement image :', imageUrl);

    image.src = imageUrl;

    image.alt =
        `Photo publiée par ${post.pseudo || 'Utilisateur'}`;

    /*
     * Vérification chargement
     */
    image.onload = function () {

        console.log(
            'Image chargée correctement :',
            image.src
        );

    };

    /*
     * Vérification erreur
     */
    image.onerror = function () {

        console.error(
            'Impossible de charger l’image :',
            image.src
        );

        message.textContent =
            'La publication a été enregistrée, mais l’image ne peut pas être affichée.';

    };


    /*
     * DESCRIPTION
     */
    article.appendChild(header);

    article.appendChild(image);

    if (post.contenuPub) {

        const content =
            document.createElement('div');

        content.className =
            'post-content';

        content.textContent =
            post.contenuPub;

        article.appendChild(content);

    }


    /*
     * Ajouter en haut de la liste
     */
    postsContainer.prepend(article);

}


/*
 * ============================================================
 * MASQUER LA PRÉVISUALISATION
 * ============================================================
 */

function hidePreview() {

    if (previewUrl) {

        URL.revokeObjectURL(previewUrl);

        previewUrl = null;

    }

    preview.src = '';

    previewContainer.style.display =
        'none';

}