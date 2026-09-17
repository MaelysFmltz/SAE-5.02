/**
 * Modèle Conversation
 * Accès direct à la base pour la table Conversation :
 * création, recherche d'une conversation à 2 déjà existante,
 * liste des conversations d'un utilisateur, gestion des membres.
 */

const db = require('../config/database');

/**
 * Crée une conversation vide (sans membres) et retourne son id
 */
function createConversation(titreGroupe = null) {
  const info = db.prepare(
    'INSERT INTO Conversation (titreGroupe) VALUES (?)'
  ).run(titreGroupe);
  return info.lastInsertRowid;
}

/**
 * Cherche une conversation à 2 (sans titre de groupe) qui contient EXACTEMENT
 * ces deux utilisateurs, ni plus ni moins. Sert à éviter de dupliquer une
 * conversation privée déjà existante entre deux personnes.
 */
function findDirectConversationBetween(idUserA, idUserB) {
  const query = `
    SELECT c.idConversation
    FROM Conversation c
    JOIN ConversationMembre cm ON cm.idConversation = c.idConversation
    WHERE c.titreGroupe IS NULL
    GROUP BY c.idConversation
    HAVING COUNT(DISTINCT cm.idUser) = 2
       AND SUM(CASE WHEN cm.idUser IN (?, ?) THEN 1 ELSE 0 END) = 2
  `;
  return db.prepare(query).get(idUserA, idUserB);
}

/**
 * Liste les conversations d'un utilisateur, avec un aperçu du dernier message.
 * Pour une conversation à 2 (sans titre de groupe), inclut le pseudo de
 * l'autre membre (autrePseudo) pour l'affichage. Inclut aussi un flag
 * nonLu (message(s) reçus pas encore marqués comme lus).
 */
function getConversationsForUser(idUser) {
  const query = `
    SELECT
      c.idConversation,
      c.titreGroupe,
      c.dateCreation,
      m.contenu   AS dernierMessage,
      m.dateEnvoi AS dateDernierMessage,
      (
        SELECT u2.pseudo
        FROM ConversationMembre cm2
        JOIN Utilisateur u2 ON u2.idUser = cm2.idUser
        WHERE cm2.idConversation = c.idConversation
          AND cm2.idUser != ?
        LIMIT 1
      ) AS autrePseudo,
      EXISTS (
        SELECT 1 FROM Message m2
        WHERE m2.idConversation = c.idConversation
          AND m2.idUser != ?
          AND m2.lu = 0
      ) AS nonLu
    FROM Conversation c
    JOIN ConversationMembre cm ON cm.idConversation = c.idConversation
    LEFT JOIN Message m ON m.idMessage = (
      SELECT idMessage FROM Message
      WHERE idConversation = c.idConversation
      ORDER BY dateEnvoi DESC
      LIMIT 1
    )
    WHERE cm.idUser = ?
    ORDER BY dateDernierMessage DESC, c.dateCreation DESC
  `;
  return db.prepare(query).all(idUser, idUser, idUser);
}

/**
 * Récupère une conversation par son id (sans les membres)
 */
function getConversationById(idConversation) {
  return db.prepare(
    'SELECT idConversation, titreGroupe, dateCreation FROM Conversation WHERE idConversation = ?'
  ).get(idConversation);
}

/**
 * Récupère les membres (pseudo inclus) d'une conversation
 */
function getMembers(idConversation) {
  const query = `
    SELECT u.idUser, u.pseudo
    FROM ConversationMembre cm
    JOIN Utilisateur u ON u.idUser = cm.idUser
    WHERE cm.idConversation = ?
  `;
  return db.prepare(query).all(idConversation);
}

/**
 * Vérifie qu'un utilisateur fait bien partie d'une conversation
 */
function isMember(idConversation, idUser) {
  const row = db.prepare(
    'SELECT 1 FROM ConversationMembre WHERE idConversation = ? AND idUser = ?'
  ).get(idConversation, idUser);
  return !!row;
}

module.exports = {
  createConversation,
  findDirectConversationBetween,
  getConversationsForUser,
  getConversationById,
  getMembers,
  isMember
};