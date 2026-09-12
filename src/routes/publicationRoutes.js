const express = require('express');

const publicationController = require('../controllers/publicationController');
const authMiddleware = require('../middlewares/authMiddleware');
const publicationPermissionMiddleware = require('../middlewares/publicationPermissionMiddleware');

const router = express.Router();

// Récupérer une publication
router.get(
    '/:idPubli',
    authMiddleware,
    publicationPermissionMiddleware,
    publicationController.obtenirPublication
);

// Modifier la visibilité d'une publication
router.patch(
    '/:idPubli/visibilite',
    authMiddleware,
    publicationController.modifierVisibilite
);

module.exports = router;