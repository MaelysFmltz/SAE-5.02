const db = require('../config/database');
const postModel = require('../models/postModel');
const userModel = require('../models/userModel');
const reactionModel = require('../models/reactionModel');

function validerContenuPublication(contenuPub) {
    if (typeof contenuPub !== 'string') {
        throw new Error('Le contenu de la publication doit être une chaîne de caractères');
    }

    const contenu = contenuPub.trim();

    if (contenu.length === 0) {
        throw new Error('Le contenu de la publication ne peut pas être vide');
    }

    if (contenu.length > 5000) {
        throw new Error('Le contenu de la publication ne peut pas dépasser 5000 caractères');
    }

    return contenu;
}

// ================================
// FONCTIONS MODÉRATION / SIGNALEMENT
// ================================

function obtenirAuteurOriginal(dbInstance, idPubli) {
    const database = dbInstance || db;
    if (!Number.isInteger(idPubli) || idPubli <= 0) {
        return null;
    }
    return postModel.trouverAuteurOriginal(database, idPubli);
}

function supprimerPublication(dbInstance, idPubli) {
    const database = dbInstance || db;
    if (!Number.isInteger(idPubli) || idPubli <= 0) {
        return {
            succes: false,
            erreur: 'Identifiant de publication invalide'
        };
    }

    const publication = database.prepare(`
        SELECT idPubli
        FROM Publication
        WHERE idPubli = ?
    `).get(idPubli);

    if (!publication) {
        return {
            succes: false,
            erreur: 'Publication introuvable'
        };
    }

    postModel.supprimerPublication(database, idPubli);

    return {
        succes: true
    };
}

// ================================
// VISIBILITÉ
// ================================

