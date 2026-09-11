const db = require('../config/database');
const reportService = require('../services/reportService');

function creerSignalement(req, res) {
    const idUserAuteur = req.user?.idUser;
    const { typeContenu, idContenu, motif } = req.body;

    const resultat = reportService.creerSignalement(
        db,
        idUserAuteur,
        typeContenu,
        Number(idContenu),
        motif
    );

    if (!resultat.succes) {
        return res.status(400).json({
            erreur: resultat.erreur
        });
    }

    return res.status(201).json({
        message: 'Signalement enregistré',
        idSignalement: resultat.idSignalement
    });
}

function obtenirSignalement(req, res) {
    const idSignalement = Number(req.params.idSignalement);

    const signalement = reportService.obtenirSignalement(
        db,
        idSignalement
    );

    if (!signalement) {
        return res.status(404).json({
            erreur: 'Signalement introuvable'
        });
    }

    return res.status(200).json(signalement);
}

function obtenirSignalements(req, res) {
    const signalements = reportService.obtenirSignalements(db);

    return res.status(200).json(signalements);
}

module.exports = {
    creerSignalement,
    obtenirSignalement,
    obtenirSignalements
};