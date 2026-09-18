const express = require('express');

const postController = require('../controllers/postController');
const authMiddleware = require('../middlewares/authMiddleware');
const handleUpload = require('../middlewares/handleUpload');

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

// Créer un Duo (média personnel affiché à côté de l'original)
router.post(
    '/:idPubli/duo',
    authMiddleware,
    handleUpload('media'),
    postController.createDuo
);

// Créer un collage (vidéo personnelle associée à la vidéo originale)
router.post(
    '/:idPubli/collage',
    authMiddleware,
    handleUpload('media'),
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
    handleUpload('media'),
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