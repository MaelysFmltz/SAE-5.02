const express = require('express');
const router = express.Router();

const searchController = require('../controllers/searchController');
const authMiddleware = require('../middlewares/authMiddleware');

// Route d'affichage (vue EJS)
router.get('/', authMiddleware, searchController.afficherPageRecherche);

// Routes API JSON
router.get('/api', authMiddleware, searchController.apiRecherche);
router.get('/tendances', authMiddleware, searchController.apiTendances);

module.exports = router;