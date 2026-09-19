const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

// Routes paramètres utilisateur
router.put('/settings/pseudo', authMiddleware, userController.updatePseudo);
router.put('/settings/email', authMiddleware, userController.updateEmail);
router.put('/settings/password', authMiddleware, userController.updatePassword);
router.delete('/settings/account', authMiddleware, userController.deleteAccount);

// Routes administration
router.get('/settings/admin/search', authMiddleware, userController.searchUsersAdmin);
router.put('/settings/admin/role', authMiddleware, userController.changeUserRoleAdmin);

module.exports = router;