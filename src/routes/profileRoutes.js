const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middlewares/authMiddleware');
const handleUpload = require('../middlewares/handleUpload');

// Toutes les routes de profil nécessitent d'être authentifié
router.use(authMiddleware);

// Obtenir son propre profil (bouton Profil en bas à droite)
router.get('/me', profileController.getMe);

// Mettre à jour son propre profil
router.put('/me', profileController.updateMe);

// Changer sa photo de profil
router.post('/avatar', handleUpload('avatar'), profileController.uploadAvatar);

// Consulter le profil public d'un autre utilisateur
router.get('/:pseudo', profileController.getByPseudo);

module.exports = router;