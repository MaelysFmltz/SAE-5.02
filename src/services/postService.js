const postModel =
    require('../models/postModel');


/**
 * Création d'une publication
 * photo OU vidéo.
 */
function createMediaPost(
    idUser,
    contenuPub,
    visibilite,
    nomMedia,
    typeMedia
) {
    return postModel.createMediaPost(
        idUser,
        contenuPub,
        visibilite,
        nomMedia,
        typeMedia
    );
}


/**
 * Toutes les publications.
 */
function getAllPosts() {

    return postModel.findAllPostsWithMedia();

}


/**
 * Publications d'un utilisateur.
 */
function getUserPosts(idUser) {

    if (!idUser) {
        throw new Error(
            'Identifiant utilisateur manquant'
        );
    }

    return postModel.findPostsByUserId(
        idUser
    );
}


/**
 * Supprime une publication appartenant à l'utilisateur.
 */
function deletePost(idPubli, idUser) {

    if (!idPubli || !idUser) {
        throw new Error(
            'Identifiants de publication invalides'
        );
    }

    const media =
        postModel.deletePostByIdAndUser(
            idPubli,
            idUser
        );

    if (!media) {

        const error = new Error(
            'Publication introuvable ou non autorisée'
        );

        error.status = 403;

        throw error;
    }

    return media;
}



module.exports = {
    createMediaPost,
    getAllPosts,
    getUserPosts,
    deletePost
};