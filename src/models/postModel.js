const db = require('../config/database');


/**
 * Crée une publication avec son média image.
 *
 * Les deux INSERT sont effectués dans une transaction :
 * si l'un échoue, l'autre est annulé.
 */
function createImagePost(
    idUser,
    contenuPub,
    visibilite,
    nomMedia
) {
    const transaction = db.transaction(() => {

        // Création de la publication
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

        // Création du média
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
 * Récupère une publication précise avec son image.
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
    findPostById
};