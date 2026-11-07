const express = require('express');

const publicationController = require('../controllers/publicationController');
const authMiddleware = require('../middlewares/authMiddleware');
const publicationPermissionMiddleware = require('../middlewares/publicationPermissionMiddleware');

const router = express.Router();

// Créer une publication
router.post(
    '/',
    authMiddleware,
    publicationController.creerPublication
);

// Récupérer une publication
router.get(
    '/:idPubli',
    authMiddleware,
    publicationPermissionMiddleware,
    publicationController.obtenirPublication
);


// Modifier ou supprimer la légende d'une publication
router.patch(
    '/:idPubli/legende',
    authMiddleware,
    publicationController.modifierLegende
);

router.delete(
    '/:idPubli/legende',
    authMiddleware,
    publicationController.modifierLegende
);

// Activer/désactiver les commentaires d'une publication
router.patch(
    '/:idPubli/commentaires',
    authMiddleware,
    publicationController.modifierCommentaires
);

// Modifier la visibilité d'une publication
router.patch(
    '/:idPubli/visibilite',
    authMiddleware,
    publicationController.modifierVisibilite
);

module.exports = router;