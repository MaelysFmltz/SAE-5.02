const db = require('../config/database');


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

        const idPubli =
            publicationResult.lastInsertRowid;


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


/** * Supprime une publication uniquement si * elle appartient à l'utilisateur connecté. */ 
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
        /* * Publication inexistante ou utilisateur * qui n'est pas propriétaire. */ 
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
 * Toutes les publications.
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
 * Publications d'un utilisateur.
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
 * Une publication.
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
    createMediaPost,
    findAllPostsWithMedia,
    findPostsByUserId,
    findPostById,
    deletePostByIdAndUser
};