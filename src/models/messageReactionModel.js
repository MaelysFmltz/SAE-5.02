/**
 * Modèle MessageReaction
 * Réactions (emoji) posées sur les messages d'une conversation.
 * Un utilisateur a au plus UNE réaction par message (clé primaire idMessage + idUser).
 */

const db = require('../config/database');

function getReaction(idMessage, idUser) {
  return db.prepare(
    'SELECT idMessage, idUser, emoji FROM MessageReaction WHERE idMessage = ? AND idUser = ?'
  ).get(idMessage, idUser);
}

/**
 * Pose ou remplace la réaction d'un utilisateur sur un message.
 */
function setReaction(idMessage, idUser, emoji) {
  return db.prepare(`
    INSERT INTO MessageReaction (idMessage, idUser, emoji)
    VALUES (?, ?, ?)
    ON CONFLICT(idMessage, idUser)
    DO UPDATE SET emoji = excluded.emoji, dateReaction = CURRENT_TIMESTAMP
  `).run(idMessage, idUser, emoji);
}

function removeReaction(idMessage, idUser) {
  return db.prepare(
    'DELETE FROM MessageReaction WHERE idMessage = ? AND idUser = ?'
  ).run(idMessage, idUser);
}

/**
 * Supprime toutes les réactions d'un message (utilisé quand le message est supprimé).
 */
function removeAllForMessage(idMessage) {
  return db.prepare('DELETE FROM MessageReaction WHERE idMessage = ?').run(idMessage);
}

/**
 * Toutes les réactions des messages d'une conversation (avec le pseudo de leur auteur),
 * limitées aux messages d'identifiant > apresIdMessage.
 */
function getReactionsForConversation(idConversation, apresIdMessage = 0) {
  return db.prepare(`
    SELECT r.idMessage, r.idUser, r.emoji, u.pseudo
    FROM MessageReaction r
    JOIN Message m ON m.idMessage = r.idMessage
    JOIN Utilisateur u ON u.idUser = r.idUser
    WHERE m.idConversation = ? AND m.idMessage > ?
    ORDER BY r.dateReaction ASC
  `).all(idConversation, apresIdMessage);
}

function getReactionsForMessage(idMessage) {
  return db.prepare(`
    SELECT r.idMessage, r.idUser, r.emoji, u.pseudo
    FROM MessageReaction r
    JOIN Utilisateur u ON u.idUser = r.idUser
    WHERE r.idMessage = ?
    ORDER BY r.dateReaction ASC
  `).all(idMessage);
}

module.exports = {
  getReaction,
  setReaction,
  removeReaction,
  removeAllForMessage,
  getReactionsForConversation,
  getReactionsForMessage
};
