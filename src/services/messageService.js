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
const conversationMemberModel = require('../models/conversationMemberModel');
const messageReactionModel = require('../models/messageReactionModel');

const CONTENU_MAX_LENGTH = 2000;

// Liste fermée des réactions possibles (l'ordre est celui de l'affichage)
const EMOJIS_AUTORISES = ['❤️', '😂', '😮', '😢', '😡', '👍'];

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
 * Récupère un message et vérifie qu'il appartient bien à la conversation
 * et qu'il n'a pas été effacé de l'historique de cet utilisateur.
 */
function getMessageDeLaConversation(idConversation, idMessage, idUser) {
  const message = messageModel.getMessageById(idMessage);

  if (!message || message.idConversation !== idConversation) {
    throw httpError('Message introuvable', 404);
  }

  if (idUser && message.idMessage <= conversationMemberModel.getIdMessageMasqueJusqua(idConversation, idUser)) {
    throw httpError('Message introuvable', 404);
  }

  return message;
}

/**
 * Dans une conversation directe, refuse toute interaction si l'un a bloqué l'autre.
 */
function verifierBlocageConversationDirecte(idConversation, idUser, messageErreur) {
  const conversation = conversationModel.getConversationById(idConversation);
  if (!conversation || conversation.titreGroupe) return;

  const membres = conversationModel.getMembers(idConversation);
  if (!membres || membres.length !== 2) return;

  const autreMembre = membres.find(m => m.idUser !== idUser);
  if (autreMembre && sontBloques(idUser, autreMembre.idUser)) {
    throw httpError(messageErreur, 403);
  }
}

/**
 * Regroupe des lignes de réaction par emoji : [{ emoji, total, parMoi, pseudos }]
 */
function regrouperReactions(lignes, idUserCourant) {
  const parEmoji = new Map();

  lignes.forEach((ligne) => {
    if (!parEmoji.has(ligne.emoji)) {
      parEmoji.set(ligne.emoji, { emoji: ligne.emoji, total: 0, parMoi: false, pseudos: [] });
    }
    const groupe = parEmoji.get(ligne.emoji);
    groupe.total += 1;
    groupe.pseudos.push(ligne.pseudo);
    if (ligne.idUser === idUserCourant) groupe.parMoi = true;
  });

  return EMOJIS_AUTORISES
    .filter(emoji => parEmoji.has(emoji))
    .map(emoji => parEmoji.get(emoji));
}

function avecReactions(message, idUserCourant) {
  if (!message) return message;
  const lignes = message.supprime ? [] : messageReactionModel.getReactionsForMessage(message.idMessage);
  return { ...message, reactions: regrouperReactions(lignes, idUserCourant) };
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

  // Conversation directe : pas d'envoi si l'un a bloqué l'autre
  verifierBlocageConversationDirecte(
    idConversation, idUser, 'Impossible d’envoyer un message : cet utilisateur est bloqué'
  );

  const contenuNettoye = validerContenu(contenu);

  const message = db.transaction(() => {
    const cree = messageModel.createMessage(idConversation, idUser, contenuNettoye);
    // Un nouveau message fait réapparaître la conversation chez ceux qui l'avaient retirée de leur liste
    conversationMemberModel.afficherPourTous(idConversation);
    return cree;
  })();

  return { ...message, reactions: [] };
}

async function getMessages(idConversation, idUser) {
  conversationService.ensureIsMember(idConversation, idUser);

  // L'historique effacé par ce membre n'est jamais renvoyé
  const apres = conversationMemberModel.getIdMessageMasqueJusqua(idConversation, idUser);
  const messages = messageModel.getMessagesByConversation(idConversation, apres);
  const lignes = messageReactionModel.getReactionsForConversation(idConversation, apres);

  const lignesParMessage = new Map();
  lignes.forEach((ligne) => {
    if (!lignesParMessage.has(ligne.idMessage)) lignesParMessage.set(ligne.idMessage, []);
    lignesParMessage.get(ligne.idMessage).push(ligne);
  });

  return messages.map(message => ({
    ...message,
    reactions: message.supprime ? [] : regrouperReactions(lignesParMessage.get(message.idMessage) || [], idUser)
  }));
}

async function markAsRead(idConversation, idUser) {
  conversationService.ensureIsMember(idConversation, idUser);
  const result = messageModel.markConversationAsRead(idConversation, idUser);
  conversationMemberModel.markAsReadForMember(idConversation, idUser);
  return result;
}

async function editMessage(idConversation, idUser, idMessage, contenu) {
  conversationService.ensureIsMember(idConversation, idUser);

  const message = getMessageDeLaConversation(idConversation, idMessage, idUser);

  if (message.idUser !== idUser) {
    throw httpError('Vous ne pouvez modifier que vos propres messages', 403);
  }

  if (message.supprime) {
    throw httpError('Un message supprimé ne peut pas être modifié', 400);
  }

  const contenuNettoye = validerContenu(contenu);

  return avecReactions(messageModel.updateContenu(idMessage, contenuNettoye), idUser);
}

async function deleteMessage(idConversation, idUser, idMessage) {
  conversationService.ensureIsMember(idConversation, idUser);

  const message = getMessageDeLaConversation(idConversation, idMessage, idUser);

  const estAuteur = message.idUser === idUser;
  const estChefDuGroupe = conversationService.isCreateur(idConversation, idUser);

  if (!estAuteur && !estChefDuGroupe) {
    throw httpError('Vous n’avez pas le droit de supprimer ce message', 403);
  }

  if (message.supprime) {
    throw httpError('Ce message est déjà supprimé', 400);
  }

  return avecReactions(messageModel.softDeleteMessage(idMessage), idUser);
}

/**
 * Pose une réaction sur un message. Re-choisir le même emoji retire la réaction,
 * en choisir un autre la remplace (une seule réaction par personne et par message).
 */
async function reagirMessage(idConversation, idUser, idMessage, emoji) {
  conversationService.ensureIsMember(idConversation, idUser);

  if (typeof emoji !== 'string' || !EMOJIS_AUTORISES.includes(emoji)) {
    throw httpError('Réaction invalide', 400);
  }

  const message = getMessageDeLaConversation(idConversation, idMessage, idUser);

  if (message.supprime) {
    throw httpError('Impossible de réagir à un message supprimé', 400);
  }

  verifierBlocageConversationDirecte(
    idConversation, idUser, 'Impossible de réagir : cet utilisateur est bloqué'
  );

  const existante = messageReactionModel.getReaction(idMessage, idUser);

  if (existante && existante.emoji === emoji) {
    messageReactionModel.removeReaction(idMessage, idUser);
  } else {
    messageReactionModel.setReaction(idMessage, idUser, emoji);
  }

  return avecReactions(messageModel.getMessageById(idMessage), idUser);
}

async function retirerReaction(idConversation, idUser, idMessage) {
  conversationService.ensureIsMember(idConversation, idUser);
  getMessageDeLaConversation(idConversation, idMessage, idUser);

  messageReactionModel.removeReaction(idMessage, idUser);

  return avecReactions(messageModel.getMessageById(idMessage), idUser);
}

module.exports = {
  EMOJIS_AUTORISES,
  sendMessage,
  getMessages,
  markAsRead,
  editMessage,
  deleteMessage,
  reagirMessage,
  retirerReaction
};