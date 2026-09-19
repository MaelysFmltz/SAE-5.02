/**
 * Vérifie si une colonne existe dans une table donnée.
 */
function colonneExiste(db, table, nomColonne) {
    const colonnes = db.prepare(`PRAGMA table_info(${table})`).all();
    return colonnes.some(c => c.name === nomColonne);
}

/**
 * Crée un signalement pour tout type de contenu.
 */
function creerSignalement(db, idUserAuteur, typeContenu, idContenu, motif) {
    const requete = db.prepare(`
        INSERT INTO Signalement (
            idUserAuteur,
            typeContenu,
            idContenu,
            motif
        )
        VALUES (?, ?, ?, ?)
    `);

    const resultat = requete.run(
        idUserAuteur,
        typeContenu,
        idContenu,
        motif
    );

    return resultat.lastInsertRowid;
}

/**
 * Recherche un signalement par son ID.
 */
function trouverSignalementParId(db, idSignalement) {
    const avecPseudo = colonneExiste(db, 'Utilisateur', 'pseudo');

    if (avecPseudo) {
        return db.prepare(`
            SELECT
                s.*,
                u.pseudo AS auteurPseudo
            FROM Signalement s
            LEFT JOIN Utilisateur u ON s.idUserAuteur = u.idUser
            WHERE s.idSignalement = ?
        `).get(idSignalement);
    }

    return db.prepare(`
        SELECT *
        FROM Signalement
        WHERE idSignalement = ?
    `).get(idSignalement);
}

/**
 * Récupère tous les signalements pour la modération.
 */
function trouverSignalements(db) {
    const avecPseudo = colonneExiste(db, 'Utilisateur', 'pseudo');

    if (avecPseudo) {
        return db.prepare(`
            SELECT
                s.*,
                u.pseudo AS auteurPseudo
            FROM Signalement s
            LEFT JOIN Utilisateur u ON s.idUserAuteur = u.idUser
            ORDER BY 
                CASE s.statut 
                    WHEN 'en_attente' THEN 1 
                    ELSE 2 
                END,
                s.dateSignalement DESC
        `).all();
    }

    return db.prepare(`
        SELECT *
        FROM Signalement
        ORDER BY 
            CASE statut 
                WHEN 'en_attente' THEN 1 
                ELSE 2 
            END,
            dateSignalement DESC
    `).all();
}

/**
 * Récupère les tickets créés par un utilisateur spécifique.
 */
function trouverSignalementsParAuteur(db, idUserAuteur) {
    return db.prepare(`
        SELECT *
        FROM Signalement
        WHERE idUserAuteur = ?
        ORDER BY dateSignalement DESC
    `).all(idUserAuteur);
}

/**
 * Vérifie si un utilisateur a déjà signalé ce contenu.
 */
function trouverSignalementExistant(db, idUserAuteur, typeContenu, idContenu) {
    return db.prepare(`
        SELECT idSignalement
        FROM Signalement
        WHERE idUserAuteur = ?
          AND typeContenu = ?
          AND idContenu = ?
    `).get(idUserAuteur, typeContenu, idContenu);
}

/**
 * Met à jour le statut du ticket (compatible schéma standard et étendu).
 */
function modifierStatutSignalement(db, idSignalement, statut, idModerateur = null) {
    const supporteModerateur = colonneExiste(db, 'Signalement', 'idModerateur');

    if (supporteModerateur && idModerateur !== null) {
        return db.prepare(`
            UPDATE Signalement
            SET statut = ?,
                idModerateur = ?,
                dateTraitement = CURRENT_TIMESTAMP
            WHERE idSignalement = ?
        `).run(statut, idModerateur, idSignalement);
    }

    return db.prepare(`
        UPDATE Signalement
        SET statut = ?
        WHERE idSignalement = ?
    `).run(statut, idSignalement);
}

/**
 * Récupère l'auteur du contenu signalé selon le type d'entité.
 */
function trouverAuteurContenu(db, typeContenu, idContenu) {
    switch (typeContenu) {
        case 'publication': {
            const row = db.prepare('SELECT idUser FROM Publication WHERE idPubli = ?').get(idContenu);
            return row ? row.idUser : null;
        }
        case 'commentaire': {
            const row = db.prepare('SELECT idUser FROM Commentaire WHERE idComm = ?').get(idContenu);
            return row ? row.idUser : null;
        }
        case 'utilisateur':
            return idContenu;
        case 'media': {
            const row = db.prepare(`
                SELECT p.idUser 
                FROM Media m 
                JOIN Publication p ON m.idPubli = p.idPubli 
                WHERE m.idMedia = ?
            `).get(idContenu);
            return row ? row.idUser : null;
        }
        case 'message': {
            const row = db.prepare('SELECT idUserExpediteur AS idUser FROM Message WHERE idMessage = ?').get(idContenu);
            return row ? row.idUser : null;
        }
        default:
            return null;
    }
}

module.exports = {
    creerSignalement,
    trouverSignalementParId,
    trouverSignalements,
    trouverSignalementsParAuteur,
    trouverSignalementExistant,
    modifierStatutSignalement,
    trouverAuteurContenu
};