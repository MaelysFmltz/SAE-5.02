function trouverAuteurOriginal(db, idPubli) {
    let publication = db.prepare(`
        SELECT idPubli, idUser, idPubliPartagee
        FROM Publication
        WHERE idPubli = ?
    `).get(idPubli);

    if (!publication) {
        return null;
    }

    while (publication.idPubliPartagee) {
        publication = db.prepare(`
            SELECT idPubli, idUser, idPubliPartagee
            FROM Publication
            WHERE idPubli = ?
        `).get(publication.idPubliPartagee);

        if (!publication) {
            return null;
        }
    }

    return publication.idUser;
}

function supprimerPublication(db, idPubli) {
    return db.prepare(`
        DELETE FROM Publication
        WHERE idPubli = ?
    `).run(idPubli);
}



module.exports = {
    trouverAuteurOriginal,
    supprimerPublication
};