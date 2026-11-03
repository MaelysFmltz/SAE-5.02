const db = require('../config/database');
const postModel = require('../models/postModel');
const hashtagModel = require('../models/hashtagModel');
const {
    extractHashtags
} = require('../utils/hashtagUtils');

const postService = require('../services/postService');
const { modifierVisibilite: modifierVisibiliteService } = postService;

function creerPublication(req, res) {
    const idUser = req.user.idUser;

    const {
        contenuPub,
        visibilite = 1
    } = req.body;
    const commentairesActifs = req.body.commentairesActifs === undefined
        ? 1
        : Number(req.body.commentairesActifs);

    if (commentairesActifs !== 0 && commentairesActifs !== 1) {
        return res.status(400).json({ error: 'État des commentaires invalide' });
    }

    if (!contenuPub || !contenuPub.trim()) {
        return res.status(400).json({
            error: 'Le contenu de la publication est obligatoire'
        });
    }

    try {
        const publication = postModel.createPublication(
            idUser,
            contenuPub.trim(),
            Number(visibilite),
            null,
            'original',
            commentairesActifs
        );

        // Détection et enregistrement des hashtags dans PubliHashtag
        const hashtags = extractHashtags(contenuPub);

        if (hashtags.length > 0) {
            hashtagModel.associerHashtagsPubli(
                db,
                publication.idPubli,
                hashtags
            );
        }

        return res.status(201).json(publication);

    } catch (error) {
        console.error(
            'Erreur création publication :',
            error
        );

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
            commentairesActifs,
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

function modifierLegende(req, res) {
    const idPubli = Number(req.params.idPubli);
    const idUser = req.user.idUser;
    const rawCaption = req.body?.contenuPub;

    if (!Number.isInteger(idPubli) || idPubli <= 0) {
        return res.status(400).json({ error: 'Identifiant de publication invalide' });
    }
    if (rawCaption !== null && rawCaption !== undefined && typeof rawCaption !== 'string') {
        return res.status(400).json({ error: 'La légende doit être une chaîne de caractères' });
    }

    const contenuPub = typeof rawCaption === 'string' ? rawCaption.trim() : null;
    if (contenuPub && contenuPub.length > 5000) {
        return res.status(400).json({ error: 'La légende ne peut pas dépasser 5000 caractères' });
    }

    try {
        const publication = postService.modifierLegendePublication(
            idPubli,
            idUser,
            contenuPub || null
        );
        const hashtagTablesExist = db.prepare(`
            SELECT COUNT(*) AS total
            FROM sqlite_master
            WHERE type = 'table' AND name IN ('Hashtag', 'PubliHashtag')
        `).get().total === 2;
        if (hashtagTablesExist) {
            hashtagModel.associerHashtagsPubli(
                db,
                idPubli,
                contenuPub ? extractHashtags(contenuPub) : []
            );
        }
        return res.status(200).json({
            message: contenuPub ? 'Légende mise à jour' : 'Légende supprimée',
            contenuPub: contenuPub || null,
            dateModif: publication.dateModif
        });
    } catch (error) {
        return res.status(error.status || (error.message === 'Publication introuvable' ? 404 : 400)).json({
            error: error.message
        });
    }
}

function modifierCommentaires(req, res) {
    const idPubli = Number(req.params.idPubli);
    const rawValue = req.body?.commentairesActifs;

    if (!Number.isInteger(idPubli) || idPubli <= 0) {
        return res.status(400).json({ error: 'Identifiant de publication invalide' });
    }

    let enabled;
    if (rawValue === true || rawValue === 1 || rawValue === '1' || rawValue === 'true') enabled = true;
    else if (rawValue === false || rawValue === 0 || rawValue === '0' || rawValue === 'false') enabled = false;
    else return res.status(400).json({ error: 'État des commentaires invalide' });

    try {
        const result = postService.modifierEtatCommentaires(
            idPubli,
            req.user.idUser,
            enabled
        );
        return res.status(200).json({
            message: enabled ? 'Commentaires activés' : 'Commentaires désactivés',
            ...result
        });
    } catch (error) {
        return res.status(error.status || (error.message === 'Publication introuvable' ? 404 : 400)).json({
            error: error.message
        });
    }
}

function modifierVisibilite(req, res) {
    const idPubli = Number(req.params.idPubli);
    const idUser = req.user.idUser;
    const visibilite = Number(req.body.visibilite);

    if (!Number.isInteger(idPubli)) {
        return res.status(400).json({
            error: 'Identifiant de publication invalide'
        });
    }

    if (visibilite !== 0 && visibilite !== 1) {
        return res.status(400).json({
            error: 'Visibilité invalide'
        });
    }

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

    modifierVisibiliteService(
        db,
        idPubli,
        idUser,
        visibilite
    );

    return res.status(200).json({
        message: 'Visibilité modifiée'
    });
}

module.exports = {
    creerPublication,
    obtenirPublication,
    modifierVisibilite,
    modifierLegende,
    modifierCommentaires
};