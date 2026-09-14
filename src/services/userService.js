const userModel = require('../models/userModel');

const STATUTS_AUTORISES = [
    'actif',
    'suspendu',
    'supprime'
];

function obtenirUtilisateurs(db) {
    return userModel.obtenirUtilisateurs(db);
}

function modifierStatut(db, idUser, statut, idUserModificateur) {
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

    if (
        ['suspendu', 'supprime'].includes(statut) &&
        idUser === idUserModificateur
    ) {
        return {
            succes: false,
            erreur: 'Un administrateur ne peut pas modifier son propre statut'
        };
    }

    const utilisateur = userModel.findById(db, idUser);

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