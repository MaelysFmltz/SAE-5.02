const express = require('express');

const authController =
  require('../controllers/authController');

const router = express.Router();

// Inscription
router.post(
  '/register',
  authController.register
);

// Connexion
router.post(
  '/login',
  authController.login
);

// Déconnexion
router.post(
  '/logout',
  authController.logout
);

module.exports = router;