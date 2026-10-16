/**
 * Modèle Message
 * Accès direct à la base pour la table Message :
 * création d'un message, lecture des messages d'une conversation,
 * marquage en lu.
 */

const db = require('../config/database');

/**
 * Enregistre un nouveau message dans une conversation et retourne la ligne
 * complète telle qu'enregistrée (dateEnvoi générée par SQLite incluse) :
 * le simple lastInsertRowid ne suffit pas au front pour afficher l'heure
 * d'envoi sans recharger la page.
 */
function createMessage(idConversation, idUser, contenu) {
  const info = db.prepare(
    'INSERT INTO Message (idConversation, idUser, contenu) VALUES (?, ?, ?)'
  ).run(idConversation, idUser, contenu);

  return getMessageById(info.lastInsertRowid);
}

/**
 * Récupère les messages d'une conversation, triés du plus ancien au plus récent
 */
function getMessagesByConversation(idConversation) {
  return db.prepare(
    `SELECT idMessage, idConversation, idUser, contenu, dateEnvoi, lu, dateLecture, dateModification, supprime
     FROM Message
     WHERE idConversation = ?
     ORDER BY dateEnvoi ASC`
  ).all(idConversation);
}

/**
 * Récupère un message par son id
 */
function getMessageById(idMessage) {
  return db.prepare(
    `SELECT idMessage, idConversation, idUser, contenu, dateEnvoi, lu, dateLecture, dateModification, supprime
     FROM Message
     WHERE idMessage = ?`
  ).get(idMessage);
}

/**
 * Remplace le contenu d'un message et marque sa date de modification
 * (affichée côté front comme badge "modifié")
 */
function updateContenu(idMessage, contenu) {
  db.prepare(
    `UPDATE Message SET contenu = ?, dateModification = CURRENT_TIMESTAMP WHERE idMessage = ?`
  ).run(contenu, idMessage);
  return getMessageById(idMessage);
}

/**
 * Supprime "en douceur" un message : le contenu est effacé et le flag
 * supprime posé, mais la ligne reste en base (trace "message supprimé"
 * affichée côté front, à la place du contenu)
 */
function softDeleteMessage(idMessage) {
  db.prepare(
    `UPDATE Message SET contenu = '', supprime = 1 WHERE idMessage = ?`
  ).run(idMessage);
  return getMessageById(idMessage);
}

/**
 * Marque comme lus tous les messages d'une conversation qui n'ont pas été
 * envoyés par idUser (on ne marque jamais ses propres messages comme "lus par soi-même")
 */
function markConversationAsRead(idConversation, idUser) {
  return db.prepare(
    `UPDATE Message
     SET lu = 1, dateLecture = CURRENT_TIMESTAMP
     WHERE idConversation = ? AND idUser != ? AND lu = 0`
  ).run(idConversation, idUser);
}

module.exports = {
  createMessage,
  getMessagesByConversation,
  getMessageById,
  updateContenu,
  softDeleteMessage,
  markConversationAsRead
};