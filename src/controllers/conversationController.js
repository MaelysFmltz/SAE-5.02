/**
 * Controller Conversation
 * Reçoit les requêtes HTTP liées aux conversations, délègue à
 * conversationService, et renvoie le code de statut approprié.
 */

const conversationService = require('../services/conversationService');

async function getMyConversations(req, res) {
  try {
    const conversations = await conversationService.getMyConversations(req.user.idUser);
    return res.status(200).json(conversations);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

async function createDirect(req, res) {
  try {
    const { idUserDestinataire } = req.body;
    const idConversation = await conversationService.createDirectConversation(
      req.user.idUser,
      idUserDestinataire
    );
    return res.status(201).json({ idConversation });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

async function createGroup(req, res) {
  try {
    const { membres, titreGroupe } = req.body;
    const idConversation = await conversationService.createGroupConversation(
      req.user.idUser,
      membres,
      titreGroupe
    );
    return res.status(201).json({ idConversation });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getMyConversations,
  createDirect,
  createGroup
};