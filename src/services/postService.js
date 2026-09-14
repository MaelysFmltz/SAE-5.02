const postModel = require('../models/postModel');


/**
 * Crée une publication contenant une image.
 */
function createImagePost(
    idUser,
    contenuPub,
    visibilite,
    nomMedia
) {
    return postModel.createImagePost(
        idUser,
        contenuPub,
        visibilite,
        nomMedia
    );
}


/**
 * Récupère toutes les publications.
 *
 * Utilisé pour le Feed.
 */
function getAllImagePosts() {
    return postModel.findAllPostsWithImages();
}


/**
 * Récupère les publications d'un utilisateur.
 *
 * Utilisé pour son profil.
 */
function getUserImagePosts(idUser) {

    if (!idUser) {
        throw new Error(
            'Identifiant utilisateur manquant'
        );
    }

    return postModel.findPostsByUserId(idUser);
}


module.exports = {
    createImagePost,
    getAllImagePosts,
    getUserImagePosts
};