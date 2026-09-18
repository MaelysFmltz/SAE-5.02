const express = require('express');
const multer = require('multer');

const postController = require('../controllers/postController');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

// ============================================================
// PUBLICATIONS CLASSIQUES
// ============================================================

// Créer une publication
router.post(
    '/',
    authMiddleware,
    postController.createPublication
);

// ============================================================
// REPARTAGE / DUO / COLLAGE
// ============================================================

// Repartager une publication
router.post(
    '/:idPubli/repartage',
    authMiddleware,
    postController.createRepost
);

// Créer un Duo
router.post(
    '/:idPubli/duo',
    authMiddleware,
    postController.createDuo
);

// Créer un collage
router.post(
    '/:idPubli/collage',
    authMiddleware,
    postController.createCollage
);

// Récupérer la chaîne des remixes
router.get(
    '/:idPubli/remixes',
    authMiddleware,
    postController.getRemixChain
);

// Générer un lien de partage
router.get(
    '/:idPubli/partager',
    authMiddleware,
    postController.sharePublication
);

// ============================================================
// PHOTOS / VIDÉOS
// ============================================================

// Récupérer les médias
router.get(
    '/',
    authMiddleware,
    postController.getImages
);

// Upload d'une photo ou d'une vidéo
router.post(
    '/upload',
    authMiddleware,
    (req, res, next) => {
        upload.single('media')(req, res, (err) => {
            if (err) {
                // Fichier refusé par le fileFilter
                if (
                    err.message ===
                    'Type de fichier non autorisé'
                ) {
                    return res.status(400).json({
                        error: 'Type de fichier non autorisé.'
                    });
                }

                // Limite de taille Multer
                if (err instanceof multer.MulterError) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(400).json({
                            error: 'Le fichier est trop volumineux.'
                        });
                    }

                    return res.status(400).json({
                        error: err.message
                    });
                }

                return res.status(400).json({
                    error:
                        err.message ||
                        'Erreur lors de l’envoi du fichier.'
                });
            }

            next();
        });
    },
    postController.uploadImage
);

// Supprimer une publication contenant un média
router.delete(
    '/api/:idPubli',
    authMiddleware,
    postController.deletePost
);

// API : récupérer les médias
router.get(
    '/api',
    authMiddleware,
    postController.getImagesApi
);

// API : récupérer les médias d'un utilisateur
router.get(
    '/api/user/:idUser',
    authMiddleware,
    postController.getUserImagesApi
);

module.exports = router;