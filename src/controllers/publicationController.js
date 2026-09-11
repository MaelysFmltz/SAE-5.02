const db = require('../config/database');

function obtenirPublication(req, res) {
    const idPubli = Number(req.params.idPubli);

    const publication = db.prepare(`
        SELECT
            idPubli,
            idUser,
            contenuPub,
            visibilite,
            datePubli,
            dateModif
        FROM Publication
        WHERE idPubli = ?
    `).get(idPubli);

    if (!publication) {
        return res.status(404).json({
            error: 'Publication introuvable'
        });
    }

    return res.status(200).json(publication);
}

function modifierVisibilite(req, res) {
    const idPubli = Number(req.params.idPubli);
    const idUser = req.user.idUser;
    const visibilite = Number(req.body.visibilite);

    const publication = db.prepare(`
        SELECT idUser
        FROM Publication
        WHERE idPubli = ?
    `).get(idPubli);

    if (!publication) {
        return res.status(404).json({
            error: 'Publication introuvable'
        });
    }

    if (publication.idUser !== idUser) {
        return res.status(403).json({
            error: 'Vous ne pouvez pas modifier cette publication'
        });
    }

    if (visibilite !== 0 && visibilite !== 1) {
        return res.status(400).json({
            error: 'Visibilité invalide'
        });
    }

    db.prepare(`
        UPDATE Publication
        SET visibilite = ?
        WHERE idPubli = ?
    `).run(visibilite, idPubli);

    return res.status(200).json({
        message: 'Visibilité modifiée'
    });
}

module.exports = {
    obtenirPublication,
    modifierVisibilite
};