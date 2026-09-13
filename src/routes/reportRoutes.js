const express = require('express');
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminOrModeratorMiddleware = require('../middlewares/adminOrModeratorMiddleware');

const router = express.Router();

router.post(
    '/',
    authMiddleware,
    reportController.creerSignalement
);

router.get(
    '/',
    authMiddleware,
    adminOrModeratorMiddleware,
    reportController.obtenirSignalements
);

router.patch(
    '/:idSignalement/statut',
    authMiddleware,
    adminOrModeratorMiddleware,
    reportController.modifierStatutSignalement
);

router.get(
    '/:idSignalement',
    authMiddleware,
    adminOrModeratorMiddleware,
    reportController.obtenirSignalement
);

module.exports = router;