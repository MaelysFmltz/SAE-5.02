const userModel = require('../models/userModel');

const STATUTS_AUTORISES = [
    'actif',
    'suspendu',
    'supprime'
];

function obtenirUtilisateurs(db) {
    return userModel.obtenirUtilisateurs(db);
}

function modifierStatut(db, idUser, statut) {
    if (!Number.isInteger(idUser) || idUser <= 0) {
        return {
            succes: false,
            erreur: 'Identifiant utilisateur invalide'
        };
    }

    if (!STATUTS_AUTORISES.includes(statut)) {
        return {
            succes: false,
            erreur: 'Statut utilisateur invalide'
        };
    }

    const utilisateur = userModel.findById(idUser);

    if (!utilisateur) {
        return {
            succes: false,
            erreur: 'Utilisateur introuvable'
        };
    }

    userModel.modifierStatut(db, idUser, statut);

    return {
        succes: true
    };
}

module.exports = {
    obtenirUtilisateurs,
    modifierStatut
};