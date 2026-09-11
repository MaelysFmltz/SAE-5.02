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
 * Récupère toutes les publications avec images.
 */
function getAllImagePosts() {
    return postModel.findAllPostsWithImages();
}


module.exports = {
    createImagePost,
    getAllImagePosts
};