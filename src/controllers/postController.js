const fs = require('fs/promises');

const postService = require('../services/postService');
const hashtagModel = require('../models/hashtagModel');
const { extractHashtags } = require('../utils/hashtagUtils');
const db = require('../config/database');
const {
    IMAGE_MAX_SIZE,
    VIDEO_MAX_SIZE,
    IMAGE_TYPES,
    VIDEO_TYPES,
    isRealJPEG,
    isRealPNG,
    isRealWebP,
    isRealMP4,
    isRealWebM,
    isRealOGG,
    validateMediaFile
} = require('../utils/mediaValidation');
const { deleteUploadedFile } = require('../utils/uploadedFiles');

const {
    validateEditedImage,
    validateEditedVideo
} = require('../services/mediaEditorService');

/*
 * ============================================================
 * CRÉATION D'UNE PUBLICATION CLASSIQUE
 * ============================================================
 */

function createPublication(req, res) {
    try {
        const {
            contenuPub,
            idPubliPartagee
        } = req.body;

        const visibilite = Number(
            req.body.visibilite
        );

        const publication =
            postService.createPublication(
                req.user.idUser,
                contenuPub,
                visibilite,
                idPubliPartagee || null
            );

        /*
         * Liaison automatique des hashtags.
         */
        if (contenuPub) {
            const hashtags =
                extractHashtags(contenuPub);

            if (hashtags.length > 0) {
                hashtagModel.associerHashtagsPubli(
                    db,
                    publication.idPubli,
                    hashtags
                );
            }
        }

        return res.status(201).json({
            message:
                'Publication créée avec succès',
            publication
        });
    } catch (error) {
        return res.status(400).json({
            error: error.message
        });
    }
}

/*
 * ============================================================
 * REPOST
 * ============================================================
 */

function createRepost(req, res) {
    try {
        const idPubli = Number(
            req.params.idPubli
        );

        const visibilite =
            req.body && req.body.visibilite !== undefined
                ? Number(req.body.visibilite)
                : 1;

        const { reposted, publication } =
            postService.toggleRepost(
                req.user.idUser,
                idPubli,
                visibilite
            );

        return res.status(reposted ? 201 : 200).json({
            message: reposted
                ? 'Publication repartagée avec succès'
                : 'Repost annulé',
            reposted,
            publication
        });
    } catch (error) {
        return res.status(400).json({
            error: error.message
        });
    }
}

/*
 * ============================================================
 * DUO
 * ============================================================
 */

async function createDuo(req, res) {
    let uploadedFilePath = null;

    try {
        const { contenuPub } = req.body;
        const visibilite = Number(
            req.body.visibilite
        );

        if (!req.file) {
            return res.status(400).json({
                error: 'Ajoutez votre propre photo ou vidéo pour créer un Duo.'
            });
        }

        uploadedFilePath = req.file.path;

        const buffer = await fs.readFile(uploadedFilePath);

        let typeMedia;

        try {
            ({ typeMedia } = validateMediaFile(req.file, buffer));
        } catch (validationError) {
            await fs.unlink(uploadedFilePath).catch(() => {});

            return res.status(400).json({
                error: validationError.message
            });
        }

        const publication =
            postService.createDuo(
                req.user.idUser,
                req.params.idPubli,
                contenuPub,
                visibilite,
                req.file.filename,
                typeMedia
            );

        uploadedFilePath = null;

        if (contenuPub) {
            const hashtags =
                extractHashtags(contenuPub);

            if (hashtags.length > 0) {
                hashtagModel.associerHashtagsPubli(
                    db,
                    publication.idPubli,
                    hashtags
                );
            }
        }

        return res.status(201).json({
            message: 'Duo créé avec succès',
            publication
        });
    } catch (error) {
        if (uploadedFilePath) {
            await fs.unlink(uploadedFilePath).catch(() => {});
        }

        return res.status(400).json({
            error: error.message
        });
    }
}

/*
 * ============================================================
 * COLLAGE
 * ============================================================
 */

