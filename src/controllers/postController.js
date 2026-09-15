
const fs = require('fs/promises');
const postService = require('../services/postService');


/*
 * ============================================================
 * VÉRIFICATION DES SIGNATURES BINAIRES
 * ============================================================
 */


/*
 * Vérifie la signature réelle d'un JPEG.
 */
function isRealJPEG(buffer) {

    if (!buffer || buffer.length < 3) {
        return false;
    }

    return (
        buffer[0] === 0xFF &&
        buffer[1] === 0xD8 &&
        buffer[2] === 0xFF
    );
}


/*
 * Vérifie la signature réelle d'un PNG.
 */
function isRealPNG(buffer) {

    if (!buffer || buffer.length < 8) {
        return false;
    }

    return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4E &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0D &&
        buffer[5] === 0x0A &&
        buffer[6] === 0x1A &&
        buffer[7] === 0x0A
    );
}


/*
 * Vérifie la signature réelle d'un WebP.
 */
function isRealWebP(buffer) {

    if (!buffer || buffer.length < 12) {
        return false;
    }

    return (
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
    );
}


/*
 * Vérifie qu'un fichier contient une structure MP4.
 *
 * Les fichiers MP4 contiennent normalement une boîte
 * "ftyp" dans leur en-tête.
 */
function isRealMP4(buffer) {

    if (!buffer || buffer.length < 12) {
        return false;
    }

    /*
     * On cherche "ftyp" dans les 64 premiers octets.
     *
     * Cela permet de gérer les quelques variations
     * d'emplacement de la boîte ftyp.
     */
    const maxOffset =
        Math.min(
            buffer.length - 4,
            64
        );

    for (let i = 0; i <= maxOffset; i++) {

        if (
            buffer.toString(
                'ascii',
                i,
                i + 4
            ) === 'ftyp'
        ) {
            return true;
        }

    }

    return false;
}


/*
 * Vérifie la signature EBML d'un WebM.
 */
function isRealWebM(buffer) {

    if (!buffer || buffer.length < 4) {
        return false;
    }

    return (
        buffer[0] === 0x1A &&
        buffer[1] === 0x45 &&
        buffer[2] === 0xDF &&
        buffer[3] === 0xA3
    );
}


/*
 * Vérifie la signature d'un fichier OGG.
 */
function isRealOGG(buffer) {

    if (!buffer || buffer.length < 4) {
        return false;
    }

    return (
        buffer.toString(
            'ascii',
            0,
            4
        ) === 'OggS'
    );
}


/*
 * ============================================================
 * UPLOAD D'UNE PUBLICATION
 * ============================================================
 */

