const express = require('express');
const router = express.Router();

const postController = require('../controllers/postController');
const authMiddleware = require('../middlewares/authMiddleware');

// Créer une publication
router.post(
    '/',
    authMiddleware,
    postController.createPublication
);

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

module.exports = router;