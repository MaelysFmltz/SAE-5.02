function sontAmis(db, idUser1, idUser2) {
    const resultat = db.prepare(`
        SELECT COUNT(*) AS nombre
        FROM Abonnement a1
        JOIN Abonnement a2
            ON a1.idUserAbonne = a2.idUserSuivi
            AND a1.idUserSuivi = a2.idUserAbonne
        WHERE a1.idUserAbonne = ?
        AND a1.idUserSuivi = ?
    `).get(idUser1, idUser2);

    return resultat.nombre > 0;
}

function suivre(db, idUser, idUserCible) {
    if (idUser === idUserCible) {
        return false;
    }

    const cible = db.prepare(`
        SELECT idUser
        FROM Utilisateur
        WHERE idUser = ?
    `).get(idUserCible);

    if (!cible) {
        return false;
    }

    const dejaAbonne = db.prepare(`
        SELECT 1
        FROM Abonnement
        WHERE idUserAbonne = ?
        AND idUserSuivi = ?
    `).get(idUser, idUserCible);

    if (!dejaAbonne) {
        db.prepare(`
            INSERT INTO Abonnement (idUserAbonne, idUserSuivi)
            VALUES (?, ?)
        `).run(idUser, idUserCible);
    }

    return true;
}

function neplusSuivre(db, idUser, idUserCible) {
    const resultat = db.prepare(`
        DELETE FROM Abonnement
        WHERE idUserAbonne = ?
        AND idUserSuivi = ?
    `).run(idUser, idUserCible);

    return resultat.changes > 0;
}

function listerAmis(db, idUser) {
    return db.prepare(`
        SELECT u.idUser, u.pseudo
        FROM Abonnement a1
        JOIN Abonnement a2
            ON a1.idUserAbonne = a2.idUserSuivi
            AND a1.idUserSuivi = a2.idUserAbonne
        JOIN Utilisateur u
            ON u.idUser = a1.idUserSuivi
        WHERE a1.idUserAbonne = ?
    `).all(idUser);
}

function listerAbonnements(db, idUser) {
    return db.prepare(`
        SELECT u.idUser, u.pseudo
        FROM Abonnement a
        JOIN Utilisateur u
            ON u.idUser = a.idUserSuivi
        WHERE a.idUserAbonne = ?
    `).all(idUser);
}

function listerAbonnes(db, idUser) {
    return db.prepare(`
        SELECT u.idUser, u.pseudo
        FROM Abonnement a
        JOIN Utilisateur u
            ON u.idUser = a.idUserAbonne
        WHERE a.idUserSuivi = ?
    `).all(idUser);
}

module.exports = {
    sontAmis,
    suivre,
    neplusSuivre,
    listerAmis,
    listerAbonnements,
    listerAbonnes
};
