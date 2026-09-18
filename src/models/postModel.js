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
 * Supprime une publication (avec ou sans média, quel que soit
 * son type : originale, repost, duo ou collage) uniquement si
 * elle appartient à l'utilisateur.
 *
 * Retourne la liste des médias qui lui étaient associés (pour que
 * l'appelant supprime les fichiers correspondants sur le disque),
 * ou null si la publication n'existe pas / n'appartient pas
 * à l'utilisateur.
 */
function deletePostByIdAndUser(idPubli, idUser) {
    const transaction = db.transaction(() => {
        const publication = db.prepare(`
            SELECT idPubli
            FROM Publication
            WHERE idPubli = ?
            AND idUser = ?
        `).get(
            idPubli,
            idUser
        );

        // Publication inexistante ou utilisateur
        // qui n'est pas propriétaire.
        if (!publication) {
            return null;
        }

        const medias = db.prepare(`
            SELECT idMedia, nomMedia
            FROM Media
            WHERE idPubli = ?
        `).all(idPubli);

        // La suppression de la publication entraîne, via les
        // contraintes ON DELETE CASCADE, celle de ses médias,
        // commentaires, réactions et associations de hashtags.
        db.prepare(`
            DELETE FROM Publication
            WHERE idPubli = ?
            AND idUser = ?
        `).run(
            idPubli,
            idUser
        );

        return medias;
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
 *
 * Inclut le média propre à la publication (celui qu'un Duo ou un
 * collage ajoute lui-même) ainsi que le média de la publication
 * d'origine (celui repris depuis l'original), pour permettre un
 * affichage identique partout (feed, profil, page de publication).
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

            (
                SELECT COUNT(*)
                FROM Commentaire c
                WHERE c.idPubli = p.idPubli
            ) AS nombreCommentaires,

            m.nomMedia,
            m.typeMedia,

            original.idPubli AS originalIdPubli,
            original.idUser AS originalIdUser,
            original.contenuPub AS originalContenuPub,
            original.visibilite AS originalVisibilite,
            original.typePublication AS originalTypePublication,

            om.nomMedia AS originalNomMedia,
            om.typeMedia AS originalTypeMedia,

            u.pseudo AS auteurPseudo,
            originalUser.pseudo AS auteurOriginalPseudo

        FROM Publication p

        JOIN Utilisateur u
            ON p.idUser = u.idUser

        LEFT JOIN Media m
            ON m.idPubli = p.idPubli

        LEFT JOIN Publication original
            ON p.idPubliPartagee = original.idPubli

        LEFT JOIN Utilisateur originalUser
            ON original.idUser = originalUser.idUser

        LEFT JOIN Media om
            ON om.idPubli = original.idPubli

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
 * Retrouve le repost qu'un utilisateur a déjà fait
 * d'une publication donnée, s'il existe.
 */
function findRepost(idUser, idPubliPartagee) {
    return db.prepare(`
        SELECT idPubli
        FROM Publication
        WHERE idUser = ?
        AND idPubliPartagee = ?
        AND typePublication = 'repost'
    `).get(idUser, idPubliPartagee);
}

/**
 * Supprime le repost qu'un utilisateur a fait d'une publication
 * (annulation d'un repost déjà existant).
 */
function deleteRepost(idUser, idPubliPartagee) {
    db.prepare(`
        DELETE FROM Publication
        WHERE idUser = ?
        AND idPubliPartagee = ?
        AND typePublication = 'repost'
    `).run(idUser, idPubliPartagee);
}

/**
 * Identifiants des publications qu'un utilisateur a déjà repostées,
 * pour permettre l'affichage de l'état "déjà reposté" du bouton.
 */
function findRepostedPubliIds(idUser) {
    const rows = db.prepare(`
        SELECT idPubliPartagee
        FROM Publication
        WHERE idUser = ?
        AND typePublication = 'repost'
    `).all(idUser);

    return new Set(rows.map(row => row.idPubliPartagee));
}

/**
 * Créer une publication Duo, avec le média ajouté par
 * l'utilisateur (affiché à côté du média de l'original).
 */
function createDuo(
    idUser,
    idPubliOriginale,
    contenuPub,
    visibilite = 1,
    nomMedia = null,
    typeMedia = null
) {
    const transaction = db.transaction(() => {
        const result = db.prepare(`
            INSERT INTO Publication
            (idUser, contenuPub, visibilite, idPubliPartagee, typePublication)
            VALUES (?, ?, ?, ?, 'duo')
        `).run(
            idUser,
            contenuPub,
            visibilite,
            idPubliOriginale
        );

        const idPubli = result.lastInsertRowid;

        if (nomMedia && typeMedia) {
            db.prepare(`
                INSERT INTO Media (idPubli, nomMedia, typeMedia)
                VALUES (?, ?, ?)
            `).run(idPubli, nomMedia, typeMedia);
        }

        return idPubli;
    });

    return findWithOriginal(transaction());
}

/**
 * Créer un collage, avec la vidéo ajoutée par l'utilisateur
 * (affichée avec celle de la publication d'origine).
 */
function createCollage(
    idUser,
    idPubliOriginale,
    contenuPub,
    visibilite = 1,
    nomMedia = null,
    typeMedia = null
) {
    const transaction = db.transaction(() => {
        const result = db.prepare(`
            INSERT INTO Publication
            (idUser, contenuPub, visibilite, idPubliPartagee, typePublication)
            VALUES (?, ?, ?, ?, 'collage')
        `).run(
            idUser,
            contenuPub,
            visibilite,
            idPubliOriginale
        );

        const idPubli = result.lastInsertRowid;

        if (nomMedia && typeMedia) {
            db.prepare(`
                INSERT INTO Media (idPubli, nomMedia, typeMedia)
                VALUES (?, ?, ?)
            `).run(idPubli, nomMedia, typeMedia);
        }

        return idPubli;
    });

    return findWithOriginal(transaction());
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

            m.nomMedia,
            m.typeMedia,

            original.idPubli AS originalIdPubli,
            original.idUser AS originalIdUser,
            original.contenuPub AS originalContenuPub,
            original.visibilite AS originalVisibilite,
            original.typePublication AS originalTypePublication,

            om.nomMedia AS originalNomMedia,
            om.typeMedia AS originalTypeMedia,

            originalUser.pseudo AS auteurOriginalPseudo

        FROM Publication p

        JOIN Utilisateur u
            ON p.idUser = u.idUser

        LEFT JOIN Media m
            ON m.idPubli = p.idPubli

        LEFT JOIN Publication original
            ON p.idPubliPartagee = original.idPubli

        LEFT JOIN Utilisateur originalUser
            ON original.idUser = originalUser.idUser

        LEFT JOIN Media om
            ON om.idPubli = original.idPubli

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

/**
 * Remonte la chaîne des publications partagées (repost/duo/collage)
 * à partir de idPubli et retourne l'identifiant de la première
 * publication rencontrée qui possède réellement son propre média
 * (elle-même incluse), ou null si aucune n'en a.
 *
 * Sert à créer un Duo/collage à partir d'un repost : le repost lui
 * n'a jamais de média propre, il faut remonter jusqu'à la vraie
 * publication photo/vidéo d'origine.
 */
function resolveMediaSource(idPubli) {
    let current = idPubli;
    const visited = new Set();

    while (current && !visited.has(current)) {
        visited.add(current);

        if (findPostById(current)) {
            return current;
        }

        const publication = findById(current);
        current = publication ? publication.idPubliPartagee : null;
    }

    return null;
}

module.exports = {
    // Publications
    createPublication,
    createRepost,
    findRepost,
    deleteRepost,
    findRepostedPubliIds,
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
    resolveMediaSource,
    deletePostByIdAndUser
};