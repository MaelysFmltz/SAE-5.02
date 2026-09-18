const db = require('../config/database');

/**
 * Crée une publication classique.
 */
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

/**
 * Crée une publication avec un média.
 *
 * typeMedia :
 * - image
 * - video
 */
function createMediaPost(
    idUser,
    contenuPub,
    visibilite,
    nomMedia,
    typeMedia
) {
    const transaction = db.transaction(() => {
        const publicationResult = db.prepare(`
            INSERT INTO Publication (
                idUser,
                contenuPub,
                visibilite
            )
            VALUES (?, ?, ?)
        `).run(
            idUser,
            contenuPub || null,
            visibilite
        );

        const idPubli = publicationResult.lastInsertRowid;

        db.prepare(`
            INSERT INTO Media (
                idPubli,
                nomMedia,
                typeMedia
            )
            VALUES (?, ?, ?)
        `).run(
            idPubli,
            nomMedia,
            typeMedia
        );

        return idPubli;
    });

    const idPubli = transaction();

    return findPostById(idPubli);
}

/**
 * Supprime une publication contenant un média
 * uniquement si elle appartient à l'utilisateur.
 */
function deletePostByIdAndUser(idPubli, idUser) {
    const transaction = db.transaction(() => {
        const media = db.prepare(`
            SELECT
                m.idMedia,
                m.nomMedia
            FROM Media m
            INNER JOIN Publication p
                ON p.idPubli = m.idPubli
            WHERE p.idPubli = ?
            AND p.idUser = ?
        `).get(
            idPubli,
            idUser
        );

        // Publication inexistante ou utilisateur
        // qui n'est pas propriétaire.
        if (!media) {
            return null;
        }

        db.prepare(`
            DELETE FROM Media
            WHERE idPubli = ?
        `).run(idPubli);

        db.prepare(`
            DELETE FROM Publication
            WHERE idPubli = ?
            AND idUser = ?
        `).run(
            idPubli,
            idUser
        );

        return media;
    });

    return transaction();
}

/**
 * Récupérer une publication par son ID.
 */
function findById(idPubli) {
    return db.prepare(`
        SELECT *
        FROM Publication
        WHERE idPubli = ?
    `).get(idPubli);
}

/**
 * Récupérer l'auteur d'une publication.
 */
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

/**
 * Récupérer une publication avec les informations de son original.
 */
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

/**
 * Créer un repartage classique.
 */
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

/**
 * Créer une publication Duo.
 */
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

/**
 * Créer un collage.
 */
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

/**
 * Récupérer la chaîne complète des publications parentes.
 */
function findRemixChain(idPubli) {
    const chain = [];
    const visitedIds = new Set();

    let currentId = idPubli;

    while (currentId !== null) {
        // Protection contre les boucles dans la chaîne.
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

/**
 * Récupérer les publications d'un utilisateur
 * avec les informations de leur original.
 */
function findByUserId(idUser) {
    return db.prepare(`
        SELECT
            p.idPubli,
            p.idUser,

            (
                SELECT COUNT(*)
                FROM Commentaire c
                WHERE c.idPubli = p.idPubli
            ) AS nombreCommentaires,

            p.contenuPub,
            p.visibilite,
            p.idPubliPartagee,
            p.typePublication,
            p.datePubli,
            p.dateModif,

            u.pseudo AS auteurPseudo,

            original.idPubli AS originalIdPubli,
            original.idUser AS originalIdUser,
            original.contenuPub AS originalContenuPub,
            original.visibilite AS originalVisibilite,
            original.typePublication AS originalTypePublication,

            originalUser.pseudo AS auteurOriginalPseudo

        FROM Publication p

        JOIN Utilisateur u
            ON p.idUser = u.idUser

        LEFT JOIN Publication original
            ON p.idPubliPartagee = original.idPubli

        LEFT JOIN Utilisateur originalUser
            ON original.idUser = originalUser.idUser

        WHERE p.idUser = ?
        ORDER BY p.datePubli DESC
    `).all(idUser);
}

// ================================
// PHOTOS / VIDÉOS
// ================================

/**
 * Toutes les publications contenant un média.
 */
function findAllPostsWithMedia() {
    return db.prepare(`
        SELECT
            p.idPubli,
            p.idUser,
            p.contenuPub,
            p.visibilite,
            p.datePubli,

            m.idMedia,
            m.nomMedia,
            m.typeMedia,
            m.duree,
            m.dateUpload,

            u.pseudo

        FROM Publication p

        INNER JOIN Media m
            ON m.idPubli = p.idPubli

        INNER JOIN Utilisateur u
            ON u.idUser = p.idUser

        ORDER BY p.datePubli DESC
    `).all();
}

/**
 * Publications média d'un utilisateur.
 */
function findPostsByUserId(idUser) {
    return db.prepare(`
        SELECT
            p.idPubli,
            p.idUser,
            p.contenuPub,
            p.visibilite,
            p.datePubli,

            m.idMedia,
            m.nomMedia,
            m.typeMedia,
            m.duree,
            m.dateUpload,

            u.pseudo

        FROM Publication p

        INNER JOIN Media m
            ON m.idPubli = p.idPubli

        INNER JOIN Utilisateur u
            ON u.idUser = p.idUser

        WHERE p.idUser = ?

        ORDER BY p.datePubli DESC
    `).all(idUser);
}

/**
 * Une publication contenant un média.
 */
function findPostById(idPubli) {
    return db.prepare(`
        SELECT
            p.idPubli,
            p.idUser,
            p.contenuPub,
            p.visibilite,
            p.datePubli,

            m.idMedia,
            m.nomMedia,
            m.typeMedia,
            m.duree,
            m.dateUpload,

            u.pseudo

        FROM Publication p

        INNER JOIN Media m
            ON m.idPubli = p.idPubli

        INNER JOIN Utilisateur u
            ON u.idUser = p.idUser

        WHERE p.idPubli = ?
    `).get(idPubli);
}

module.exports = {
    // Publications
    createPublication,
    createRepost,
    createDuo,
    createCollage,

    // Recherche publications
    findById,
    findAuthor,
    findWithOriginal,
    findRemixChain,
    findByUserId,

    // Photos / vidéos
    createMediaPost,
    findAllPostsWithMedia,
    findPostsByUserId,
    findPostById,
    deletePostByIdAndUser
};