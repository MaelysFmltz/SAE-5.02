/**
 * Service Message
 * Logique métier pour l'envoi et la lecture des messages :
 * validation du contenu, vérification d'appartenance à la conversation
 * (via conversationService), marquage en lu.
 */
const messageModel = require('../models/messageModel');
const conversationService = require('./conversationService');
const { sanitizeText } = require('../utils/validationUtils');

const CONTENU_MAX_LENGTH = 2000;

async function sendMessage(idConversation, idUser, contenu) {
  conversationService.ensureIsMember(idConversation, idUser);

  if (typeof contenu !== 'string' || contenu.trim().length === 0) {
    throw new Error('Le message ne peut pas être vide');
  }

  const contenuNettoye = sanitizeText(contenu.trim());

  if (contenuNettoye.length > CONTENU_MAX_LENGTH) {
    throw new Error(`Le message ne peut pas dépasser ${CONTENU_MAX_LENGTH} caractères`);
  }

  const idMessage = messageModel.createMessage(idConversation, idUser, contenuNettoye);
  return { idMessage, idConversation, idUser, contenu: contenuNettoye };
}

async function getMessages(idConversation, idUser) {
  conversationService.ensureIsMember(idConversation, idUser);
  return messageModel.getMessagesByConversation(idConversation);
}

async function markAsRead(idConversation, idUser) {
  conversationService.ensureIsMember(idConversation, idUser);
  return messageModel.markConversationAsRead(idConversation, idUser);
}

module.exports = {
  sendMessage,
  getMessages,
  markAsRead
};