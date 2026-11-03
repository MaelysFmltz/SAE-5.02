/**
 * Modèle ConversationMembre
 * Accès direct à la base pour la table de liaison ConversationMembre :
 * ajout d'un ou plusieurs membres à une conversation existante.
 */

const db = require('../config/database');

/**
 * Ajoute un membre à une conversation
 */
function addMember(idConversation, idUser) {
  return db.prepare(
    'INSERT INTO ConversationMembre (idConversation, idUser) VALUES (?, ?)'
  ).run(idConversation, idUser);
}

/**
 * Ajoute plusieurs membres d'un coup (utilisé à la création d'un groupe)
 */
function addMembers(idConversation, idUsers) {
  const stmt = db.prepare(
    'INSERT INTO ConversationMembre (idConversation, idUser) VALUES (?, ?)'
  );
  for (const idUser of idUsers) {
    stmt.run(idConversation, idUser);
  }
}

/**
 * Marque un membre comme créateur/chef de la conversation de groupe
 */
function setCreateur(idConversation, idUser) {
  return db.prepare(
    'UPDATE ConversationMembre SET estCreateur = 1 WHERE idConversation = ? AND idUser = ?'
  ).run(idConversation, idUser);
}

/**
 * Retire un membre d'une conversation
 */
function removeMember(idConversation, idUser) {
  return db.prepare(
    'DELETE FROM ConversationMembre WHERE idConversation = ? AND idUser = ?'
  ).run(idConversation, idUser);
}

/**
 * Avance le "marque-page" de lecture d'UN membre : tous les messages actuels de la
 * conversation sont considérés comme lus pour lui seul, pas pour les autres membres.
 */
function markAsReadForMember(idConversation, idUser) {
  return db.prepare(
    `UPDATE ConversationMembre
     SET idDernierMessageLu = COALESCE(
       (SELECT MAX(idMessage) FROM Message WHERE idConversation = ?), 0)
     WHERE idConversation = ? AND idUser = ?`
  ).run(idConversation, idConversation, idUser);
}

module.exports = {
  addMember,
  addMembers,
  setCreateur,
  removeMember,
  markAsReadForMember
};