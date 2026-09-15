/**
 * Modèle Message
 * Accès direct à la base pour la table Message :
 * création d'un message, lecture des messages d'une conversation,
 * marquage en lu.
 */

const db = require('../config/database');

/**
 * Enregistre un nouveau message dans une conversation
 */
function createMessage(idConversation, idUser, contenu) {
  const info = db.prepare(
    'INSERT INTO Message (idConversation, idUser, contenu) VALUES (?, ?, ?)'
  ).run(idConversation, idUser, contenu);
  return info.lastInsertRowid;
}

/**
 * Récupère les messages d'une conversation, triés du plus ancien au plus récent
 */
function getMessagesByConversation(idConversation) {
  return db.prepare(
    `SELECT idMessage, idConversation, idUser, contenu, dateEnvoi, lu, dateLecture
     FROM Message
     WHERE idConversation = ?
     ORDER BY dateEnvoi ASC`
  ).all(idConversation);
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
  markConversationAsRead
};