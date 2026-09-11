const express = require('express');
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

const router = express.Router();

router.post(
    '/',
    authMiddleware,
    reportController.creerSignalement
);

router.get(
    '/',
    authMiddleware,
    adminMiddleware,
    reportController.obtenirSignalements
);

router.patch(
    '/:idSignalement/statut',
    authMiddleware,
    adminMiddleware,
    reportController.modifierStatutSignalement
);

router.get(
    '/:idSignalement',
    authMiddleware,
    adminMiddleware,
    reportController.obtenirSignalement
);

module.exports = router;