const fs = require('fs/promises');
const postService = require('../services/postService');

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

async function uploadImage(req, res) {
    let uploadedFilePath = null;

    try {
        /*
         * Vérification de l'utilisateur connecté.
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

        const imageTypes = [
            'image/jpeg',
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
         * =========================
         * IMAGE
         * =========================
         */
        if (imageTypes.includes(file.mimetype)) {

            typeMedia = 'image';

            /*
             * Une image est limitée à 20 Mo.
             */
            if (file.size > 20 * 1024 * 1024) {
                await fs.unlink(uploadedFilePath).catch(() => {});

                return res.status(400).json({
                    error: 'L’image ne doit pas dépasser 20 Mo.'
                });
            }

            /*
             * On lit le fichier depuis le disque.
             * IMPORTANT :
             * avec diskStorage(), il faut utiliser
             * fs.readFile() et non file.buffer.
             */
            const buffer = await fs.readFile(file.path);

            /*
             * Vérification du vrai format.
             */
            if (file.mimetype === 'image/jpeg') {

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
         * =========================
         * VIDÉO
         * =========================
         */
        else if (videoTypes.includes(file.mimetype)) {

            typeMedia = 'video';

            /*
             * Une vidéo est limitée à 100 Mo.
             */
            if (file.size > 100 * 1024 * 1024) {
                await fs.unlink(uploadedFilePath).catch(() => {});

                return res.status(400).json({
                    error: 'La vidéo ne doit pas dépasser 100 Mo.'
                });
            }
        }

        /*
         * =========================
         * FORMAT INCONNU
         * =========================
         */
        else {

            await fs.unlink(uploadedFilePath).catch(() => {});

            return res.status(400).json({
                error: 'Format de fichier non autorisé.'
            });
        }

        /*
         * Description.
         */
        const contenuPub =
            req.body.contenuPub
                ? String(req.body.contenuPub).trim()
                : null;

        /*
         * Visibilité.
         */
        const visibilite =
            req.body.visibilite !== undefined
                ? Number(req.body.visibilite)
                : 1;

        /*
         * Vérification de la visibilité.
         */
        if (visibilite !== 0 && visibilite !== 1) {

            await fs.unlink(uploadedFilePath).catch(() => {});

            return res.status(400).json({
                error: 'Visibilité invalide.'
            });
        }

        /*
         * Création de la publication.
         */
        const post = await postService.createMediaPost(
            req.user.idUser,
            contenuPub,
            visibilite,
            file.filename,
            typeMedia
        );

        return res.status(201).json({
            message: 'Publication créée avec succès.',
            post,
            url: `/uploads/${file.filename}`
        });

    } catch (error) {

        console.error('Erreur upload :', error);

        /*
         * Si une erreur arrive après l'envoi du fichier,
         * on supprime le fichier pour éviter les fichiers orphelins.
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
 * Page de création de publication.
 */
async function getImages(req, res) {
    try {

        const posts = await postService.getAllPosts();

        return res.render('posts', {
            user: req.user,
            posts
        });

    } catch (error) {

        console.error(error);

        return res.status(500).send(
            'Erreur lors du chargement de la page.'
        );
    }
}


/*
 * API de toutes les publications.
 */
async function getImagesApi(req, res) {
    try {

        const posts = await postService.getAllPosts();

        return res.status(200).json(posts);

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            error: 'Erreur lors du chargement des publications.'
        });
    }
}


/*
 * API des publications d'un utilisateur.
 */
async function getUserImagesApi(req, res) {
    try {

        const idUser = Number(req.params.idUser);

        if (!idUser) {
            return res.status(400).json({
                error: 'Identifiant utilisateur invalide.'
            });
        }

        const posts = await postService.getUserPosts(idUser);

        return res.status(200).json(posts);

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            error: 'Erreur lors du chargement des publications.'
        });
    }
}


module.exports = {
    uploadImage,
    getImages,
    getImagesApi,
    getUserImagesApi
};