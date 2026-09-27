const reportModel = require('../models/reportModel');

const TYPES_CONTENU_AUTORISES = [
    'publication',
    'commentaire',
    'utilisateur',
    'media',
    'message'
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

    const motifNettoye = motif.trim();

    if (motifNettoye.length > 500) {
        return {
            succes: false,
            erreur: 'Le motif ne doit pas dépasser 500 caractères'
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

    const signalementExistant = reportModel.trouverSignalementExistant(
        db,
        idUserAuteur,
        typeContenu,
        idContenu
    );

    if (signalementExistant) {
        return {
            succes: false,
            erreur: 'Ce contenu a déjà été signalé par cet utilisateur'
        };
    }

    // Vérification de l'existence de l'entité signalée
    if (typeContenu === 'publication') {
        const publication = db.prepare('SELECT idPubli FROM Publication WHERE idPubli = ?').get(idContenu);
        if (!publication) {
            return { succes: false, erreur: 'Publication introuvable' };
        }
    }

    if (typeContenu === 'commentaire') {
        const commentaire = db.prepare('SELECT idComm FROM Commentaire WHERE idComm = ?').get(idContenu);
        if (!commentaire) {
            return { succes: false, erreur: 'Commentaire introuvable' };
        }
    }

    if (typeContenu === 'utilisateur') {
        const utilisateurSignale = db.prepare('SELECT idUser FROM Utilisateur WHERE idUser = ?').get(idContenu);
        if (!utilisateurSignale) {
            return { succes: false, erreur: 'Utilisateur introuvable' };
        }
    }

    if (typeContenu === 'media') {
        const media = db.prepare('SELECT idMedia FROM Media WHERE idMedia = ?').get(idContenu);
        if (!media) {
            return { succes: false, erreur: 'Media introuvable' };
        }
    }

    if (typeContenu === 'message') {
        const message = db.prepare('SELECT idMessage, idConversation FROM Message WHERE idMessage = ?').get(idContenu);
        if (!message) {
            return { succes: false, erreur: 'Message introuvable' };
        }

        const estMembreConversation = db.prepare(`
            SELECT 1 FROM ConversationMembre
            WHERE idConversation = ? AND idUser = ?
        `).get(message.idConversation, idUserAuteur);

        if (!estMembreConversation) {
            return { succes: false, erreur: 'Vous ne pouvez signaler que les messages de vos propres conversations' };
        }
    }

    const idSignalement = reportModel.creerSignalement(
        db,
        idUserAuteur,
        typeContenu,
        idContenu,
        motifNettoye
    );

    return {
        succes: true,
        idSignalement
    };
}

function obtenirUtilisateurCible(db, typeContenu, idContenu) {
    const idUser = reportModel.trouverAuteurContenu(db, typeContenu, idContenu);
    return idUser ? { idUser } : null;
}

function obtenirSignalement(db, idSignalement, idUserConnecte) {
    if (!Number.isInteger(idSignalement) || idSignalement <= 0) {
        return null;
    }

    const signalement = reportModel.trouverSignalementParId(db, idSignalement);
    if (!signalement) {
        return null;
    }

    const utilisateurCible = obtenirUtilisateurCible(
        db,
        signalement.typeContenu,
        signalement.idContenu
    );

    if (utilisateurCible && utilisateurCible.idUser === idUserConnecte) {
        return null;
    }

    return signalement;
}

function obtenirSignalements(db, idUserConnecte) {
    const signalements = reportModel.trouverSignalements(db);

    return signalements.filter((signalement) => {
        const utilisateurCible = obtenirUtilisateurCible(
            db,
            signalement.typeContenu,
            signalement.idContenu
        );

        return !utilisateurCible || utilisateurCible.idUser !== idUserConnecte;
    });
}

function obtenirMesSignalements(db, idUserConnecte) {
    if (!Number.isInteger(idUserConnecte) || idUserConnecte <= 0) {
        return [];
    }
    return reportModel.trouverSignalementsParAuteur(db, idUserConnecte);
}

function modifierStatutSignalement(db, idSignalement, statut, idUserConnecte) {
    const STATUTS_AUTORISES = ['traite', 'rejete', 'en_attente'];

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

    const signalement = reportModel.trouverSignalementParId(db, idSignalement);
    if (!signalement) {
        return {
            succes: false,
            erreur: 'Signalement introuvable'
        };
    }

    const utilisateurCible = obtenirUtilisateurCible(
        db,
        signalement.typeContenu,
        signalement.idContenu
    );

    if (utilisateurCible && utilisateurCible.idUser === idUserConnecte) {
        return {
            succes: false,
            erreur: 'Vous ne pouvez pas traiter un signalement qui vous concerne',
            code: 403
        };
    }

    reportModel.modifierStatutSignalement(
        db,
        idSignalement,
        statut,
        idUserConnecte
    );

    return {
        succes: true
    };
}

module.exports = {
    creerSignalement,
    obtenirSignalement,
    obtenirSignalements,
    obtenirMesSignalements,
    modifierStatutSignalement,
    obtenirUtilisateurCible
};