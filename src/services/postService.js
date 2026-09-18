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
// PARTIE 4 : VISIBILITÉ
// ================================

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

function peutVoirPublication(db, idPubli, idUser) {
    const publication = db.prepare(`
        SELECT idUser, visibilite
        FROM Publication
        WHERE idPubli = ?
    `).get(idPubli);

    if (!publication) return false;

    // Publication publique
    if (publication.visibilite === 1) return true;

    // L'auteur peut toujours voir sa publication
    if (publication.idUser === idUser) return true;

    // Publication réservée aux amis
    return sontAmis(db, publication.idUser, idUser);
}

function modifierVisibilite(db, idPubli, idUser, nouvelleVisibilite) {
    if (nouvelleVisibilite !== 0 && nouvelleVisibilite !== 1) {
        return false;
    }

    const publication = db.prepare(`
        SELECT idUser
        FROM Publication
        WHERE idPubli = ?
    `).get(idPubli);

    if (!publication) return false;

    if (publication.idUser !== idUser) return false;

    db.prepare(`
        UPDATE Publication
        SET visibilite = ?
        WHERE idPubli = ?
    `).run(nouvelleVisibilite, idPubli);

    return true;
}

/**
 * Ne garde, parmi une liste de publications, que celles visibles
 * par idUserVisiteur.
 *
 * Publication publique => visible
 * Publication de l'utilisateur => visible
 * Publication d'un ami => visible
 * Sinon => masquée
 */
function filtrerPublicationsVisibles(publications, idUserVisiteur) {
    const visiteur = idUserVisiteur ? Number(idUserVisiteur) : null;

    return publications.filter((post) => {
        if (Number(post.visibilite) === 1) return true;

        if (!visiteur) return false;

        if (Number(post.idUser) === visiteur) return true;

        return sontAmis(db, post.idUser, visiteur);
    });
}

// ================================
// PUBLICATIONS PHOTO / VIDÉO
// ================================

/**
 * Création d'une publication contenant une photo ou une vidéo.
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
 * Toutes les publications contenant un média,
 * filtrées selon la visibilité de l'utilisateur.
 */
function getAllPosts(idUserVisiteur) {
    const posts = postModel.findAllPostsWithMedia();

    return filtrerPublicationsVisibles(
        posts,
        idUserVisiteur
    );
}

/**
 * Publications d'un utilisateur,
 * filtrées selon ce que le visiteur peut voir.
 */
function getUserPosts(idUser, idUserVisiteur) {
    if (!idUser) {
        throw new Error('Identifiant utilisateur manquant');
    }

    const posts = postModel.findPostsByUserId(idUser);

    return filtrerPublicationsVisibles(
        posts,
        idUserVisiteur
    );
}

/**
 * Supprime une publication appartenant à l'utilisateur
 * (avec ou sans média, quel que soit son type).
 *
 * Retourne la liste (éventuellement vide) des médias qui lui
 * étaient associés, pour que l'appelant supprime les fichiers
 * correspondants sur le disque.
 */
function deletePost(idPubli, idUser) {
    if (!idPubli || !idUser) {
        throw new Error('Identifiants de publication invalides');
    }

    const medias = postModel.deletePostByIdAndUser(
        idPubli,
        idUser
    );

    if (!medias) {
        const error = new Error(
            'Publication introuvable ou non autorisée'
        );

        error.status = 403;
        throw error;
    }

    return medias;
}