async function createCollage(req, res) {
    let uploadedFilePath = null;

    try {
        const { contenuPub } = req.body;
        const visibilite = Number(
            req.body.visibilite
        );

        if (!req.file) {
            return res.status(400).json({
                error: 'Ajoutez votre propre vidéo pour créer un collage.'
            });
        }

        uploadedFilePath = req.file.path;

        const buffer = await fs.readFile(uploadedFilePath);

        let typeMedia;

        try {
            ({ typeMedia } = validateMediaFile(req.file, buffer));
        } catch (validationError) {
            await fs.unlink(uploadedFilePath).catch(() => {});

            return res.status(400).json({
                error: validationError.message
            });
        }

        if (typeMedia !== 'video') {
            await fs.unlink(uploadedFilePath).catch(() => {});

            return res.status(400).json({
                error: 'Le collage nécessite une vidéo, pas une image.'
            });
        }

        const publication =
            postService.createCollage(
                req.user.idUser,
                req.params.idPubli,
                contenuPub,
                visibilite,
                req.file.filename,
                typeMedia
            );

        uploadedFilePath = null;

        if (contenuPub) {
            const hashtags =
                extractHashtags(contenuPub);

            if (hashtags.length > 0) {
                hashtagModel.associerHashtagsPubli(
                    db,
                    publication.idPubli,
                    hashtags
                );
            }
        }

        return res.status(201).json({
            message:
                'Collage créé avec succès',
            publication
        });
    } catch (error) {
        if (uploadedFilePath) {
            await fs.unlink(uploadedFilePath).catch(() => {});
        }

        return res.status(400).json({
            error: error.message
        });
    }
}

/*
 * ============================================================
 * RÉCUPÉRER UNE PUBLICATION
 * ============================================================
 */

function getPublication(req, res) {
    try {
        const publication =
            postService.getPublication(
                req.params.idPubli
            );

        return res.status(200).json(
            publication
        );
    } catch (error) {
        return res.status(404).json({
            error: error.message
        });
    }
}

/*
 * ============================================================
 * LIEN DE PARTAGE
 * ============================================================
 */

function sharePublication(req, res) {
    try {
        const idPubli = Number(
            req.params.idPubli
        );

        const publication =
            postService.getPublicationForUser(
                idPubli,
                req.user.idUser
            );

        const baseUrl =
            `${req.protocol}://${req.get('host')}`;

        const shareUrl =
            `${baseUrl}/publication/${publication.idPubli}`;

        return res.status(200).json({
            message:
                'Lien de partage généré',
            url: shareUrl
        });
    } catch (error) {
        return res.status(404).json({
            error: error.message
        });
    }
}

/*
 * ============================================================
 * CHAÎNE DES REMIXES
 * ============================================================
 */

function getRemixChain(req, res) {
    try {
        const idPubli = Number(
            req.params.idPubli
        );

        const chain =
            postService.getRemixChainForUser(
                idPubli,
                req.user.idUser
            );

        return res.status(200).json({
            publication: idPubli,
            chain
        });
    } catch (error) {
        return res.status(404).json({
            error: error.message
        });
    }
}

/*
 * ============================================================
 * UPLOAD PHOTO / VIDÉO
 * ============================================================
 */

async function uploadImage(req, res) {
    let uploadedFilePath = null;

    try {
        /*
         * AUTHENTIFICATION
         */
        if (
            !req.user ||
            !req.user.idUser
        ) {
            return res.status(401).json({
                error:
                    'Utilisateur non authentifié'
            });
        }

        /*
         * FICHIER
         */
        if (!req.file) {
            return res.status(400).json({
                error:
                    'Aucun fichier envoyé'
            });
        }

        const file = req.file;

        uploadedFilePath = file.path;

        /*
         * TYPE, TAILLE ET SIGNATURE RÉELLE DU FICHIER
         */
        const buffer =
            await fs.readFile(
                uploadedFilePath
            );

        /*
         * VÉRIFICATION MÉDIA ÉDITÉ
         *
         * Si le fichier vient de l'éditeur navigateur
         * (retouche photo/vidéo), on impose en plus le
         * format exact produit par l'éditeur (JPEG / WebM).
         */
        if (req.body.editedMedia === 'true') {
            const editedValidation = validateEditedImage({
                buffer,
                mimetype: file.mimetype,
                size: file.size
            });

            if (!editedValidation.valid) {
                await fs.unlink(uploadedFilePath).catch(() => {});

                return res.status(400).json({
                    error: editedValidation.error
                });
            }
        }

        if (req.body.editedVideo === 'true') {
            const editedValidation = validateEditedVideo({
                buffer,
                mimetype: file.mimetype,
                size: file.size
            });

            if (!editedValidation.valid) {
                await fs.unlink(uploadedFilePath).catch(() => {});

                return res.status(400).json({
                    error: editedValidation.error
                });
            }
        }

        let typeMedia;

        try {
            ({ typeMedia } = validateMediaFile(file, buffer));
        } catch (validationError) {
            await fs
                .unlink(uploadedFilePath)
                .catch(() => {});

            return res.status(400).json({
                error: validationError.message
            });
        }

        /*
         * DESCRIPTION
         */
        const contenuPub =
            req.body.contenuPub
                ? String(
                    req.body.contenuPub
                ).trim()
                : null;

        /*
         * VISIBILITÉ
         */
        const visibilite =
            req.body.visibilite !== undefined
                ? Number(
                    req.body.visibilite
                )
                : 1;

        if (
            visibilite !== 0 &&
            visibilite !== 1
        ) {
            await fs
                .unlink(uploadedFilePath)
                .catch(() => {});

            return res.status(400).json({
                error:
                    'Visibilité invalide.'
            });
        }

        /*
         * CRÉATION DE LA PUBLICATION
         */
        const post =
            await postService.createMediaPost(
                req.user.idUser,
                contenuPub,
                visibilite,
                file.filename,
                typeMedia
            );

        /*
         * Le fichier est maintenant associé
         * à une publication.
         */
        uploadedFilePath = null;

        /*
         * Hashtags également pour les
         * publications photo/vidéo.
         */
        if (contenuPub) {
            const hashtags =
                extractHashtags(contenuPub);

            if (hashtags.length > 0) {
                hashtagModel.associerHashtagsPubli(
                    db,
                    post.idPubli,
                    hashtags
                );
            }
        }

        return res.status(201).json({
            message:
                'Publication créée avec succès.',
            post,
            url:
                `/uploads/${file.filename}`
        });

    } catch (error) {
        console.error(
            'Erreur upload :',
            error
        );

        if (uploadedFilePath) {
            await fs
                .unlink(uploadedFilePath)
                .catch(() => {});
        }

        return res.status(500).json({
            error:
                'Erreur lors de la publication.'
        });
    }
}

