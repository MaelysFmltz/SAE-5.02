const fs = require('fs/promises');

const postService =
    require('../services/postService');

const { isRealJPEG } =
    require('../utils/imageUtils');


/**
 * Affiche la page permettant de créer une publication.
 *
 * IMPORTANT :
 * Cette page ne doit PAS afficher les publications.
 * Les publications sont affichées dans le Feed et le Profile.
 */
async function getImages(req, res) {

    try {

        return res.render(
            'posts',
            {
                user: req.user
            }
        );

    } catch (err) {

        console.error(err);

        return res.status(500).send(
            'Erreur lors du chargement de la page de publication'
        );
    }
}


/**
 * Upload d'une image.
 */
async function uploadImage(req, res) {

    let uploadedFilePath = null;

    try {

        if (!req.user || !req.user.idUser) {

            return res.status(401).json({
                error: 'Utilisateur non authentifié'
            });
        }


        if (!req.file) {

            return res.status(400).json({
                error: 'Aucune image envoyée'
            });
        }


        uploadedFilePath = req.file.path;


        /*
         * Vérification réelle du JPEG.
         */
        const validJPEG =
            await isRealJPEG(req.file.path);

        if (!validJPEG) {

            await fs.unlink(req.file.path);

            return res.status(400).json({
                error:
                    'Le fichier envoyé n’est pas un véritable JPEG'
            });
        }


        const {
            contenuPub,
            visibilite
        } = req.body;


        const visibility =
            visibilite === undefined
                ? 1
                : Number(visibilite);


        if (![0, 1].includes(visibility)) {

            await fs.unlink(req.file.path);

            return res.status(400).json({
                error:
                    'Valeur de visibilité invalide'
            });
        }


        /*
         * IMPORTANT :
         * idUser vient de l'utilisateur authentifié,
         * et non du formulaire.
         */
        const post =
            postService.createImagePost(
                req.user.idUser,
                contenuPub,
                visibility,
                req.file.filename
            );


        return res.status(201).json({

            message:
                'Image publiée avec succès',

            post: {

                idPubli: post.idPubli,

                idUser: post.idUser,

                pseudo: post.pseudo,

                contenuPub: post.contenuPub,

                visibilite: post.visibilite,

                datePubli: post.datePubli,

                nomMedia: post.nomMedia,

                typeMedia: post.typeMedia,

                url:
                    `/uploads/${post.nomMedia}`
            }
        });

    } catch (err) {

        console.error(err);


        /*
         * Suppression du fichier si la BDD
         * n'a pas pu enregistrer la publication.
         */
        if (uploadedFilePath) {

            try {

                await fs.unlink(
                    uploadedFilePath
                );

            } catch (deleteError) {
                // Rien à faire si le fichier n'existe plus.
            }
        }


        return res.status(500).json({
            error:
                'Erreur lors de la publication de l’image'
        });
    }
}


/**
 * API : toutes les publications.
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

                url:
                    `/uploads/${post.nomMedia}`
            }));


        return res.status(200).json(
            formattedPosts
        );

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            error:
                'Erreur lors du chargement des publications'
        });
    }
}


/**
 * API : publications d'un utilisateur.
 */
async function getUserImagesApi(req, res) {

    try {

        const posts =
            postService.getUserImagePosts(
                req.params.idUser
            );


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

                url:
                    `/uploads/${post.nomMedia}`
            }));


        return res.status(200).json(
            formattedPosts
        );

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            error:
                'Erreur lors du chargement des publications'
        });
    }
}


module.exports = {
    getImages,
    uploadImage,
    getImagesApi,
    getUserImagesApi
};