function sontAmis(dbInstance, idUser1, idUser2) {
    const database = dbInstance || db;
    const resultat = database.prepare(`
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

function peutVoirPublication(dbInstance, idPubli, idUser) {
    const database = dbInstance || db;
    const publication = database.prepare(`
        SELECT idUser, visibilite
        FROM Publication
        WHERE idPubli = ?
    `).get(idPubli);

    if (!publication) return false;
    if (publication.visibilite === 1) return true;
    if (publication.idUser === idUser) return true;

    return sontAmis(database, publication.idUser, idUser);
}

function modifierVisibilite(dbInstance, idPubli, idUser, nouvelleVisibilite) {
    const database = dbInstance || db;
    if (nouvelleVisibilite !== 0 && nouvelleVisibilite !== 1) {
        return false;
    }

    const publication = database.prepare(`
        SELECT idUser
        FROM Publication
        WHERE idPubli = ?
    `).get(idPubli);

    if (!publication) return false;
    if (publication.idUser !== idUser) return false;

    database.prepare(`
        UPDATE Publication
        SET visibilite = ?
        WHERE idPubli = ?
    `).run(nouvelleVisibilite, idPubli);

    return true;
}

function filtrerPublicationsVisibles(publications, idUserVisiteur) {
    const visiteur = idUserVisiteur ? Number(idUserVisiteur) : null;

    return publications.filter((post) => {
        if (Number(post.visibilite) === 1) return true;
        if (!visiteur) return false;
        if (Number(post.idUser) === visiteur) return true;

        return sontAmis(db, post.idUser, visiteur);
    });
}

function masquerOriginalSiInvisible(publication, idUser) {
    if (
        !publication.originalIdPubli ||
        peutVoirPublication(db, publication.originalIdPubli, idUser)
    ) {
        return publication;
    }

    return {
        ...publication,
        idPubliPartagee: null,
        originalIdPubli: null,
        originalIdUser: null,
        originalContenuPub: null,
        originalVisibilite: null,
        originalTypePublication: null,
        originalNomMedia: null,
        originalTypeMedia: null,
        auteurOriginalPseudo: null
    };
}

function masquerOriginauxInvisibles(publications, idUser) {
    return publications.map((publication) =>
        masquerOriginalSiInvisible(publication, idUser)
    );
}

// ================================
// PUBLICATIONS PHOTO / VIDÉO
// ================================

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

function getAllPosts(idUserVisiteur) {
    const posts = postModel.findAllPostsWithMedia();
    return filtrerPublicationsVisibles(posts, idUserVisiteur);
}

function getUserPosts(idUser, idUserVisiteur) {
    if (!idUser) {
        throw new Error('Identifiant utilisateur manquant');
    }

    const posts = postModel.findPostsByUserId(idUser);
    return filtrerPublicationsVisibles(posts, idUserVisiteur);
}

function deletePost(idPubli, idUser) {
    if (!idPubli || !idUser) {
        throw new Error('Identifiants de publication invalides');
    }

    const medias = postModel.deletePostByIdAndUser(idPubli, idUser);

    if (!medias) {
        const error = new Error('Publication introuvable ou non autorisée');
        error.status = 403;
        throw error;
    }

    return medias;
}

// ================================
// PUBLICATIONS CLASSIQUES
// ================================

function createPublication(
    idUser,
    contenuPub,
    visibilite = 1,
    idPubliPartagee = null
) {
    contenuPub = validerContenuPublication(contenuPub);

    const user = userModel.findById(idUser);
    if (!user) {
        throw new Error('Utilisateur introuvable');
    }

    if (visibilite !== 0 && visibilite !== 1) {
        throw new Error('Visibilité invalide');
    }

    if (idPubliPartagee !== null) {
        const publicationOriginale = postModel.findById(idPubliPartagee);
        if (!publicationOriginale) {
            throw new Error('Publication originale introuvable');
        }

        if (!peutVoirPublication(db, idPubliPartagee, idUser)) {
            throw new Error('Vous ne pouvez pas repartager cette publication');
        }
    }

    return postModel.createPublication(
        idUser,
        contenuPub,
        visibilite,
        idPubliPartagee,
        idPubliPartagee ? 'repost' : 'original'
    );
}

function createRepost(
    idUser,
    idPubliPartagee,
    visibilite = 1
) {
    const user = userModel.findById(idUser);
    if (!user) {
        throw new Error('Utilisateur introuvable');
    }

    const publicationOriginale = postModel.findById(idPubliPartagee);
    if (!publicationOriginale) {
        throw new Error('Publication originale introuvable');
    }

    if (visibilite !== 0 && visibilite !== 1) {
        throw new Error('Visibilité invalide');
    }

    if (!peutVoirPublication(db, idPubliPartagee, idUser)) {
        throw new Error('Vous ne pouvez pas repartager cette publication');
    }

    return postModel.createRepost(
        idUser,
        idPubliPartagee,
        visibilite
    );
}

function toggleRepost(idUser, idPubliPartagee, visibilite = 1) {
    const repostExistant = postModel.findRepost(idUser, idPubliPartagee);

    if (repostExistant) {
        postModel.deleteRepost(idUser, idPubliPartagee);
        return {
            reposted: false,
            publication: null
        };
    }

    return {
        reposted: true,
        publication: createRepost(idUser, idPubliPartagee, visibilite)
    };
}

function getPublication(idPubli) {
    const publication = postModel.findWithOriginal(idPubli);
    if (!publication) {
        throw new Error('Publication introuvable');
    }
    return publication;
}

function getPublicationForUser(idPubli, idUser) {
    const publication = postModel.findWithOriginal(idPubli);
    if (!publication) {
        throw new Error('Publication introuvable');
    }

    if (!peutVoirPublication(db, idPubli, idUser)) {
        throw new Error('Vous n’avez pas accès à cette publication');
    }

    const dejaReposte = idUser
        ? postModel.findRepostedPubliIds(idUser).has(publication.idPubli)
        : false;

    return {
        ...masquerOriginalSiInvisible(publication, idUser),
        dejaReposte
    };
}

function createDuo(
    idUser,
    idPubliOriginale,
    contenuPub,
    visibilite = 1,
    nomMedia = null,
    typeMedia = null
) {
    const user = userModel.findById(idUser);
    if (!user) {
        throw new Error('Utilisateur introuvable');
    }

    const publicationOriginale = postModel.findById(idPubliOriginale);
    if (!publicationOriginale) {
        throw new Error('Publication originale introuvable');
    }

    if (visibilite !== 0 && visibilite !== 1) {
        throw new Error('Visibilité invalide');
    }

    if (!peutVoirPublication(db, idPubliOriginale, idUser)) {
        throw new Error('Vous ne pouvez pas créer un Duo avec cette publication');
    }

    const idPubliMedia = postModel.resolveMediaSource(idPubliOriginale);
    if (!idPubliMedia) {
        throw new Error('Un Duo ne peut être créé qu’à partir d’une publication contenant une photo ou une vidéo');
    }

    if (idPubliMedia !== idPubliOriginale && !peutVoirPublication(db, idPubliMedia, idUser)) {
        throw new Error('Vous ne pouvez pas créer un Duo avec cette publication');
    }

    if (!nomMedia || !typeMedia) {
        throw new Error('Ajoutez votre propre photo ou vidéo pour créer un Duo');
    }

    return postModel.createDuo(
        idUser,
        idPubliMedia,
        contenuPub,
        visibilite,
        nomMedia,
        typeMedia
    );
}

function createCollage(
    idUser,
    idPubliOriginale,
    contenuPub,
    visibilite = 1,
    nomMedia = null,
    typeMedia = null
) {
    const user = userModel.findById(idUser);
    if (!user) {
        throw new Error('Utilisateur introuvable');
    }

    const publicationOriginale = postModel.findById(idPubliOriginale);
    if (!publicationOriginale) {
        throw new Error('Publication originale introuvable');
    }

    if (visibilite !== 0 && visibilite !== 1) {
        throw new Error('Visibilité invalide');
    }

    if (!peutVoirPublication(db, idPubliOriginale, idUser)) {
        throw new Error('Vous ne pouvez pas créer un collage avec cette publication');
    }

    const idPubliMedia = postModel.resolveMediaSource(idPubliOriginale);
    const mediaOriginal = idPubliMedia && postModel.findPostById(idPubliMedia);

    if (!mediaOriginal || mediaOriginal.typeMedia !== 'video') {
        throw new Error('Un collage ne peut être créé qu’à partir d’une publication contenant une vidéo');
    }

    if (idPubliMedia !== idPubliOriginale && !peutVoirPublication(db, idPubliMedia, idUser)) {
        throw new Error('Vous ne pouvez pas créer un collage avec cette publication');
    }

    if (!nomMedia || typeMedia !== 'video') {
        throw new Error('Ajoutez votre propre vidéo pour créer un collage');
    }

    return postModel.createCollage(
        idUser,
        idPubliMedia,
        contenuPub,
        visibilite,
        nomMedia,
        typeMedia
    );
}

function getRemixChainForUser(idPubli, idUser) {
    const chain = postModel.findRemixChain(idPubli);
    if (chain.length === 0) {
        throw new Error('Publication introuvable');
    }

    const chainAccessible = chain.filter(publication =>
        peutVoirPublication(db, publication.idPubli, idUser)
    );

    if (chainAccessible.length === 0) {
        throw new Error('Vous n’avez pas accès à cette publication');
    }

    return chainAccessible;
}

function getFeedForUser(idUser) {
    const publications = db.prepare(`
        SELECT
            p.idPubli,
            p.idUser,
            (
                SELECT COUNT(*)
                FROM Commentaire c
                WHERE c.idPubli = p.idPubli
            ) AS nombreCommentaires,
            p.contenuPub,
            p.visibilite,
            p.idPubliPartagee,
            p.typePublication,
            p.datePubli,

            u.pseudo AS auteurPseudo,

            m.nomMedia,
            m.typeMedia,

            original.idPubli AS originalIdPubli,
            original.idUser AS originalIdUser,
            original.contenuPub AS originalContenuPub,
            original.visibilite AS originalVisibilite,
            original.typePublication AS originalTypePublication,

            om.nomMedia AS originalNomMedia,
            om.typeMedia AS originalTypeMedia,

            originalUser.pseudo AS auteurOriginalPseudo

        FROM Publication p

        JOIN Utilisateur u
            ON p.idUser = u.idUser

        LEFT JOIN Media m
            ON m.idPubli = p.idPubli

        LEFT JOIN Publication original
            ON p.idPubliPartagee = original.idPubli

        LEFT JOIN Utilisateur originalUser
            ON original.idUser = originalUser.idUser

        LEFT JOIN Media om
            ON om.idPubli = original.idPubli

        ORDER BY p.datePubli DESC
    `).all();

    const idsDejaRepostes = postModel.findRepostedPubliIds(idUser);

    return publications
        .filter(publication =>
            peutVoirPublication(
                db,
                publication.idPubli,
                idUser
            )
        )
        .map(publication => {
            publication = masquerOriginalSiInvisible(publication, idUser);

            const reactions = reactionModel.getPostReactions(
                publication.idPubli,
                idUser
            );

            return {
                ...publication,
                likes: reactions.likes,
                dislikes: reactions.dislikes,
                userReaction: reactions.userReaction,
                dejaReposte: idsDejaRepostes.has(publication.idPubli)
            };
        });
}

module.exports = {
    // Modération / Signalement
    obtenirAuteurOriginal,
    supprimerPublication,

    // Visibilité
    sontAmis,
    peutVoirPublication,
    modifierVisibilite,
    filtrerPublicationsVisibles,
    masquerOriginalSiInvisible,
    masquerOriginauxInvisibles,

    // Publications classiques
    createPublication,
    createRepost,
    toggleRepost,
    getPublication,
    getPublicationForUser,
    createDuo,
    createCollage,
    getRemixChainForUser,
    getFeedForUser,

    // Photos / vidéos
    createMediaPost,
    getAllPosts,
    getUserPosts,
    deletePost
};