const db = require('../config/database');
const postModel = require('../models/postModel');
const hashtagModel = require('../models/hashtagModel');
const { extractHashtags } = require('../utils/hashtagUtils');

function creerPublication(req, res) {
    const idUser = req.user.idUser;

    const {
        contenuPub,
        visibilite = 1
    } = req.body;

    if (!contenuPub || !contenuPub.trim()) {
        return res.status(400).json({
            error: 'Le contenu de la publication est obligatoire'
        });
    }

    try {
        const publication = postModel.createPublication(
            idUser,
            contenuPub.trim(),
            Number(visibilite)
        );

        // Détection et enregistrement des hashtags dans PubliHashtag
        const hashtags = extractHashtags(contenuPub);
        if (hashtags.length > 0) {
            hashtagModel.associerHashtagsPubli(db, publication.idPubli, hashtags);
        }

        return res.status(201).json(publication);

    } catch (error) {
        console.error('Erreur création publication :', error);

        return res.status(500).json({
            error: 'Impossible de créer la publication'
        });
    }
}

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
    creerPublication,
    obtenirPublication,
    modifierVisibilite
};