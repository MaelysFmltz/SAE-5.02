const express = require('express');
const publicationController = require('../controllers/publicationController');
const authMiddleware = require('../middlewares/authMiddleware');
const publicationPermissionMiddleware = require('../middlewares/publicationPermissionMiddleware');

const router = express.Router();

router.post(
    '/',
    authMiddleware,
    publicationController.creerPublication
);

router.get(
    '/:idPubli',
    authMiddleware,
    publicationPermissionMiddleware,
    publicationController.obtenirPublication
);

router.patch(
    '/:idPubli/visibilite',
    authMiddleware,
    publicationController.modifierVisibilite
);

module.exports = router;