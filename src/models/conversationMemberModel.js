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

module.exports = {
  addMember,
  addMembers
};