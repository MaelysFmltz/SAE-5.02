const db = require('../config/database');
const postModel = require('../models/postModel');
const userModel = require('../models/userModel');

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
// ================================
// PARTIE 6 : PUBLICATIONS
// ================================

function createPublication(
    idUser,
    contenuPub,
    visibilite = 1,
    idPubliPartagee = null
) {
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
function createRepost(idUser, idPubliPartagee, visibilite = 1) {
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

// Récupérer une publication
function getPublication(idPubli) {
    const publication = postModel.findWithOriginal(idPubli);

    if (!publication) {
        throw new Error('Publication introuvable');
    }

    return publication;
}

// Récupérer une publication accessible par un utilisateur
function getPublicationForUser(idPubli, idUser) {
    const publication = postModel.findWithOriginal(idPubli);

    if (!publication) {
        throw new Error('Publication introuvable');
    }

    if (!peutVoirPublication(db, idPubli, idUser)) {
        throw new Error(
            'Vous n’avez pas accès à cette publication'
        );
    }

    return publication;
}

// Créer un Duo
function createDuo(
    idUser,
    idPubliOriginale,
    contenuPub,
    visibilite = 1
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
        throw new Error(
            'Vous ne pouvez pas créer un Duo avec cette publication'
        );
    }

    return postModel.createDuo(
        idUser,
        idPubliOriginale,
        contenuPub,
        visibilite
    );
}

// Créer un collage
function createCollage(
    idUser,
    idPubliOriginale,
    contenuPub,
    visibilite = 1
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
        throw new Error(
            'Vous ne pouvez pas créer un collage avec cette publication'
        );
    }

    return postModel.createCollage(
        idUser,
        idPubliOriginale,
        contenuPub,
        visibilite
    );
}

// Récupérer la chaîne de remixes accessible par un utilisateur
function getRemixChainForUser(idPubli, idUser) {
    const chain = postModel.findRemixChain(idPubli);

    if (chain.length === 0) {
        throw new Error('Publication introuvable');
    }

    const chainAccessible = chain.filter(publication =>
        peutVoirPublication(db, publication.idPubli, idUser)
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
            p.contenuPub,
            p.visibilite,
            p.idPubliPartagee,
            p.typePublication,
            p.datePubli,

            u.pseudo AS auteurPseudo,

            original.idPubli AS originalIdPubli,
            original.idUser AS originalIdUser,
            original.contenuPub AS originalContenuPub,
            original.visibilite AS originalVisibilite,
            original.typePublication AS originalTypePublication,

            originalUser.pseudo AS auteurOriginalPseudo

        FROM Publication p

        JOIN Utilisateur u
            ON p.idUser = u.idUser

        LEFT JOIN Publication original
            ON p.idPubliPartagee = original.idPubli

        LEFT JOIN Utilisateur originalUser
            ON original.idUser = originalUser.idUser

        ORDER BY p.datePubli DESC
    `).all();

    return publications
        .filter(publication =>
            peutVoirPublication(db, publication.idPubli, idUser)
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
                return {
                    ...publication,
                    originalIdPubli: null,
                    originalIdUser: null,
                    originalContenuPub: null,
                    originalVisibilite: null,
                    originalTypePublication: null,
                    auteurOriginalPseudo: null
                };
            }

            return publication;
        });
}
module.exports = {
    sontAmis,
    peutVoirPublication,
    modifierVisibilite,
    createPublication,
    createRepost,
    getPublication,
    getPublicationForUser,
    createDuo,
    createCollage,
    getRemixChainForUser,
    getFeedForUser
};