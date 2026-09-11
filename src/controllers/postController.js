const db = require('../config/database');
const postService = require('../services/postService');

function supprimerPublication(req, res) {
    const idPubli = Number(req.params.idPubli);

    const resultat = postService.supprimerPublication(
        db,
        idPubli
    );

    if (!resultat.succes) {
        return res.status(404).json({
            erreur: resultat.erreur
        });
    }

    return res.status(200).json({
        message: 'Publication supprimée'
    });
}

module.exports = {
    supprimerPublication
};