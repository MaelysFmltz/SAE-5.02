/**
 * Authentification des routes Message
 * Définit les endpoints liés aux messages d'une conversation
 * (lecture, envoi, marquage en lu).
 */
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/:idConversation/messages', messageController.getMessages);
router.post('/:idConversation/messages', messageController.sendMessage);
router.put('/:idConversation/read', messageController.markAsRead);
router.put('/:idConversation/messages/:idMessage', messageController.editMessage);
router.delete('/:idConversation/messages/:idMessage', messageController.deleteMessage);

module.exports = router;