const db = require('../config/database');


/**
 * Crée une publication avec son média image.
 */
function createImagePost(
    idUser,
    contenuPub,
    visibilite,
    nomMedia
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
            'image'
        );

        return idPubli;
    });

    const idPubli = transaction();

    return findPostById(idPubli);
}


/**
 * Récupère toutes les publications contenant une image.
 *
 * Utilisé par le Feed.
 */
function findAllPostsWithImages() {

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

        WHERE m.typeMedia = 'image'

        ORDER BY p.datePubli DESC
    `).all();
}


/**
 * Récupère uniquement les publications d'un utilisateur.
 *
 * Utilisé sur son profil.
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
          AND m.typeMedia = 'image'

        ORDER BY p.datePubli DESC
    `).all(idUser);
}


/**
 * Récupère une publication par son identifiant.
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
    createImagePost,
    findAllPostsWithImages,
    findPostsByUserId,
    findPostById
};