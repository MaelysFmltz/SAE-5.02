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
const TITRE_GROUPE_DEFAUT = 'Nouveau groupe';

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

const executeCreateGroupTransaction = db.transaction((titreGroupe, idUsers, idCreateur) => {
  const idConversation = conversationModel.createConversation(titreGroupe);
  conversationMemberModel.addMembers(idConversation, idUsers);
  conversationMemberModel.setCreateur(idConversation, idCreateur);
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

  // Un groupe a toujours un titre affichable : "Nouveau groupe" par défaut
  // si aucun n'est fourni (évite d'afficher le pseudo arbitraire d'un
  // membre à la place, et permet de distinguer sans ambiguïté un groupe
  // d'une conversation directe).
  let titreNettoye = TITRE_GROUPE_DEFAUT;

  if (titreGroupe !== undefined && titreGroupe !== null) {
    if (typeof titreGroupe !== 'string') {
      throw httpError('Le titre du groupe doit être une chaîne de caractères', 400);
    }

    const nettoye = sanitizeText(titreGroupe);

    if (nettoye.length > TITRE_GROUPE_MAX_LENGTH) {
      throw httpError(`Le titre du groupe ne peut pas dépasser ${TITRE_GROUPE_MAX_LENGTH} caractères`, 400);
    }

    if (nettoye.length > 0) {
      titreNettoye = nettoye;
    }
  }

  return executeCreateGroupTransaction(titreNettoye, idUsers, idUserCourant);
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
 * Vérifie qu'un utilisateur est bien le créateur/chef d'une conversation.
 * À utiliser après ensureIsMember/ensureConversationDeGroupe, pour que
 * l'erreur la plus précise (pas membre, pas un groupe) soit renvoyée en
 * priorité sur celle-ci.
 */
function ensureEstCreateur(idConversation, idUser) {
  if (!conversationModel.isCreateur(idConversation, idUser)) {
    throw httpError('Seul le créateur du groupe peut effectuer cette action', 403);
  }
}

/**
 * Vérifie qu'une conversation existe et est bien une conversation de
 * groupe (pas une conversation directe à 2), retourne la conversation.
 */
function ensureConversationDeGroupe(idConversation) {
  const conversation = conversationModel.getConversationById(idConversation);

  if (!conversation) {
    throw httpError('Conversation introuvable', 404);
  }

  if (!conversation.titreGroupe) {
    throw httpError('Cette action n’est possible que sur une conversation de groupe', 400);
  }

  return conversation;
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
 * Seul le créateur/chef du groupe peut ajouter quelqu'un.
 */
async function addParticipants(idConversation, idUserCourant, idUsers) {
  ensureIsMember(idConversation, idUserCourant);
  ensureConversationDeGroupe(idConversation);
  ensureEstCreateur(idConversation, idUserCourant);

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

/**
 * Retire un participant d'une conversation de groupe.
 * Seul le créateur/chef du groupe peut retirer quelqu'un, et il ne peut
 * pas se retirer lui-même par cette action (pas de gestion de "groupe
 * sans chef" dans cette version).
 */
async function removeParticipant(idConversation, idUserCourant, idUserARetirer) {
  ensureIsMember(idConversation, idUserCourant);
  ensureConversationDeGroupe(idConversation);
  ensureEstCreateur(idConversation, idUserCourant);

  const idCible = toValidUserId(idUserARetirer);

  if (idCible === idUserCourant) {
    throw httpError('Le créateur du groupe ne peut pas se retirer lui-même', 400);
  }

  if (!conversationModel.isMember(idConversation, idCible)) {
    throw httpError('Cet utilisateur ne fait pas partie de la conversation', 400);
  }

  conversationMemberModel.removeMember(idConversation, idCible);

  return conversationModel.getMembers(idConversation);
}

/**
 * Renomme une conversation de groupe. Seul le créateur/chef peut le faire.
 */
async function renameGroup(idConversation, idUserCourant, nouveauTitre) {
  ensureIsMember(idConversation, idUserCourant);
  ensureConversationDeGroupe(idConversation);
  ensureEstCreateur(idConversation, idUserCourant);

  if (typeof nouveauTitre !== 'string') {
    throw httpError('Le titre du groupe doit être une chaîne de caractères', 400);
  }

  const titreNettoye = sanitizeText(nouveauTitre);

  if (titreNettoye.length === 0) {
    throw httpError('Le titre du groupe ne peut pas être vide', 400);
  }

  if (titreNettoye.length > TITRE_GROUPE_MAX_LENGTH) {
    throw httpError(`Le titre du groupe ne peut pas dépasser ${TITRE_GROUPE_MAX_LENGTH} caractères`, 400);
  }

  conversationModel.updateTitre(idConversation, titreNettoye);

  return titreNettoye;
}

/**
 * Supprime une conversation pour de bon.
 * - Conversation de groupe : réservé au créateur/chef (supprime le groupe
 *   pour tout le monde) ; les autres membres doivent utiliser leaveGroup.
 * - Conversation directe : n'importe lequel des deux membres peut la
 *   supprimer, pour de vrai, pour les deux (pas de masquage "pour soi").
 */
async function deleteConversation(idConversation, idUserCourant) {
  ensureIsMember(idConversation, idUserCourant);

  const conversation = conversationModel.getConversationById(idConversation);

  if (!conversation) {
    throw httpError('Conversation introuvable', 404);
  }

  if (conversation.titreGroupe) {
    ensureEstCreateur(idConversation, idUserCourant);
  }

  conversationModel.deleteConversation(idConversation);
}

/**
 * Un membre (non-chef) quitte un groupe : il est simplement retiré de la
 * conversation, qui continue d'exister pour les autres membres. Le chef ne
 * peut pas quitter par cette action (il doit supprimer le groupe).
 */
async function leaveGroup(idConversation, idUserCourant) {
  ensureIsMember(idConversation, idUserCourant);
  ensureConversationDeGroupe(idConversation);

  if (conversationModel.isCreateur(idConversation, idUserCourant)) {
    throw httpError('Le créateur du groupe doit le supprimer plutôt que le quitter', 400);
  }

  conversationMemberModel.removeMember(idConversation, idUserCourant);
}

module.exports = {
  createDirectConversation,
  createGroupConversation,
  getMyConversations,
  ensureIsMember,
  isCreateur: conversationModel.isCreateur,
  getConversationMembers,
  addParticipants,
  removeParticipant,
  renameGroup,
  deleteConversation,
  leaveGroup
};