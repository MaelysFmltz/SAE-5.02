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

function trouverSignalementParId(db, idSignalement) {
    return db.prepare(`
        SELECT
            idSignalement,
            idUserAuteur,
            typeContenu,
            idContenu,
            motif,
            dateSignalement,
            statut
        FROM Signalement
        WHERE idSignalement = ?
    `).get(idSignalement);
}

function trouverSignalements(db) {
    return db.prepare(`
        SELECT
            idSignalement,
            idUserAuteur,
            typeContenu,
            idContenu,
            motif,
            dateSignalement,
            statut
        FROM Signalement
        ORDER BY dateSignalement DESC
    `).all();
}

module.exports = {
    creerSignalement,
    trouverSignalementParId,
    trouverSignalements
};