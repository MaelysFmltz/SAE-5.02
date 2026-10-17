/**
 * Service Notification
 * Logique métier des notifications :
 *  - creerNotification() : fonction que les AUTRES fonctionnalités appellent
 *    (abonnement, like, commentaire, message...) pour créer une notification ;
 *  - lecture groupée avec le texte et le lien prêts à afficher ;
 *  - compteur de non lues et marquage en lu.
 */
const notificationModel = require('../models/notificationModel');

const TYPES_VALIDES = [
  'nouvel_abonne',
  'like',
  'message',
  'reaction_message',
  'commentaire',
  'reponse_commentaire'
];

// Pour ces types, on ne notifie qu'une fois par personne (évite like / unlike / like)
const TYPES_SANS_DOUBLON = ['nouvel_abonne', 'like'];

/**
 * Crée une notification. Volontairement SYNCHRONE (pas de await nécessaire)
 * et qui ne plante JAMAIS : une notification ratée ne doit pas empêcher
 * un like ou un message de fonctionner chez les autres.
 *
 * @param {number} idDestinataire  qui reçoit la notification
 * @param {number} idActeur        qui a fait l'action
 * @param {string} type            un des types de TYPES_VALIDES
 * @param {number|null} idSource   id de la page où mène la notification
 */
function creerNotification(idDestinataire, idActeur, type, idSource = null) {
  try {
    if (!TYPES_VALIDES.includes(type)) {
      throw new Error(`Type de notification inconnu : ${type}`);
    }

    // On ne se notifie pas soi-même
    if (!idDestinataire || idDestinataire === idActeur) {
      return null;
    }

    if (
      TYPES_SANS_DOUBLON.includes(type) &&
      notificationModel.exists(idDestinataire, idActeur, type, idSource)
    ) {
      return null;
    }

    return notificationModel.createNotification(idDestinataire, idActeur, type, idSource);
  } catch (err) {
    console.error('Erreur création notification :', err.message);
    return null;
  }
}

/**
 * Construit le texte affiché pour un groupe de notifications
 */
function construireTexte(groupe) {
  const acteur = groupe.dernierActeur || 'Quelqu’un';
  const autres = groupe.nbActeurs - 1;
  const pluriel = autres > 0;
  const sujet = pluriel
    ? `${acteur} et ${autres} autre${autres > 1 ? 's' : ''}`
    : acteur;

  switch (groupe.type) {
    case 'nouvel_abonne':
      return `${sujet} ${pluriel ? 'vous suivent' : 'vous suit'} maintenant`;
    case 'like':
      return `${sujet} ${pluriel ? 'ont aimé' : 'a aimé'} votre publication`;
    case 'commentaire':
      return `${sujet} ${pluriel ? 'ont commenté' : 'a commenté'} votre publication`;
    case 'reponse_commentaire':
      return `${sujet} ${pluriel ? 'ont répondu' : 'a répondu'} à votre commentaire`;
    case 'reaction_message':
      return `${sujet} ${pluriel ? 'ont réagi' : 'a réagi'} à votre message`;
    case 'message':
      return groupe.nombre > 1
        ? `${acteur} vous a envoyé ${groupe.nombre} messages`
        : `${acteur} vous a envoyé un message`;
    default:
      return 'Nouvelle notification';
  }
}

/**
 * Construit le lien vers lequel mène un groupe de notifications
 */
function construireLien(groupe) {
  switch (groupe.type) {
    case 'nouvel_abonne':
      return groupe.dernierActeur
        ? `/profile/${encodeURIComponent(groupe.dernierActeur)}`
        : '/profile';
    case 'like':
    case 'commentaire':
    case 'reponse_commentaire':
      return `/publication/${groupe.idSource}`;
    case 'message':
    case 'reaction_message':
      return `/messages/${groupe.idSource}`;
    default:
      return '/home';
  }
}

/**
 * Notifications de l'utilisateur connecté, groupées, avec texte et lien
 */
async function getMyNotifications(idUser) {
  if (!idUser) {
    throw new Error('Identifiant utilisateur manquant');
  }

  return notificationModel.getGroupedByUser(idUser).map((groupe) => ({
    ...groupe,
    texte: construireTexte(groupe),
    lien: construireLien(groupe)
  }));
}

async function countUnread(idUser) {
  return notificationModel.countUnreadGroups(idUser);
}

async function markAllAsRead(idUser) {
  return notificationModel.markAllAsRead(idUser);
}

/**
 * Marque un groupe comme lu (type + idSource) ; sans type, marque tout comme lu
 */
async function markAsRead(idUser, type, idSource) {
  if (!type) {
    return notificationModel.markAllAsRead(idUser);
  }

  if (!TYPES_VALIDES.includes(type)) {
    throw new Error('Type de notification invalide');
  }

  const source = idSource === undefined || idSource === null ? null : Number(idSource);
  if (source !== null && !Number.isInteger(source)) {
    throw new Error('Identifiant de source invalide');
  }

  return notificationModel.markGroupAsRead(idUser, type, source);
}

module.exports = {
  TYPES_VALIDES,
  creerNotification,
  getMyNotifications,
  countUnread,
  markAllAsRead,
  markAsRead
};