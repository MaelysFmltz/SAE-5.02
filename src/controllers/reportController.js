const db = require('../config/database');
const reportService = require('../services/reportService');

// Migration à chaud : garantit l'existence de la colonne reponseModeration si la table existe
try {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Signalement'").get();
    if (tableExists) {
        const tableInfo = db.prepare("PRAGMA table_info(Signalement)").all();
        const hasReponseCol = tableInfo.some(col => col.name === 'reponseModeration');
        if (!hasReponseCol) {
            db.prepare("ALTER TABLE Signalement ADD COLUMN reponseModeration TEXT").run();
        }
    }
} catch (e) {
    // Silencieux si la base n'est pas encore initialisée (cas des mocks ou tests mémoire)
}

function enrichirSignalement(signalement) {
    if (!signalement) return null;

    let auteurPseudo = signalement.auteurPseudo || null;
    let ciblePseudo = signalement.ciblePseudo || null;
    let apercuContenu = signalement.apercuContenu || null;

    try {
        if (!auteurPseudo && signalement.idUserAuteur) {
            const auteur = db.prepare('SELECT pseudo FROM Utilisateur WHERE idUser = ?').get(signalement.idUserAuteur);
            auteurPseudo = auteur ? auteur.pseudo : null;
        }

        if (signalement.typeContenu === 'utilisateur') {
            const cible = db.prepare('SELECT pseudo FROM Utilisateur WHERE idUser = ?').get(signalement.idContenu);
            ciblePseudo = cible ? cible.pseudo : null;
        } else if (signalement.typeContenu === 'publication') {
            const publi = db.prepare(`
                SELECT p.contenuPub, u.pseudo 
                FROM Publication p 
                LEFT JOIN Utilisateur u ON p.idUser = u.idUser 
                WHERE p.idPubli = ?
            `).get(signalement.idContenu);
            if (publi) {
                ciblePseudo = publi.pseudo;
                apercuContenu = publi.contenuPub;
            }
        } else if (signalement.typeContenu === 'commentaire') {
            const comm = db.prepare(`
                SELECT c.contenuCom, u.pseudo 
                FROM Commentaire c 
                LEFT JOIN Utilisateur u ON c.idUser = u.idUser 
                WHERE c.idComm = ?
            `).get(signalement.idContenu);
            if (comm) {
                ciblePseudo = comm.pseudo;
                apercuContenu = comm.contenuCom;
            }
        } else if (signalement.typeContenu === 'message') {
            const msg = db.prepare(`
                SELECT m.contenu, u.pseudo 
                FROM Message m 
                LEFT JOIN Utilisateur u ON m.idUser = u.idUser 
                WHERE m.idMessage = ?
            `).get(signalement.idContenu);
            if (msg) {
                ciblePseudo = msg.pseudo;
                apercuContenu = msg.contenu;
            }
        }
    } catch (err) {
        // Ignorer si les tables associées ne sont pas chargées
    }

    return {
        ...signalement,
        auteurPseudo,
        ciblePseudo,
        apercuContenu,
        reponseModeration: signalement.reponseModeration || null
    };
}

function creerSignalement(req, res) {
    const idUserAuteur = req.user?.idUser;
    const { typeContenu, idContenu, motif, description, details, commentaire } = req.body;

    const texteLibre = (description || details || commentaire || '').trim();
    let motifFinal = (motif || '').trim();

    if (texteLibre && texteLibre !== motifFinal) {
        motifFinal = motifFinal ? `${motifFinal} — ${texteLibre}` : texteLibre;
    }

    if (!motifFinal) {
        return res.status(400).json({ erreur: 'Le motif du signalement est obligatoire.' });
    }

    const resultat = reportService.creerSignalement(
        db,
        idUserAuteur,
        typeContenu,
        Number(idContenu),
        motifFinal
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
        idSignalement,
        req.user?.idUser
    );

    if (!signalement) {
        return res.status(404).json({
            erreur: 'Signalement introuvable'
        });
    }

    return res.status(200).json(enrichirSignalement(signalement));
}

function obtenirSignalements(req, res) {
    const signalements = reportService.obtenirSignalements(
        db,
        req.user?.idUser
    );

    const enrichis = Array.isArray(signalements)
        ? signalements.map(enrichirSignalement)
        : [];

    return res.status(200).json(enrichis);
}

function obtenirMesSignalements(req, res) {
    const mesSignalements = reportService.obtenirMesSignalements(
        db,
        req.user?.idUser
    );

    const enrichis = Array.isArray(mesSignalements)
        ? mesSignalements.map(enrichirSignalement)
        : [];

    return res.status(200).json(enrichis);
}

function modifierStatutSignalement(req, res) {
    const idSignalement = Number(req.params.idSignalement);
    const { statut, reponseModeration, message, commentaire } = req.body;

    const texteReponse = (reponseModeration || message || commentaire || '').trim();

    const resultat = reportService.modifierStatutSignalement(
        db,
        idSignalement,
        statut,
        req.user?.idUser
    );

    if (!resultat.succes) {
        return res.status(resultat.code || 400).json({
            erreur: resultat.erreur
        });
    }

    if (texteReponse) {
        try {
            db.prepare('UPDATE Signalement SET reponseModeration = ? WHERE idSignalement = ?')
              .run(texteReponse, idSignalement);
        } catch (err) {
            console.error('Erreur mise à jour reponseModeration :', err);
        }
    }

    return res.status(200).json({
        message: 'Statut du signalement modifié avec succès'
    });
}

module.exports = {
    creerSignalement,
    obtenirSignalement,
    obtenirSignalements,
    obtenirMesSignalements,
    modifierStatutSignalement
};