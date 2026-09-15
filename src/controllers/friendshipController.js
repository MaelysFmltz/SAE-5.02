const db = require('../config/database');
const friendshipService = require('../services/friendshipService');

function suivre(req, res) {
    const idUserCible = Number(req.params.idUserCible);

    if (!Number.isInteger(idUserCible)) {
        return res.status(400).json({
            error: 'Identifiant utilisateur invalide'
        });
    }

    const succes = friendshipService.suivre(
        db,
        req.user.idUser,
        idUserCible
    );

    if (!succes) {
        return res.status(400).json({
            error: 'Abonnement impossible'
        });
    }

    res.status(200).json({
        message: 'Abonnement effectué'
    });
}

function neplusSuivre(req, res) {
    const idUserCible = Number(req.params.idUserCible);

    if (!Number.isInteger(idUserCible)) {
        return res.status(400).json({
            error: 'Identifiant utilisateur invalide'
        });
    }

    const succes = friendshipService.neplusSuivre(
        db,
        req.user.idUser,
        idUserCible
    );

    if (!succes) {
        return res.status(404).json({
            error: "Vous ne suivez pas cet utilisateur"
        });
    }

    res.status(200).json({
        message: 'Désabonnement effectué'
    });
}

function listerAmis(req, res) {
    const idUser = Number(req.params.idUser);

    if (!Number.isInteger(idUser)) {
        return res.status(400).json({
            error: 'Identifiant utilisateur invalide'
        });
    }

    const amis = friendshipService.listerAmis(db, idUser);

    res.status(200).json({ amis });
}

function listerAbonnements(req, res) {
    const idUser = Number(req.params.idUser);

    if (!Number.isInteger(idUser)) {
        return res.status(400).json({
            error: 'Identifiant utilisateur invalide'
        });
    }

    const abonnements = friendshipService.listerAbonnements(db, idUser);

    res.status(200).json({ abonnements });
}

function listerAbonnes(req, res) {
    const idUser = Number(req.params.idUser);

    if (!Number.isInteger(idUser)) {
        return res.status(400).json({
            error: 'Identifiant utilisateur invalide'
        });
    }

    const abonnes = friendshipService.listerAbonnes(db, idUser);

    res.status(200).json({ abonnes });
}

module.exports = {
    suivre,
    neplusSuivre,
    listerAmis,
    listerAbonnements,
    listerAbonnes
};
