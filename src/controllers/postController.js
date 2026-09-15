const fs = require('fs/promises');
const postService = require('../services/postService');

/*
 * ============================================================
 * Vérification des signatures réelles des fichiers
 * ============================================================
 */

/*
 * JPEG
 * FF D8 FF
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
 * PNG
 * 89 50 4E 47 0D 0A 1A 0A
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
 * WebP
 *
 * Un WebP commence par :
 * RIFF .... WEBP
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
 * MP4 / MOV
 *
 * Les fichiers MP4 et MOV utilisent le format ISO Base Media File Format.
 *
 * Leur en-tête contient normalement une "box" ftyp.
 *
 * On recherche donc "ftyp" dans les premiers octets du fichier,
 * au lieu de faire confiance au MIME type envoyé par le client.
 */
function isRealMP4(buffer) {
    if (!buffer || buffer.length < 12) {
        return false;
    }

    /*
     * "ftyp" se trouve généralement à l'offset 4.
     *
     * On accepte plusieurs positions dans les premiers octets
     * afin d'être compatible avec différentes variantes de MP4/MOV.
     */
    const maxOffset = Math.min(buffer.length - 4, 64);

    for (let i = 0; i <= maxOffset; i++) {
        if (
            buffer[i] === 0x66 && // f
            buffer[i + 1] === 0x74 && // t
            buffer[i + 2] === 0x79 && // y
            buffer[i + 3] === 0x70 // p
        ) {
            return true;
        }
    }

    return false;
}


/*
 * WebM
 *
 * Les fichiers WebM utilisent le conteneur Matroska/EBML.
 *
 * Signature EBML :
 * 1A 45 DF A3
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
 * OGG
 *
 * Signature :
 * OggS
 */
function isRealOGG(buffer) {
    if (!buffer || buffer.length < 4) {
        return false;
    }

    return buffer.toString('ascii', 0, 4) === 'OggS';
}


/*
 * ============================================================
 * Upload d'une publication
 * ============================================================
 */

