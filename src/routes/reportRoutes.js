const express = require('express');
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, reportController.creerSignalement);

router.get('/', authMiddleware, reportController.obtenirSignalements);

router.get(
    '/:idSignalement',
    authMiddleware,
    reportController.obtenirSignalement
);

module.exports = router;