// ================================
// PARTIE 6 : PUBLICATIONS
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
        const publicationOriginale =
            postModel.findById(idPubliPartagee);

        if (!publicationOriginale) {
            throw new Error('Publication originale introuvable');
        }

        if (!peutVoirPublication(db, idPubliPartagee, idUser)) {
            throw new Error(
                'Vous ne pouvez pas repartager cette publication'
            );
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

// Repartage classique
function createRepost(
    idUser,
    idPubliPartagee,
    visibilite = 1
) {
    const user = userModel.findById(idUser);

    if (!user) {
        throw new Error('Utilisateur introuvable');
    }

    const publicationOriginale =
        postModel.findById(idPubliPartagee);

    if (!publicationOriginale) {
        throw new Error('Publication originale introuvable');
    }

    if (visibilite !== 0 && visibilite !== 1) {
        throw new Error('Visibilité invalide');
    }

    if (!peutVoirPublication(db, idPubliPartagee, idUser)) {
        throw new Error(
            'Vous ne pouvez pas repartager cette publication'
        );
    }

    return postModel.createRepost(
        idUser,
        idPubliPartagee,
        visibilite
    );
}

/**
 * Bascule le repost d'une publication par un utilisateur :
 * le crée s'il n'existe pas encore, l'annule (suppression) s'il
 * existe déjà. Un utilisateur ne peut avoir qu'un seul repost
 * actif d'une même publication à la fois.
 */
function toggleRepost(idUser, idPubliPartagee, visibilite = 1) {
    const repostExistant =
        postModel.findRepost(idUser, idPubliPartagee);

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

// Récupérer une publication
function getPublication(idPubli) {
    const publication =
        postModel.findWithOriginal(idPubli);

    if (!publication) {
        throw new Error('Publication introuvable');
    }

    return publication;
}

// Récupérer une publication accessible par un utilisateur
function getPublicationForUser(idPubli, idUser) {
    const publication =
        postModel.findWithOriginal(idPubli);

    if (!publication) {
        throw new Error('Publication introuvable');
    }

    if (!peutVoirPublication(db, idPubli, idUser)) {
        throw new Error(
            'Vous n’avez pas accès à cette publication'
        );
    }

    if (
        publication.originalIdPubli &&
        !peutVoirPublication(
            db,
            publication.originalIdPubli,
            idUser
        )
    ) {
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

    return publication;
}

// Créer un Duo (reprend le média de l'original, ajoute le média
// propre de l'utilisateur, affichés côte à côte)
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

    const publicationOriginale =
        postModel.findById(idPubliOriginale);

    if (!publicationOriginale) {
        throw new Error('Publication originale introuvable');
    }

    if (visibilite !== 0 && visibilite !== 1) {
        throw new Error('Visibilité invalide');
    }

    if (!peutVoirPublication(db, idPubliOriginale, idUser)) {
        throw new Error(
            'Vous ne pouvez pas créer un Duo avec cette publication'
        );
    }

    if (!postModel.findPostById(idPubliOriginale)) {
        throw new Error(
            'Un Duo ne peut être créé qu’à partir d’une publication contenant une photo ou une vidéo'
        );
    }

    if (!nomMedia || !typeMedia) {
        throw new Error(
            'Ajoutez votre propre photo ou vidéo pour créer un Duo'
        );
    }

    return postModel.createDuo(
        idUser,
        idPubliOriginale,
        contenuPub,
        visibilite,
        nomMedia,
        typeMedia
    );
}

// Créer un collage (reprend la vidéo de l'original, ajoute la
// vidéo propre de l'utilisateur)
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

    const publicationOriginale =
        postModel.findById(idPubliOriginale);

    if (!publicationOriginale) {
        throw new Error('Publication originale introuvable');
    }

    if (visibilite !== 0 && visibilite !== 1) {
        throw new Error('Visibilité invalide');
    }

    if (!peutVoirPublication(db, idPubliOriginale, idUser)) {
        throw new Error(
            'Vous ne pouvez pas créer un collage avec cette publication'
        );
    }

    const mediaOriginal = postModel.findPostById(idPubliOriginale);

    if (!mediaOriginal || mediaOriginal.typeMedia !== 'video') {
        throw new Error(
            'Un collage ne peut être créé qu’à partir d’une publication contenant une vidéo'
        );
    }

    if (!nomMedia || typeMedia !== 'video') {
        throw new Error(
            'Ajoutez votre propre vidéo pour créer un collage'
        );
    }

    return postModel.createCollage(
        idUser,
        idPubliOriginale,
        contenuPub,
        visibilite,
        nomMedia,
        typeMedia
    );
}

// Récupérer la chaîne de remixes accessible par un utilisateur
function getRemixChainForUser(idPubli, idUser) {
    const chain = postModel.findRemixChain(idPubli);

    if (chain.length === 0) {
        throw new Error('Publication introuvable');
    }

    const chainAccessible = chain.filter(
        publication =>
            peutVoirPublication(
                db,
                publication.idPubli,
                idUser
            )
    );

    if (chainAccessible.length === 0) {
        throw new Error(
            'Vous n’avez pas accès à cette publication'
        );
    }

    return chainAccessible;
}

// Récupérer le fil d'actualité d'un utilisateur
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

    const idsDejaRepostes =
        postModel.findRepostedPubliIds(idUser);

    return publications
        .filter(publication =>
            peutVoirPublication(
                db,
                publication.idPubli,
                idUser
            )
        )
        .map(publication => {

            // Si la publication est basée sur une autre publication,
            // on vérifie que l'utilisateur peut également voir l'original.
            if (
                publication.originalIdPubli &&
                !peutVoirPublication(
                    db,
                    publication.originalIdPubli,
                    idUser
                )
            ) {
                publication = {
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

            // Récupération des likes / dislikes
            const reactions =
                reactionModel.getPostReactions(
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
    // Visibilité
    sontAmis,
    peutVoirPublication,
    modifierVisibilite,
    filtrerPublicationsVisibles,

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