async function uploadImage(req, res) {
    let uploadedFilePath = null;

    try {

        /*
         * --------------------------------------------------------
         * Authentification
         * --------------------------------------------------------
         *
         * L'id de l'utilisateur vient du JWT vérifié par
         * authMiddleware.
         *
         * On ne fait JAMAIS confiance à un idUser envoyé
         * par le navigateur.
         */
        if (!req.user || !req.user.idUser) {
            return res.status(401).json({
                error: 'Utilisateur non authentifié'
            });
        }


        /*
         * --------------------------------------------------------
         * Fichier obligatoire
         * --------------------------------------------------------
         */
        if (!req.file) {
            return res.status(400).json({
                error: 'Aucun fichier envoyé'
            });
        }


        const file = req.file;

        /*
         * Avec multer.diskStorage(), le fichier est déjà
         * enregistré sur le disque.
         */
        uploadedFilePath = file.path;


        /*
         * --------------------------------------------------------
         * Types MIME autorisés
         * --------------------------------------------------------
         *
         * ATTENTION :
         *
         * Le MIME type est fourni par le client.
         * Il ne constitue donc PAS une preuve que le fichier
         * est réellement une vidéo.
         *
         * Il sera vérifié plus bas avec la signature binaire.
         */
        const imageTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp'
        ];

        const videoTypes = [
            'video/mp4',
            'video/webm',
            'video/ogg',
            'video/quicktime'
        ];


        let typeMedia;


        /*
         * ========================================================
         * IMAGE
         * ========================================================
         */
        if (imageTypes.includes(file.mimetype)) {

            typeMedia = 'image';


            /*
             * Taille maximale : 20 Mo
             */
            if (file.size > 20 * 1024 * 1024) {

                await fs.unlink(uploadedFilePath).catch(() => {});

                return res.status(400).json({
                    error: 'L’image ne doit pas dépasser 20 Mo.'
                });
            }


            /*
             * Lecture du contenu réel du fichier.
             */
            const buffer = await fs.readFile(file.path);


            /*
             * Vérification de la vraie signature.
             */
            if (
                file.mimetype === 'image/jpeg' ||
                file.mimetype === 'image/jpg'
            ) {

                if (!isRealJPEG(buffer)) {

                    await fs.unlink(uploadedFilePath).catch(() => {});

                    return res.status(400).json({
                        error: 'Le fichier envoyé n’est pas un véritable JPEG.'
                    });
                }

            } else if (file.mimetype === 'image/png') {

                if (!isRealPNG(buffer)) {

                    await fs.unlink(uploadedFilePath).catch(() => {});

                    return res.status(400).json({
                        error: 'Le fichier envoyé n’est pas un véritable PNG.'
                    });
                }

            } else if (file.mimetype === 'image/webp') {

                if (!isRealWebP(buffer)) {

                    await fs.unlink(uploadedFilePath).catch(() => {});

                    return res.status(400).json({
                        error: 'Le fichier envoyé n’est pas un véritable WebP.'
                    });
                }
            }
        }


        /*
         * ========================================================
         * VIDEO
         * ========================================================
         */
        else if (videoTypes.includes(file.mimetype)) {

            typeMedia = 'video';


            /*
             * Taille maximale : 100 Mo
             */
            if (file.size > 100 * 1024 * 1024) {

                await fs.unlink(uploadedFilePath).catch(() => {});

                return res.status(400).json({
                    error: 'La vidéo ne doit pas dépasser 100 Mo.'
                });
            }


            /*
             * ----------------------------------------------------
             * IMPORTANT : vérification du contenu réel
             * ----------------------------------------------------
             *
             * Avant cette correction, le serveur faisait
             * essentiellement confiance à :
             *
             *     file.mimetype === 'video/mp4'
             *
             * Or le client peut envoyer :
             *
             *     fichier.html
             *
             * avec :
             *
             *     Content-Type: video/mp4
             *
             * Le serveur doit donc inspecter le fichier lui-même.
             */
            const buffer = await fs.readFile(file.path);


            let validVideo = false;


            /*
             * MP4
             */
            if (file.mimetype === 'video/mp4') {

                validVideo = isRealMP4(buffer);

            }


            /*
             * MOV / QuickTime
             *
             * Les fichiers MOV utilisent également le conteneur
             * ISO Base Media et possèdent généralement une box ftyp.
             */
            else if (file.mimetype === 'video/quicktime') {

                validVideo = isRealMP4(buffer);

            }


            /*
             * WebM
             */
            else if (file.mimetype === 'video/webm') {

                validVideo = isRealWebM(buffer);

            }


            /*
             * OGG
             */
            else if (file.mimetype === 'video/ogg') {

                validVideo = isRealOGG(buffer);

            }


            /*
             * Si la signature ne correspond pas au type annoncé,
             * le fichier est rejeté.
             */
            if (!validVideo) {

                await fs.unlink(uploadedFilePath).catch(() => {});

                return res.status(400).json({
                    error: 'Le fichier envoyé n’est pas une véritable vidéo.'
                });
            }
        }


        /*
         * ========================================================
         * TYPE INCONNU
         * ========================================================
         */
        else {

            await fs.unlink(uploadedFilePath).catch(() => {});

            return res.status(400).json({
                error: 'Format de fichier non autorisé.'
            });
        }


        /*
         * ========================================================
         * DESCRIPTION
         * ========================================================
         */
        const contenuPub =
            req.body.contenuPub
                ? String(req.body.contenuPub).trim()
                : null;


        /*
         * ========================================================
         * VISIBILITÉ
         * ========================================================
         */
        const visibilite =
            req.body.visibilite !== undefined
                ? Number(req.body.visibilite)
                : 1;


        /*
         * Seulement :
         *
         * 0 = privé
         * 1 = public
         */
        if (visibilite !== 0 && visibilite !== 1) {

            await fs.unlink(uploadedFilePath).catch(() => {});

            return res.status(400).json({
                error: 'Visibilité invalide.'
            });
        }


        /*
         * ========================================================
         * CRÉATION DE LA PUBLICATION
         * ========================================================
         *
         * IMPORTANT :
         * idUser vient du JWT et non de req.body.
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
            message: 'Publication créée avec succès.',
            post,
            url: '/uploads/${file.filename}'
        });


    } catch (error) {

        console.error('Erreur upload :', error);


        /*
         * Si une erreur survient après l'enregistrement du fichier,
         * on supprime le fichier afin d'éviter les fichiers orphelins.
         */
        if (uploadedFilePath) {
            await fs.unlink(uploadedFilePath).catch(() => {});
        }


        return res.status(500).json({
            error: 'Erreur lors de la publication.'
        });
    }
}


/*
 * ============================================================
 * Page de publication
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

    } catch (error) {

        console.error(error);

        return res.status(500).send(
            'Erreur lors du chargement de la page.'
        );
    }
}


/*
 * ============================================================
 * API de toutes les publications
 * ============================================================
 */

async function getImagesApi(req, res) {

    try {

        const posts =
            await postService.getAllPosts();

        return res.status(200).json(posts);

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            error: 'Erreur lors du chargement des publications.'
        });
    }
}


/*
 * ============================================================
 * API des publications d'un utilisateur
 * ============================================================
 */

async function getUserImagesApi(req, res) {

    try {

        const idUser =
            Number(req.params.idUser);


        if (!idUser) {

            return res.status(400).json({
                error: 'Identifiant utilisateur invalide.'
            });
        }


        const posts =
            await postService.getUserPosts(idUser);


        return res.status(200).json(posts);

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            error: 'Erreur lors du chargement des publications.'
        });
    }
}


/*
 * ============================================================
 * Exports
 * ============================================================
 */

module.exports = {
    uploadImage,
    getImages,
    getImagesApi,
    getUserImagesApi,

    /*
     * Exports utilisés par les tests de sécurité.
     *
     * Ils permettent de tester directement les signatures
     * binaires sans avoir besoin de démarrer tout le serveur.
     */
    isRealJPEG,
    isRealPNG,
    isRealWebP,
    isRealMP4,
    isRealWebM,
    isRealOGG
};

