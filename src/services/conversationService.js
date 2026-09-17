/**
 * Service Conversation
 * Logique métier pour la création et la consultation des conversations :
 * réutilisation d'une conversation à 2 déjà existante, création de groupe,
 * vérification d'appartenance à une conversation (utilisée par messageService).
 */

const db = require('../config/database');
const conversationModel = require('../models/conversationModel');
const conversationMemberModel = require('../models/conversationMemberModel');
const userModel = require('../models/userModel');
const { sanitizeText } = require('../utils/validationUtils');

const TITRE_GROUPE_MAX_LENGTH = 100;
const MAX_MEMBRES_GROUPE = 50;

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Convertit une valeur en identifiant utilisateur valide (entier positif),
 * ou lève une erreur explicite sinon.
 */
function toValidUserId(valeur) {
  const id = Number(valeur);

  if (!Number.isInteger(id) || id <= 0) {
    throw httpError('Identifiant utilisateur invalide', 400);
  }

  return id;
}

/**
 * Vérifie qu'un utilisateur existe bien en base, lève une erreur sinon.
 */
function ensureUserExists(idUser) {
  if (!userModel.findById(idUser)) {
    throw httpError(`Utilisateur introuvable (id ${idUser})`, 404);
  }
}

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
  if (idUserDestinataire === undefined || idUserDestinataire === null) {
    throw httpError('Destinataire manquant', 400);
  }

  const idDestinataire = toValidUserId(idUserDestinataire);

  if (idUserCourant === idDestinataire) {
    throw httpError('Impossible de démarrer une conversation avec soi-même', 400);
  }

  ensureUserExists(idDestinataire);

  const existante = conversationModel.findDirectConversationBetween(
    idUserCourant,
    idDestinataire
  );

  if (existante) {
    return existante.idConversation;
  }

  return executeCreateDirectTransaction(idUserCourant, idDestinataire);
}

/**
 * Crée une conversation de groupe. idUserCourant est automatiquement ajouté
 * s'il n'est pas déjà dans la liste des membres
 */
async function createGroupConversation(idUserCourant, membres, titreGroupe) {
  if (!Array.isArray(membres) || membres.length < 2) {
    throw httpError('Un groupe nécessite au moins 2 autres membres', 400);
  }

  if (membres.length > MAX_MEMBRES_GROUPE) {
    throw httpError(`Un groupe ne peut pas dépasser ${MAX_MEMBRES_GROUPE} membres`, 400);
  }

  const idsMembres = membres.map(toValidUserId);
  const idUsers = Array.from(new Set([idUserCourant, ...idsMembres]));

  idsMembres.forEach(ensureUserExists);

  let titreNettoye = null;

  if (titreGroupe !== undefined && titreGroupe !== null) {
    if (typeof titreGroupe !== 'string') {
      throw httpError('Le titre du groupe doit être une chaîne de caractères', 400);
    }

    titreNettoye = sanitizeText(titreGroupe);

    if (titreNettoye.length > TITRE_GROUPE_MAX_LENGTH) {
      throw httpError(`Le titre du groupe ne peut pas dépasser ${TITRE_GROUPE_MAX_LENGTH} caractères`, 400);
    }

    if (titreNettoye.length === 0) {
      titreNettoye = null;
    }
  }

  return executeCreateGroupTransaction(titreNettoye, idUsers);
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
    throw httpError('Conversation introuvable ou accès non autorisé', 403);
  }
}

/**
 * Récupère les membres d'une conversation, réservé aux membres de celle-ci.
 */
function getConversationMembers(idConversation, idUserCourant) {
  ensureIsMember(idConversation, idUserCourant);
  return conversationModel.getMembers(idConversation);
}

/**
 * Ajoute un ou plusieurs participants à une conversation de groupe existante.
 * Seul un membre actuel de la conversation peut ajouter quelqu'un, et
 * uniquement dans une conversation de groupe (pas une conversation à 2).
 */
async function addParticipants(idConversation, idUserCourant, idUsers) {
  ensureIsMember(idConversation, idUserCourant);

  const conversation = conversationModel.getConversationById(idConversation);

  if (!conversation) {
    throw httpError('Conversation introuvable', 404);
  }

  if (!conversation.titreGroupe) {
    throw httpError(
      'Impossible d’ajouter des participants à une conversation directe',
      400
    );
  }

  if (!Array.isArray(idUsers) || idUsers.length === 0) {
    throw httpError('Aucun participant à ajouter', 400);
  }

  const idsUniques = Array.from(new Set(idUsers.map(toValidUserId)));

  idsUniques.forEach(ensureUserExists);

  const membresActuels = new Set(
    conversationModel.getMembers(idConversation).map((m) => m.idUser)
  );

  const nouveaux = idsUniques.filter((id) => !membresActuels.has(id));

  if (nouveaux.length === 0) {
    throw httpError('Ces utilisateurs sont déjà membres de la conversation', 400);
  }

  conversationMemberModel.addMembers(idConversation, nouveaux);

  return conversationModel.getMembers(idConversation);
}

module.exports = {
  createDirectConversation,
  createGroupConversation,
  getMyConversations,
  ensureIsMember,
  getConversationMembers,
  addParticipants
};