const fs = require('fs/promises');
const path = require('path');

const postService = require('../services/postService');
const hashtagModel = require('../models/hashtagModel');
const { extractHashtags } = require('../utils/hashtagUtils');
const db = require('../config/database');

/*
 * ============================================================
 * CONSTANTES MÉDIAS
 * ============================================================
 */

const IMAGE_MAX_SIZE = 20 * 1024 * 1024;
const VIDEO_MAX_SIZE = 100 * 1024 * 1024;

const IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp'
];

const VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime'
];

/*
 * ============================================================
 * VÉRIFICATION DES SIGNATURES BINAIRES
 * ============================================================
 */

/**
 * Vérifie la signature réelle d'un JPEG.
 */
function isRealJPEG(buffer) {
    if (
        !Buffer.isBuffer(buffer) ||
        buffer.length < 3
    ) {
        return false;
    }

    return (
        buffer[0] === 0xFF &&
        buffer[1] === 0xD8 &&
        buffer[2] === 0xFF
    );
}

/**
 * Vérifie la signature réelle d'un PNG.
 */
function isRealPNG(buffer) {
    if (
        !Buffer.isBuffer(buffer) ||
        buffer.length < 8
    ) {
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

/**
 * Vérifie la signature réelle d'un WebP.
 */
function isRealWebP(buffer) {
    if (
        !Buffer.isBuffer(buffer) ||
        buffer.length < 12
    ) {
        return false;
    }

    return (
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
    );
}

/**
 * Vérifie qu'un fichier contient une structure MP4/MOV.
 *
 * Les conteneurs ISO Base Media utilisent normalement
 * une boîte "ftyp" dans leur en-tête.
 */
function isRealMP4(buffer) {
    if (
        !Buffer.isBuffer(buffer) ||
        buffer.length < 12
    ) {
        return false;
    }

    const maxOffset = Math.min(
        buffer.length - 4,
        64
    );

    for (
        let i = 0;
        i <= maxOffset;
        i++
    ) {
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

/**
 * Vérifie la signature EBML d'un WebM.
 */
function isRealWebM(buffer) {
    if (
        !Buffer.isBuffer(buffer) ||
        buffer.length < 4
    ) {
        return false;
    }

    return (
        buffer[0] === 0x1A &&
        buffer[1] === 0x45 &&
        buffer[2] === 0xDF &&
        buffer[3] === 0xA3
    );
}

/**
 * Vérifie la signature d'un fichier OGG.
 */
function isRealOGG(buffer) {
    if (
        !Buffer.isBuffer(buffer) ||
        buffer.length < 4
    ) {
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
 * SUPPRESSION SÉCURISÉE D'UN FICHIER
 * ============================================================
 */

/**
 * Supprime un fichier utilisateur uniquement s'il se trouve
 * directement dans le dossier uploads.
 */
async function deleteUploadedFile(filename) {
    if (
        typeof filename !== 'string' ||
        !filename
    ) {
        throw new Error(
            'Nom de fichier invalide'
        );
    }

    const uploadDir = path.resolve(
        __dirname,
        '../../uploads'
    );

    /*
     * On interdit tout chemin.
     * Seul un nom de fichier simple est accepté.
     */
    if (
        filename !== path.basename(filename)
    ) {
        throw new Error(
            'Nom de fichier invalide'
        );
    }

    const filePath = path.resolve(
        uploadDir,
        filename
    );

    /*
     * Le fichier doit être directement dans uploads.
     */
    if (
        path.dirname(filePath) !== uploadDir
    ) {
        throw new Error(
            'Chemin de fichier invalide'
        );
    }

    try {
        await fs.unlink(filePath);
    } catch (error) {
        /*
         * Un fichier déjà absent n'est pas bloquant.
         */
        if (error.code === 'ENOENT') {
            return;
        }

        throw error;
    }
}

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

        const visibilite = Number(
            req.body.visibilite
        );

        const publication =
            postService.createRepost(
                req.user.idUser,
                idPubli,
                visibilite
            );

        return res.status(201).json({
            message:
                'Publication repartagée avec succès',
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

function createDuo(req, res) {
    try {
        const { contenuPub } = req.body;
        const visibilite = Number(
            req.body.visibilite
        );

        const publication =
            postService.createDuo(
                req.user.idUser,
                req.params.idPubli,
                contenuPub,
                visibilite
            );

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

function createCollage(req, res) {
    try {
        const { contenuPub } = req.body;
        const visibilite = Number(
            req.body.visibilite
        );

        const publication =
            postService.createCollage(
                req.user.idUser,
                req.params.idPubli,
                contenuPub,
                visibilite
            );

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
         * DÉTERMINATION DU TYPE
         */
        let typeMedia = null;

        if (
            IMAGE_TYPES.includes(
                file.mimetype
            )
        ) {
            typeMedia = 'image';
        } else if (
            VIDEO_TYPES.includes(
                file.mimetype
            )
        ) {
            typeMedia = 'video';
        } else {
            await fs
                .unlink(uploadedFilePath)
                .catch(() => {});

            return res.status(400).json({
                error:
                    'Format de fichier non autorisé.'
            });
        }

        /*
         * LIMITE DE TAILLE
         */
        const maxSize =
            typeMedia === 'image'
                ? IMAGE_MAX_SIZE
                : VIDEO_MAX_SIZE;

        if (file.size > maxSize) {
            await fs
                .unlink(uploadedFilePath)
                .catch(() => {});

            return res.status(400).json({
                error:
                    typeMedia === 'image'
                        ? 'L’image ne doit pas dépasser 20 Mo.'
                        : 'La vidéo ne doit pas dépasser 100 Mo.'
            });
        }

        /*
         * LECTURE DU FICHIER
         */
        const buffer =
            await fs.readFile(
                uploadedFilePath
            );

        /*
         * VÉRIFICATION IMAGE
         */
        if (typeMedia === 'image') {
            let validImage = false;
            let formatLabel = '';

            if (
                file.mimetype === 'image/jpeg'
            ) {
                formatLabel = 'JPEG';
                validImage =
                    isRealJPEG(buffer);
            } else if (
                file.mimetype === 'image/png'
            ) {
                formatLabel = 'PNG';
                validImage =
                    isRealPNG(buffer);
            } else if (
                file.mimetype === 'image/webp'
            ) {
                formatLabel = 'WebP';
                validImage =
                    isRealWebP(buffer);
            }

            if (!validImage) {
                await fs
                    .unlink(uploadedFilePath)
                    .catch(() => {});

                return res.status(400).json({
                    error:
                        `Le fichier envoyé n'est pas un véritable ${formatLabel}.`
                });
            }
        }

        /*
         * VÉRIFICATION VIDÉO
         */
        if (typeMedia === 'video') {
            let validVideo = false;

            if (
                file.mimetype === 'video/mp4'
            ) {
                validVideo =
                    isRealMP4(buffer);
            } else if (
                file.mimetype === 'video/quicktime'
            ) {
                validVideo =
                    isRealMP4(buffer);
            } else if (
                file.mimetype === 'video/webm'
            ) {
                validVideo =
                    isRealWebM(buffer);
            } else if (
                file.mimetype === 'video/ogg'
            ) {
                validVideo =
                    isRealOGG(buffer);
            }

            if (!validVideo) {
                await fs
                    .unlink(uploadedFilePath)
                    .catch(() => {});

                return res.status(400).json({
                    error:
                        "Le fichier envoyé n'est pas une véritable vidéo."
                });
            }
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
        const media =
            await postService.deletePost(
                idPubli,
                req.user.idUser
            );

        /*
         * SUPPRESSION DU FICHIER
         */
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