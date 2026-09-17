/**
 * Controller Message
 * Reçoit les requêtes HTTP liées aux messages d'une conversation
 * (lecture, envoi, marquage en lu), délègue à messageService.
 */

const messageService = require('../services/messageService');

/**
 * Parse un idConversation de route en entier valide, ou lève une erreur 400.
 */
function parseIdConversation(raw) {
  const idConversation = Number(raw);

  if (!Number.isInteger(idConversation) || idConversation <= 0) {
    const err = new Error('Identifiant de conversation invalide');
    err.status = 400;
    throw err;
  }

  return idConversation;
}

async function getMessages(req, res) {
  try {
    const idConversation = parseIdConversation(req.params.idConversation);
    const messages = await messageService.getMessages(idConversation, req.user.idUser);
    return res.status(200).json(messages);
  } catch (err) {
    return res.status(err.status || 403).json({ error: err.message });
  }
}

async function sendMessage(req, res) {
  try {
    const idConversation = parseIdConversation(req.params.idConversation);
    const { contenu } = req.body;
    const message = await messageService.sendMessage(idConversation, req.user.idUser, contenu);
    return res.status(201).json(message);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
}

async function markAsRead(req, res) {
  try {
    const idConversation = parseIdConversation(req.params.idConversation);
    await messageService.markAsRead(idConversation, req.user.idUser);
    return res.status(200).json({ message: 'Conversation marquée comme lue' });
  } catch (err) {
    return res.status(err.status || 403).json({ error: err.message });
  }
}

module.exports = {
  getMessages,
  sendMessage,
  markAsRead
};
