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

    // La publication n'existe pas
    if (!publication) {
        return false;
    }

    // Publication publique
    if (publication.visibilite === 1) {
        return true;
    }

    // Publication privée : seul l'auteur ou un ami peut la voir
    if (publication.idUser === idUser) {
        return true;
    }

    return sontAmis(db, publication.idUser, idUser);
}



function modifierVisibilite(db, idPubli, idUser, nouvelleVisibilite) {
    // La visibilité doit être 0 ou 1
    if (nouvelleVisibilite !== 0 && nouvelleVisibilite !== 1) {
        return false;
    }

    // Vérifier que la publication appartient à l'utilisateur
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

    // Modifier la visibilité
    db.prepare(`
        UPDATE Publication
        SET visibilite = ?
        WHERE idPubli = ?
    `).run(nouvelleVisibilite, idPubli);

    return true;
}

export { sontAmis, peutVoirPublication, modifierVisibilite };