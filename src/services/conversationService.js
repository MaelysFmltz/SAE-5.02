/**
 * Service Conversation
 * Logique métier pour la création et la consultation des conversations :
 * réutilisation d'une conversation à 2 déjà existante, création de groupe,
 * vérification d'appartenance à une conversation (utilisée par messageService).
 */

const db = require('../config/database');
const conversationModel = require('../models/conversationModel');
const conversationMemberModel = require('../models/conversationMemberModel');

// Transaction atomique : la conversation et ses membres sont créés ensemble,
// ou pas du tout (même logique que executeRegisterTransaction dans authService)
const executeCreateDirectTransaction = db.transaction((idUserA, idUserB) => {
  const idConversation = conversationModel.createConversation(null);
  conversationMemberModel.addMembers(idConversation, [idUserA, idUserB]);
  return idConversation;
});

const executeCreateGroupTransaction = db.transaction((titreGroupe, idUsers) => {
  const idConversation = conversationModel.createConversation(titreGroupe);
  conversationMemberModel.addMembers(idConversation, idUsers);
  return idConversation;
});

/**
 * Crée une conversation privée entre 2 utilisateurs, ou réutilise celle
 * qui existe déjà entre eux s'il y en a une
 */
async function createDirectConversation(idUserCourant, idUserDestinataire) {
  if (!idUserDestinataire) {
    throw new Error('Destinataire manquant');
  }

  if (idUserCourant === idUserDestinataire) {
    throw new Error('Impossible de démarrer une conversation avec soi-même');
  }

  const existante = conversationModel.findDirectConversationBetween(
    idUserCourant,
    idUserDestinataire
  );

  if (existante) {
    return existante.idConversation;
  }

  return executeCreateDirectTransaction(idUserCourant, idUserDestinataire);
}

/**
 * Crée une conversation de groupe. idUserCourant est automatiquement ajouté
 * s'il n'est pas déjà dans la liste des membres
 */
async function createGroupConversation(idUserCourant, membres, titreGroupe) {
  if (!Array.isArray(membres) || membres.length < 2) {
    throw new Error('Un groupe nécessite au moins 2 autres membres');
  }

  const idUsers = Array.from(new Set([idUserCourant, ...membres]));

  return executeCreateGroupTransaction(titreGroupe || null, idUsers);
}

async function getMyConversations(idUser) {
  return conversationModel.getConversationsForUser(idUser);
}

/**
 * Vérifie qu'un utilisateur a le droit d'agir dans une conversation.
 * Réutilisée par messageService avant chaque lecture/écriture.
 */
function ensureIsMember(idConversation, idUser) {
  if (!conversationModel.isMember(idConversation, idUser)) {
    throw new Error('Conversation introuvable ou accès non autorisé');
  }
}

module.exports = {
  createDirectConversation,
  createGroupConversation,
  getMyConversations,
  ensureIsMember
};