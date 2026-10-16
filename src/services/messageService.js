/**
 * Service Message
 * Logique métier pour l'envoi et la lecture des messages :
 * validation du contenu, vérification d'appartenance à la conversation
 * (via conversationService), marquage en lu.
 */
const messageModel = require('../models/messageModel');
const conversationModel = require('../models/conversationModel');
const conversationService = require('./conversationService');
const { sanitizeText } = require('../utils/validationUtils');
const db = require('../config/database');

const CONTENU_MAX_LENGTH = 2000;

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Vérifie si deux utilisateurs se sont bloqués.
 */
function sontBloques(idUser1, idUser2) {
  if (!idUser1 || !idUser2) return false;
  const blocage = db.prepare(`
    SELECT 1 FROM Blocage
    WHERE (idUserBloqueur = ? AND idUserBloque = ?)
       OR (idUserBloqueur = ? AND idUserBloque = ?)
  `).get(idUser1, idUser2, idUser2, idUser1);

  return !!blocage;
}

/**
 * Récupère un message et vérifie qu'il appartient bien à la conversation.
 */
function getMessageDeLaConversation(idConversation, idMessage) {
  const message = messageModel.getMessageById(idMessage);

  if (!message || message.idConversation !== idConversation) {
    throw httpError('Message introuvable', 404);
  }

  return message;
}

function validerContenu(contenu) {
  if (typeof contenu !== 'string') {
    throw httpError('Le message ne peut pas être vide', 400);
  }

  const contenuNettoye = sanitizeText(contenu);

  if (contenuNettoye.length === 0) {
    throw httpError('Le message ne peut pas être vide', 400);
  }

  if (contenuNettoye.length > CONTENU_MAX_LENGTH) {
    throw httpError(`Le message ne peut pas dépasser ${CONTENU_MAX_LENGTH} caractères`, 400);
  }

  return contenuNettoye;
}

async function sendMessage(idConversation, idUser, contenu) {
  conversationService.ensureIsMember(idConversation, idUser);

  // Vérifier si la conversation est directe et si les membres se bloquent
  const membres = conversationModel.getMembers(idConversation);
  const conversation = conversationModel.getConversationById(idConversation);

  if (conversation && !conversation.titreGroupe && membres && membres.length === 2) {
    const autreMembre = membres.find(m => m.idUser !== idUser);
    if (autreMembre && sontBloques(idUser, autreMembre.idUser)) {
      throw httpError('Impossible d’envoyer un message : cet utilisateur est bloqué', 403);
    }
  }

  const contenuNettoye = validerContenu(contenu);

  return messageModel.createMessage(idConversation, idUser, contenuNettoye);
}

async function getMessages(idConversation, idUser) {
  conversationService.ensureIsMember(idConversation, idUser);
  return messageModel.getMessagesByConversation(idConversation);
}

async function markAsRead(idConversation, idUser) {
  conversationService.ensureIsMember(idConversation, idUser);
  return messageModel.markConversationAsRead(idConversation, idUser);
}

async function editMessage(idConversation, idUser, idMessage, contenu) {
  conversationService.ensureIsMember(idConversation, idUser);

  const message = getMessageDeLaConversation(idConversation, idMessage);

  if (message.idUser !== idUser) {
    throw httpError('Vous ne pouvez modifier que vos propres messages', 403);
  }

  if (message.supprime) {
    throw httpError('Un message supprimé ne peut pas être modifié', 400);
    }

  const contenuNettoye = validerContenu(contenu);

  return messageModel.updateContenu(idMessage, contenuNettoye);
}

async function deleteMessage(idConversation, idUser, idMessage) {
  conversationService.ensureIsMember(idConversation, idUser);

  const message = getMessageDeLaConversation(idConversation, idMessage);

  const estAuteur = message.idUser === idUser;
  const estChefDuGroupe = conversationService.isCreateur(idConversation, idUser);

  if (!estAuteur && !estChefDuGroupe) {
    throw httpError('Vous n’avez pas le droit de supprimer ce message', 403);
  }

  if (message.supprime) {
    throw httpError('Ce message est déjà supprimé', 400);
  }

  return messageModel.softDeleteMessage(idMessage);
}

module.exports = {
  sendMessage,
  getMessages,
  markAsRead,
  editMessage,
  deleteMessage
};