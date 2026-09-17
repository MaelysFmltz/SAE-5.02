/**
 * Routes Conversation
 * Définit les endpoints /conversations (liste, création directe, création de groupe).
 * Toutes les routes nécessitent d'être authentifié.
 */

const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', conversationController.getMyConversations);
router.post('/direct', conversationController.createDirect);
router.post('/group', conversationController.createGroup);
router.get('/:idConversation/members', conversationController.getMembers);
router.post('/:idConversation/members', conversationController.addParticipants);
router.delete('/:idConversation/members/:idUser', conversationController.removeParticipant);
router.put('/:idConversation', conversationController.renameGroup);
router.post('/:idConversation/leave', conversationController.leaveGroup);
router.delete('/:idConversation', conversationController.deleteConversation);

module.exports = router;