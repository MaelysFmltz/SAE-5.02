const reportModel = require('../models/reportModel');

const TYPES_CONTENU_AUTORISES = [
    'publication',
    'commentaire',
    'utilisateur',
    'media'
];

function creerSignalement(db, idUserAuteur, typeContenu, idContenu, motif) {
    if (!Number.isInteger(idUserAuteur) || idUserAuteur <= 0) {
        return {
            succes: false,
            erreur: 'Utilisateur invalide'
        };
    }

    if (!TYPES_CONTENU_AUTORISES.includes(typeContenu)) {
        return {
            succes: false,
            erreur: 'Type de contenu invalide'
        };
    }

    if (!Number.isInteger(idContenu) || idContenu <= 0) {
        return {
            succes: false,
            erreur: 'Identifiant du contenu invalide'
        };
    }

    if (typeof motif !== 'string' || motif.trim() === '') {
        return {
            succes: false,
            erreur: 'Le motif est obligatoire'
        };
    }

    const utilisateur = db.prepare(`
        SELECT idUser
        FROM Utilisateur
        WHERE idUser = ?
    `).get(idUserAuteur);

    if (!utilisateur) {
        return {
            succes: false,
            erreur: 'Utilisateur introuvable'
        };
    }

    if (typeContenu === 'publication') {
        const publication = db.prepare(`
            SELECT idPubli
            FROM Publication
            WHERE idPubli = ?
        `).get(idContenu);

        if (!publication) {
            return {
                succes: false,
                erreur: 'Publication introuvable'
            };
        }
    }

    if (typeContenu === 'commentaire') {
        const commentaire = db.prepare(`
            SELECT idComm
            FROM Commentaire
            WHERE idComm = ?
        `).get(idContenu);

        if (!commentaire) {
            return {
                succes: false,
                erreur: 'Commentaire introuvable'
            };
        }
    }

    const idSignalement = reportModel.creerSignalement(
        db,
        idUserAuteur,
        typeContenu,
        idContenu,
        motif.trim()
    );

    return {
        succes: true,
        idSignalement
    };
}

function obtenirSignalement(db, idSignalement) {
    if (!Number.isInteger(idSignalement) || idSignalement <= 0) {
        return null;
    }

    return reportModel.trouverSignalementParId(db, idSignalement) || null;
}

function obtenirSignalements(db) {
    return reportModel.trouverSignalements(db);
}

function modifierStatutSignalement(db, idSignalement, statut) {
    const STATUTS_AUTORISES = [
        'traite',
        'rejete'
    ];

    if (!Number.isInteger(idSignalement) || idSignalement <= 0) {
        return {
            succes: false,
            erreur: 'Identifiant du signalement invalide'
        };
    }

    if (!STATUTS_AUTORISES.includes(statut)) {
        return {
            succes: false,
            erreur: 'Statut invalide'
        };
    }

    const signalement = reportModel.trouverSignalementParId(
        db,
        idSignalement
    );

    if (!signalement) {
        return {
            succes: false,
            erreur: 'Signalement introuvable'
        };
    }

    reportModel.modifierStatutSignalement(
        db,
        idSignalement,
        statut
    );

    return {
        succes: true
    };
}


module.exports = {
    creerSignalement,
    obtenirSignalement,
    obtenirSignalements,
    modifierStatutSignalement
};