async function uploadImage(req, res) {

    let uploadedFilePath = null;

    try {

        /*
         * Vérification de l'utilisateur connecté.
         *
         * L'identité vient du JWT et non des données
         * envoyées par le client.
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
                error: 'Aucun fichier envoyé'
            });

        }


        const file = req.file;

        uploadedFilePath = file.path;


        /*
         * Types d'images autorisés.
         */
        const imageTypes = [
            'image/jpeg',
            'image/png',
            'image/webp'
        ];


        /*
         * Types de vidéos autorisés.
         */
        const videoTypes = [
            'video/mp4',
            'video/webm',
            'video/ogg',
            'video/quicktime'
        ];


        let typeMedia;


        /*
         * ====================================================
         * IMAGE
         * ====================================================
         */

        if (imageTypes.includes(file.mimetype)) {

            typeMedia = 'image';


            /*
             * Limite de 20 Mo pour les images.
             */
            if (
                file.size >
                20 * 1024 * 1024
            ) {

                await fs.unlink(
                    uploadedFilePath
                ).catch(() => {});

                return res.status(400).json({
                    error:
                        'L’image ne doit pas dépasser 20 Mo.'
                });

            }


            /*
             * Lecture du fichier réel.
             */
            const buffer =
                await fs.readFile(
                    file.path
                );


            /*
             * Vérification du contenu réel.
             */
            if (
                file.mimetype === 'image/jpeg' &&
                !isRealJPEG(buffer)
            ) {

                await fs.unlink(
                    uploadedFilePath
                ).catch(() => {});

                return res.status(400).json({
                    error:
                        'Le fichier envoyé n’est pas un véritable JPEG.'
                });

            }


            if (
                file.mimetype === 'image/png' &&
                !isRealPNG(buffer)
            ) {

                await fs.unlink(
                    uploadedFilePath
                ).catch(() => {});

                return res.status(400).json({
                    error:
                        'Le fichier envoyé n’est pas un véritable PNG.'
                });

            }


            if (
                file.mimetype === 'image/webp' &&
                !isRealWebP(buffer)
            ) {

                await fs.unlink(
                    uploadedFilePath
                ).catch(() => {});

                return res.status(400).json({
                    error:
                        'Le fichier envoyé n’est pas un véritable WebP.'
                });

            }

        }


        /*
         * ====================================================
         * VIDÉO
         * ====================================================
         */

        else if (videoTypes.includes(file.mimetype)) {

            typeMedia = 'video';


            /*
             * Limite de 100 Mo pour les vidéos.
             */
            if (
                file.size >
                100 * 1024 * 1024
            ) {

                await fs.unlink(
                    uploadedFilePath
                ).catch(() => {});

                return res.status(400).json({
                    error:
                        'La vidéo ne doit pas dépasser 100 Mo.'
                });

            }


            /*
             * Lecture du contenu réel.
             */
            const buffer =
                await fs.readFile(
                    file.path
                );


            let validVideo = false;


            /*
             * MP4
             */
            if (
                file.mimetype === 'video/mp4'
            ) {

                validVideo =
                    isRealMP4(buffer);

            }


            /*
             * QuickTime / MOV
             *
             * Les fichiers MOV utilisent également
             * le conteneur ISO Base Media et possèdent
             * normalement une boîte ftyp.
             */
            else if (
                file.mimetype === 'video/quicktime'
            ) {

                validVideo =
                    isRealMP4(buffer);

            }


            /*
             * WebM
             */
            else if (
                file.mimetype === 'video/webm'
            ) {

                validVideo =
                    isRealWebM(buffer);

            }


            /*
             * OGG
             */
            else if (
                file.mimetype === 'video/ogg'
            ) {

                validVideo =
                    isRealOGG(buffer);

            }


            /*
             * Le MIME déclaré par le client ne suffit
             * donc plus à faire accepter le fichier.
             */
            if (!validVideo) {

                await fs.unlink(
                    uploadedFilePath
                ).catch(() => {});

                return res.status(400).json({
                    error:
                        'Le fichier envoyé n’est pas une véritable vidéo.'
                });

            }

        }


        /*
         * ====================================================
         * FORMAT INCONNU
         * ====================================================
         */

        else {

            await fs.unlink(
                uploadedFilePath
            ).catch(() => {});

            return res.status(400).json({
                error:
                    'Format de fichier non autorisé.'
            });

        }


        /*
         * ====================================================
         * DESCRIPTION
         * ====================================================
         */

        const contenuPub =
            req.body.contenuPub
                ? String(
                    req.body.contenuPub
                ).trim()
                : null;


        /*
         * ====================================================
         * VISIBILITÉ
         * ====================================================
         */

        const visibilite =
            req.body.visibilite !== undefined
                ? Number(req.body.visibilite)
                : 1;


        if (
            visibilite !== 0 &&
            visibilite !== 1
        ) {

            await fs.unlink(
                uploadedFilePath
            ).catch(() => {});

            return res.status(400).json({
                error:
                    'Visibilité invalide.'
            });

        }


        /*
         * ====================================================
         * CRÉATION DE LA PUBLICATION
         * ====================================================
         *
         * IMPORTANT :
         * req.user.idUser vient du JWT.
         *
         * Un idUser envoyé dans req.body est ignoré.
         */

        const post =
            await postService.createMediaPost(
                req.user.idUser,
                contenuPub,
                visibilite,
                file.filename,
                typeMedia
            );


        return res.status(201).json({

            message:
                'Publication créée avec succès.',

            post,

            url:
                `/uploads/${file.filename}`

        });

    }


    catch (error) {

        console.error(
            'Erreur upload :',
            error
        );


        /*
         * Suppression du fichier si une erreur
         * arrive après son enregistrement.
         */
        if (uploadedFilePath) {

            await fs.unlink(
                uploadedFilePath
            ).catch(() => {});

        }


        return res.status(500).json({
            error:
                'Erreur lors de la publication.'
        });

    }

}


/*
 * ============================================================
 * PAGE DE CRÉATION DE PUBLICATION
 * ============================================================
 */

async function getImages(req, res) {

    try {

        const posts =
            await postService.getAllPosts();

        return res.render(
            'posts',
            {
                user: req.user,
                posts
            }
        );

    }

    catch (error) {

        console.error(error);

        return res.status(500).send(
            'Erreur lors du chargement de la page.'
        );

    }

}


/*
 * ============================================================
 * API DE TOUTES LES PUBLICATIONS
 * ============================================================
 */

async function getImagesApi(req, res) {

    try {

        const posts =
            await postService.getAllPosts();

        return res.status(200).json(posts);

    }

    catch (error) {

        console.error(error);

        return res.status(500).json({
            error:
                'Erreur lors du chargement des publications.'
        });

    }

}


/*
 * ============================================================
 * API DES PUBLICATIONS D'UN UTILISATEUR
 * ============================================================
 */

async function getUserImagesApi(req, res) {

    try {

        const idUser =
            Number(req.params.idUser);


        if (!idUser) {

            return res.status(400).json({
                error:
                    'Identifiant utilisateur invalide.'
            });

        }


        const posts =
            await postService.getUserPosts(
                idUser
            );


        return res.status(200).json(posts);

    }

    catch (error) {

        console.error(error);

        return res.status(500).json({
            error:
                'Erreur lors du chargement des publications.'
        });

    }

}


/*
 * Export des fonctions.
 */
module.exports = {

    uploadImage,

    getImages,

    getImagesApi,

    getUserImagesApi,

    /*
     * Exportées également pour permettre
     * des tests unitaires directs si nécessaire.
     */
    isRealJPEG,
    isRealPNG,
    isRealWebP,
    isRealMP4,
    isRealWebM,
    isRealOGG

};

