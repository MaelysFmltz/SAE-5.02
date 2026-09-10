const db = require('../config/database');
const { peutVoirPublication } = require('../services/postService');

function publicationPermissionMiddleware(req, res, next) {
    const idPubli = Number(req.params.idPubli);

    const idUser = req.user?.idUser;

    if (!idUser) {
        return res.status(401).json({
            error: 'Utilisateur non authentifié'
        });
    }

    if (!Number.isInteger(idPubli)) {
        return res.status(400).json({
            error: 'Identifiant de publication invalide'
        });
    }

    const autorise = peutVoirPublication(db, idPubli, idUser);

    if (!autorise) {
        return res.status(403).json({
            error: 'Vous n’avez pas accès à cette publication'
        });
    }

    next();
}

module.exports = publicationPermissionMiddleware;