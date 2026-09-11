const postModel = require('../models/postModel');

function obtenirAuteurOriginal(db, idPubli) {
    if (!Number.isInteger(idPubli) || idPubli <= 0) {
        return null;
    }

    return postModel.trouverAuteurOriginal(db, idPubli);
}

function supprimerPublication(db, idPubli) {
    if (!Number.isInteger(idPubli) || idPubli <= 0) {
        return {
            succes: false,
            erreur: 'Identifiant de publication invalide'
        };
    }

    const publication = db.prepare(`
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

    postModel.supprimerPublication(db, idPubli);

    return {
        succes: true
    };
}

module.exports = {
    obtenirAuteurOriginal,
    supprimerPublication
};