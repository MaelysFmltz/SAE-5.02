const db = require('../config/database');
const userService = require('../services/userService');

function obtenirUtilisateurs(req, res) {
    const utilisateurs = userService.obtenirUtilisateurs(db);

    return res.status(200).json(utilisateurs);
}

function modifierStatutUtilisateur(req, res) {
    const idUser = Number(req.params.idUser);
    const { statut } = req.body;

    const resultat = userService.modifierStatut(
        db,
        idUser,
        statut
    );

    if (!resultat.succes) {
        return res.status(400).json({
            erreur: resultat.erreur
        });
    }

    return res.status(200).json({
        message: 'Statut utilisateur modifié'
    });
}

module.exports = {
    obtenirUtilisateurs,
    modifierStatutUtilisateur
};