/*
 * ============================================================
 * SUPPRESSION D'UNE PUBLICATION
 * ============================================================
 */

async function deletePost(req, res) {
    try {
        /*
         * AUTHENTIFICATION
         */
        if (
            !req.user ||
            !req.user.idUser
        ) {
            return res.status(401).json({
                error:
                    'Utilisateur non authentifié'
            });
        }

        /*
         * IDENTIFIANT
         */
        const idPubli = Number(
            req.params.idPubli
        );

        if (
            !Number.isInteger(idPubli) ||
            idPubli <= 0
        ) {
            return res.status(400).json({
                error:
                    'Identifiant de publication invalide'
            });
        }

        /*
         * SUPPRESSION EN BASE
         */
        const medias =
            await postService.deletePost(
                idPubli,
                req.user.idUser
            );

        /*
         * SUPPRESSION DES FICHIERS
         *
         * Une publication peut avoir plusieurs médias
         * (ex : un Duo ou un collage a son propre média
         * en plus de celui de la publication d'origine).
         */
        for (const media of medias) {
            try {
                await deleteUploadedFile(
                    media.nomMedia
                );
            } catch (fileError) {
                console.error(
                    'Erreur suppression fichier média :',
                    fileError.message
                );
            }
        }

        return res.status(200).json({
            message:
                'Publication supprimée'
        });

    } catch (error) {
        console.error(
            'Erreur suppression publication :',
            error
        );

        if (error.status) {
            return res.status(
                error.status
            ).json({
                error:
                    error.message
            });
        }

        return res.status(500).json({
            error:
                'Erreur lors de la suppression de la publication'
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
            await postService.getAllPosts(
                req.user?.idUser
            );

        return res.render(
            'posts',
            {
                user: req.user,
                posts
            }
        );

    } catch (error) {
        console.error(
            'Erreur chargement page publication :',
            error
        );

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
            await postService.getAllPosts(
                req.user?.idUser
            );

        return res.status(200).json(
            posts
        );

    } catch (error) {
        console.error(
            'Erreur API publications :',
            error
        );

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
            Number(
                req.params.idUser
            );

        if (
            !Number.isInteger(idUser) ||
            idUser <= 0
        ) {
            return res.status(400).json({
                error:
                    'Identifiant utilisateur invalide.'
            });
        }

        const posts =
            await postService.getUserPosts(
                idUser,
                req.user?.idUser
            );

        return res.status(200).json(
            posts
        );

    } catch (error) {
        console.error(
            'Erreur API publications utilisateur :',
            error
        );

        return res.status(500).json({
            error:
                'Erreur lors du chargement des publications.'
        });
    }
}

/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
    createPublication,
    createRepost,
    createDuo,
    createCollage,
    getPublication,
    sharePublication,
    getRemixChain,

    uploadImage,
    getImages,
    getImagesApi,
    getUserImagesApi,

    isRealJPEG,
    isRealPNG,
    isRealWebP,
    isRealMP4,
    isRealWebM,
    isRealOGG,

    deletePost
};