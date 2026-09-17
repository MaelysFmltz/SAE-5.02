const postModel =
    require('../models/postModel');

const db =
    require('../config/database');


/**
 * Deux utilisateurs sont amis s'ils se suivent mutuellement.
 */
function sontAmis(db, idUser1, idUser2) {
    const resultat = db.prepare(`
        SELECT COUNT(*) AS nombre
        FROM Abonnement a1
        JOIN Abonnement a2
            ON a1.idUserAbonne = a2.idUserSuivi
            AND a1.idUserSuivi = a2.idUserAbonne
        WHERE a1.idUserAbonne = ?
        AND a1.idUserSuivi = ?
    `).get(idUser1, idUser2);

    return resultat.nombre > 0;
}


/**
 * Vérifie si idUser peut voir la publication idPubli :
 * publique, propriétaire, ou amis (follow mutuel) avec l'auteur.
 */
function peutVoirPublication(db, idPubli, idUser) {
    const publication = db.prepare(`
        SELECT idUser, visibilite
        FROM Publication
        WHERE idPubli = ?
    `).get(idPubli);

    if (!publication) {
        return false;
    }

    if (publication.visibilite === 1) {
        return true;
    }

    if (publication.idUser === idUser) {
        return true;
    }

    return sontAmis(db, publication.idUser, idUser);
}


/**
 * Change la visibilité d'une publication, réservé à son propriétaire.
 */
function modifierVisibilite(db, idPubli, idUser, nouvelleVisibilite) {
    if (
        !Number.isInteger(nouvelleVisibilite) ||
        (nouvelleVisibilite !== 0 && nouvelleVisibilite !== 1)
    ) {
        return false;
    }

    const publication = db.prepare(`
        SELECT idUser
        FROM Publication
        WHERE idPubli = ?
    `).get(idPubli);

    if (!publication) {
        return false;
    }

    if (publication.idUser !== idUser) {
        return false;
    }

    db.prepare(`
        UPDATE Publication
        SET visibilite = ?
        WHERE idPubli = ?
    `).run(nouvelleVisibilite, idPubli);

    return true;
}


/**
 * Ne garde, parmi une liste de publications, que celles visibles
 * par idUserVisiteur (publiques, siennes, ou d'un ami).
 *
 * idUserVisiteur manquant => traité comme visiteur anonyme,
 * seules les publications publiques passent (fail-closed).
 */
function filtrerPublicationsVisibles(publications, idUserVisiteur) {

    const visiteur = idUserVisiteur
        ? Number(idUserVisiteur)
        : null;

    return publications.filter((post) => {

        if (Number(post.visibilite) === 1) {
            return true;
        }

        if (!visiteur) {
            return false;
        }

        if (Number(post.idUser) === visiteur) {
            return true;
        }

        return sontAmis(db, post.idUser, visiteur);
    });
}


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
 * Toutes les publications visibles par idUserVisiteur.
 */
function getAllPosts(idUserVisiteur) {

    const posts =
        postModel.findAllPostsWithMedia();

    return filtrerPublicationsVisibles(
        posts,
        idUserVisiteur
    );
}


/**
 * Publications d'un utilisateur, filtrées selon ce que
 * idUserVisiteur est autorisé à voir.
 */
function getUserPosts(idUser, idUserVisiteur) {

    if (!idUser) {
        throw new Error(
            'Identifiant utilisateur manquant'
        );
    }

    const posts =
        postModel.findPostsByUserId(
            idUser
        );

    return filtrerPublicationsVisibles(
        posts,
        idUserVisiteur
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
    deletePost,
    sontAmis,
    peutVoirPublication,
    modifierVisibilite
};
