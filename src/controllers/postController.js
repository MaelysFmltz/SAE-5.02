const postService = require('../services/postService');

function createPublication(req, res) {
    try {
        const { contenuPub, visibilite, idPubliPartagee } = req.body;

        const publication = postService.createPublication(
            req.user.idUser,
            contenuPub,
            visibilite,
            idPubliPartagee || null
        );

        return res.status(201).json({
            message: 'Publication créée avec succès',
            publication
        });
    } catch (error) {
        return res.status(400).json({
            error: error.message
        });
    }
}

function createRepost(req, res) {
    try {
        const { visibilite } = req.body;

        const publication = postService.createRepost(
            req.user.idUser,
            req.params.idPubli,
            visibilite
        );

        return res.status(201).json({
            message: 'Publication repartagée avec succès',
            publication
        });
    } catch (error) {
        return res.status(400).json({
            error: error.message
        });
    }
}

// Créer un Duo
function createDuo(req, res) {
    try {
        const { contenuPub, visibilite } = req.body;

        const publication = postService.createDuo(
            req.user.idUser,
            req.params.idPubli,
            contenuPub,
            visibilite
        );

        return res.status(201).json({
            message: 'Duo créé avec succès',
            publication
        });
    } catch (error) {
        return res.status(400).json({
            error: error.message
        });
    }
}

// Créer un collage
function createCollage(req, res) {
    try {
        const { contenuPub, visibilite } = req.body;

        const publication = postService.createCollage(
            req.user.idUser,
            req.params.idPubli,
            contenuPub,
            visibilite
        );

        return res.status(201).json({
            message: 'Collage créé avec succès',
            publication
        });
    } catch (error) {
        return res.status(400).json({
            error: error.message
        });
    }
}

function getPublication(req, res) {
    try {
        const publication = postService.getPublication(
            req.params.idPubli
        );

        return res.status(200).json(publication);
    } catch (error) {
        return res.status(404).json({
            error: error.message
        });
    }
}

// Générer un lien de partage
function sharePublication(req, res) {
    try {
        const idPubli = Number(req.params.idPubli);

        const publication = postService.getPublicationForUser(
            idPubli,
            req.user.idUser
        );

        const baseUrl = `${req.protocol}://${req.get('host')}`;

        const shareUrl =
            `${baseUrl}/api/publications/${publication.idPubli}`;

        return res.status(200).json({
            message: 'Lien de partage généré',
            url: shareUrl
        });
    } catch (error) {
        return res.status(404).json({
            error: error.message
        });
    }
}

// Récupérer la chaîne complète des remixes
function getRemixChain(req, res) {
    try {
        const idPubli = Number(req.params.idPubli);

        const chain = postService.getRemixChainForUser(
            idPubli,
            req.user.idUser
        );

        return res.status(200).json({
            publication: idPubli,
            chain
        });
    } catch (error) {
        return res.status(404).json({
            error: error.message
        });
    }
}

module.exports = {
    createPublication,
    createRepost,
    createDuo,
    createCollage,
    getPublication,
    sharePublication,
    getRemixChain
};