const fs = require('fs/promises');

const postService = require('../services/postService');
const { isRealJPEG } = require('../utils/imageUtils');


/**
 * Upload d'une image.
 *
 * Route protégée par authMiddleware.
 */
async function uploadImage(req, res) {

    let uploadedFilePath = null;

    try {

        /*
         * Vérification de l'utilisateur connecté.
         *
         * authMiddleware a normalement déjà vérifié
         * le JWT et créé req.user.
         */
        if (!req.user || !req.user.idUser) {

            return res.status(401).json({
                error: 'Utilisateur non authentifié'
            });
        }


        /*
         * Vérification du fichier.
         */
        if (!req.file) {

            return res.status(400).json({
                error: 'Aucune image envoyée'
            });
        }


        uploadedFilePath = req.file.path;


        /*
         * Vérification réelle du fichier.
         *
         * Le MIME envoyé par le navigateur ne suffit pas.
         */
        const validJPEG =
            await isRealJPEG(req.file.path);

        if (!validJPEG) {

            await fs.unlink(req.file.path);

            return res.status(400).json({
                error: 'Le fichier envoyé n’est pas un véritable JPEG'
            });
        }


        /*
         * Récupération des informations du formulaire.
         */
        const {
            contenuPub,
            visibilite
        } = req.body;


        /*
         * Valeur par défaut :
         * publication visible.
         */
        const visibility =
            visibilite === undefined
                ? 1
                : Number(visibilite);


        /*
         * Vérification de la visibilité.
         */
        if (![0, 1].includes(visibility)) {

            await fs.unlink(req.file.path);

            return res.status(400).json({
                error: 'Valeur de visibilité invalide'
            });
        }


        /*
         * Création Publication + Media.
         */
        const post =
            postService.createImagePost(
                req.user.idUser,
                contenuPub,
                visibility,
                req.file.filename
            );


        /*
         * Réponse envoyée au navigateur.
         *
         * L'image est accessible via :
         * /uploads/nomDuFichier.jpg
         */
        return res.status(201).json({

            message: 'Image publiée avec succès',

            post: {
                idPubli: post.idPubli,
                idUser: post.idUser,
                pseudo: post.pseudo,
                contenuPub: post.contenuPub,
                visibilite: post.visibilite,
                datePubli: post.datePubli,
                nomMedia: post.nomMedia,
                typeMedia: post.typeMedia,

                url: `/uploads/${post.nomMedia}`
            }
        });

    } catch (err) {

        console.error(err);


        /*
         * Si la création en base échoue après l'upload,
         * on supprime le fichier pour éviter un fichier
         * orphelin dans /uploads.
         */
        if (uploadedFilePath) {

            try {
                await fs.unlink(uploadedFilePath);
            } catch (deleteError) {
                // Le fichier peut déjà avoir été supprimé.
            }
        }


        return res.status(500).json({
            error: 'Erreur lors de la publication de l’image'
        });
    }
}


/**
 * Affichage de la page des publications.
 */
async function getImages(req, res) {

    try {

        const posts =
            postService.getAllImagePosts();

        return res.render(
            'posts',
            {
                posts
            }
        );

    } catch (err) {

        console.error(err);

        return res.status(500).send(
            'Erreur lors du chargement des publications'
        );
    }
}


/**
 * API permettant de récupérer les publications.
 */
async function getImagesApi(req, res) {

    try {

        const posts =
            postService.getAllImagePosts();


        const formattedPosts =
            posts.map(post => ({

                idPubli: post.idPubli,
                idUser: post.idUser,
                pseudo: post.pseudo,
                contenuPub: post.contenuPub,
                visibilite: post.visibilite,
                datePubli: post.datePubli,

                idMedia: post.idMedia,
                nomMedia: post.nomMedia,
                typeMedia: post.typeMedia,

                url: `/uploads/${post.nomMedia}`
            }));


        return res.status(200).json(
            formattedPosts
        );

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            error: 'Erreur lors du chargement des publications'
        });
    }
}


module.exports = {
    uploadImage,
    getImages,
    getImagesApi
};