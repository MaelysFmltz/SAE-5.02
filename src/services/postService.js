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


module.exports = {
    createMediaPost,
    getAllPosts,
    getUserPosts
};