/**
 * Routes Notification (API JSON)
 * GET /api/notifications              : liste groupée
 * GET /api/notifications/unread-count : nombre de groupes non lus (pastille)
 * PUT /api/notifications/read         : marque comme lu (un groupe, ou tout)
 * Toutes les routes nécessitent d'être authentifié.
 */
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', notificationController.getMine);
router.get('/unread-count', notificationController.getUnreadCount);
router.put('/read', notificationController.markAsRead);

module.exports = router;