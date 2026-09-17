const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.put('/settings/pseudo', userController.updatePseudo);
router.put('/settings/email', userController.updateEmail);
router.put('/settings/password', userController.updatePassword);
router.delete('/settings/account', userController.deleteAccount);
router.get('/settings/admin/search', userController.searchUsersAdmin);
router.put('/settings/admin/role', userController.changeUserRoleAdmin);

module.exports = router;