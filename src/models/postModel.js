const db = require('../config/database');

// Créer une publication
function createPublication(
    idUser,
    contenuPub,
    visibilite = 1,
    idPubliPartagee = null,
    typePublication = 'original'
) {
    const stmt = db.prepare(`
        INSERT INTO Publication
        (idUser, contenuPub, visibilite, idPubliPartagee, typePublication)
        VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
        idUser,
        contenuPub,
        visibilite,
        idPubliPartagee,
        typePublication
    );

    return findById(result.lastInsertRowid);
}

// Récupérer une publication par son ID
function findById(idPubli) {
    return db.prepare(`
        SELECT *
        FROM Publication
        WHERE idPubli = ?
    `).get(idPubli);
}

// Récupérer l'auteur d'une publication
function findAuthor(idPubli) {
    return db.prepare(`
        SELECT
            u.idUser,
            u.pseudo
        FROM Publication p
        JOIN Utilisateur u
            ON p.idUser = u.idUser
        WHERE p.idPubli = ?
    `).get(idPubli);
}

// Récupérer une publication avec les informations de son original
function findWithOriginal(idPubli) {
    return db.prepare(`
        SELECT
            p.idPubli,
            p.idUser,
            p.contenuPub,
            p.visibilite,
            p.idPubliPartagee,
            p.typePublication,
            p.datePubli,
            p.dateModif,

            original.idPubli AS originalIdPubli,
            original.idUser AS originalIdUser,
            original.contenuPub AS originalContenuPub,
            original.visibilite AS originalVisibilite,
            original.typePublication AS originalTypePublication,

            u.pseudo AS auteurPseudo,
            originalUser.pseudo AS auteurOriginalPseudo

        FROM Publication p

        LEFT JOIN Publication original
            ON p.idPubliPartagee = original.idPubli

        JOIN Utilisateur u
            ON p.idUser = u.idUser

        LEFT JOIN Utilisateur originalUser
            ON original.idUser = originalUser.idUser

        WHERE p.idPubli = ?
    `).get(idPubli);
}

// Créer un repartage classique
function createRepost(
    idUser,
    idPubliPartagee,
    visibilite = 1
) {
    const stmt = db.prepare(`
        INSERT INTO Publication
        (idUser, contenuPub, visibilite, idPubliPartagee, typePublication)
        VALUES (?, NULL, ?, ?, 'repost')
    `);

    const result = stmt.run(
        idUser,
        visibilite,
        idPubliPartagee
    );

    return findById(result.lastInsertRowid);
}

// Créer une publication Duo
function createDuo(
    idUser,
    idPubliOriginale,
    contenuPub,
    visibilite = 1
) {
    const stmt = db.prepare(`
        INSERT INTO Publication
        (idUser, contenuPub, visibilite, idPubliPartagee, typePublication)
        VALUES (?, ?, ?, ?, 'duo')
    `);

    const result = stmt.run(
        idUser,
        contenuPub,
        visibilite,
        idPubliOriginale
    );

    return findById(result.lastInsertRowid);
}

// Créer un collage
function createCollage(
    idUser,
    idPubliOriginale,
    contenuPub,
    visibilite = 1
) {
    const stmt = db.prepare(`
        INSERT INTO Publication
        (idUser, contenuPub, visibilite, idPubliPartagee, typePublication)
        VALUES (?, ?, ?, ?, 'collage')
    `);

    const result = stmt.run(
        idUser,
        contenuPub,
        visibilite,
        idPubliOriginale
    );

    return findById(result.lastInsertRowid);
}
// Récupérer la chaîne complète des publications parentes
function findRemixChain(idPubli) {
    const chain = [];
    const visitedIds = new Set();

    let currentId = idPubli;

    while (currentId !== null) {

        // Protection contre les boucles dans la chaîne
        if (visitedIds.has(currentId)) {
            throw new Error(
                'Chaîne de remixes invalide : boucle détectée'
            );
        }

        visitedIds.add(currentId);

        const publication = db.prepare(`
            SELECT
                idPubli,
                idUser,
                contenuPub,
                visibilite,
                idPubliPartagee,
                typePublication,
                datePubli
            FROM Publication
            WHERE idPubli = ?
        `).get(currentId);

        if (!publication) {
            break;
        }

        chain.push(publication);

        currentId = publication.idPubliPartagee;
    }

    return chain;
}

module.exports = {
    createPublication,
    createRepost,
    createDuo,
    createCollage,
    findById,
    findAuthor,
    findWithOriginal,
    findRemixChain
};