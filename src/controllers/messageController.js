/**
 * Controller Message
 * Reçoit les requêtes HTTP liées aux messages d'une conversation
 * (lecture, envoi, marquage en lu), délègue à messageService.
 */

const { repondreErreur } = require('../utils/httpErrors');
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
    return repondreErreur(res, err, 'Erreur messagerie');
  }
}

async function sendMessage(req, res) {
  try {
    const idConversation = parseIdConversation(req.params.idConversation);
    const { contenu } = req.body;
    const message = await messageService.sendMessage(idConversation, req.user.idUser, contenu);
    return res.status(201).json(message);
  } catch (err) {
    return repondreErreur(res, err, 'Erreur messagerie');
  }
}

async function markAsRead(req, res) {
  try {
    const idConversation = parseIdConversation(req.params.idConversation);
    await messageService.markAsRead(idConversation, req.user.idUser);
    return res.status(200).json({ message: 'Conversation marquée comme lue' });
  } catch (err) {
    return repondreErreur(res, err, 'Erreur messagerie');
  }
}

/**
 * Parse un idMessage de route en entier valide, ou lève une erreur 400.
 */
function parseIdMessage(raw) {
  const idMessage = Number(raw);

  if (!Number.isInteger(idMessage) || idMessage <= 0) {
    const err = new Error('Identifiant de message invalide');
    err.status = 400;
    throw err;
  }

  return idMessage;
}

async function editMessage(req, res) {
  try {
    const idConversation = parseIdConversation(req.params.idConversation);
    const idMessage = parseIdMessage(req.params.idMessage);
    const { contenu } = req.body;

    const message = await messageService.editMessage(idConversation, req.user.idUser, idMessage, contenu);
    return res.status(200).json(message);
  } catch (err) {
    return repondreErreur(res, err, 'Erreur messagerie');
  }
}

async function deleteMessage(req, res) {
  try {
    const idConversation = parseIdConversation(req.params.idConversation);
    const idMessage = parseIdMessage(req.params.idMessage);

    const message = await messageService.deleteMessage(idConversation, req.user.idUser, idMessage);
    return res.status(200).json(message);
  } catch (err) {
    return repondreErreur(res, err, 'Erreur messagerie');
  }
}

async function reagirMessage(req, res) {
  try {
    const idConversation = parseIdConversation(req.params.idConversation);
    const idMessage = parseIdMessage(req.params.idMessage);
    const emoji = req.body ? req.body.emoji : undefined;

    const message = await messageService.reagirMessage(idConversation, req.user.idUser, idMessage, emoji);
    return res.status(200).json(message);
  } catch (err) {
    return repondreErreur(res, err, 'Erreur messagerie');
  }
}

async function retirerReaction(req, res) {
  try {
    const idConversation = parseIdConversation(req.params.idConversation);
    const idMessage = parseIdMessage(req.params.idMessage);

    const message = await messageService.retirerReaction(idConversation, req.user.idUser, idMessage);
    return res.status(200).json(message);
  } catch (err) {
    return repondreErreur(res, err, 'Erreur messagerie');
  }
}

module.exports = {
  reagirMessage,
  retirerReaction,
  getMessages,
  sendMessage,
  markAsRead,
  editMessage,
  deleteMessage
};
