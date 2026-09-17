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

  if (typeof contenu !== 'string') {
    throw new Error('Le message ne peut pas être vide');
  }

  // Nettoyage AVANT le contrôle de vide : un message composé uniquement
  // de balises ("<b></b>") ne doit pas être enregistré comme un message
  // valide juste parce qu'il n'est pas vide avant nettoyage.
  const contenuNettoye = sanitizeText(contenu);

  if (contenuNettoye.length === 0) {
    throw new Error('Le message ne peut pas être vide');
  }

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