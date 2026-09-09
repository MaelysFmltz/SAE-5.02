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

function peutVoirPublication(db, idPubli, idUser) {
    const publication = db.prepare(`
        SELECT idUser, visibilite
        FROM Publication
        WHERE idPubli = ?
    `).get(idPubli);

    if (!publication) {
        return false;
    }

    if (publication.visibilite === 1) {
        return true;
    }

    if (publication.idUser === idUser) {
        return true;
    }

    return sontAmis(db, publication.idUser, idUser);
}

function modifierVisibilite(db, idPubli, idUser, nouvelleVisibilite) {
    if (nouvelleVisibilite !== 0 && nouvelleVisibilite !== 1) {
        return false;
    }

    const publication = db.prepare(`
        SELECT idUser
        FROM Publication
        WHERE idPubli = ?
    `).get(idPubli);

    if (!publication) {
        return false;
    }

    if (publication.idUser !== idUser) {
        return false;
    }

    db.prepare(`
        UPDATE Publication
        SET visibilite = ?
        WHERE idPubli = ?
    `).run(nouvelleVisibilite, idPubli);

    return true;
}

module.exports = {
    sontAmis,
    peutVoirPublication,
    modifierVisibilite
};