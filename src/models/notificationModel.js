/**
 * Modèle Notification
 * Accès direct à la base pour la table Notification : création, vérification
 * de doublon, liste groupée par événement, compteur de non lues, marquage en lu.
 * idUser = destinataire, idActeur = personne qui a déclenché la notification.
 */
const db = require('../config/database');

// Les notifications liées à une publication supprimée sont ignorées (lien mort sinon)
const PUBLICATION_EXISTE = `
  (n.type NOT IN ('like', 'like_commentaire', 'commentaire', 'reponse_commentaire')
   OR EXISTS (SELECT 1 FROM Publication p WHERE p.idPubli = n.idSource))
`;

/**
 * Enregistre une notification et retourne son id
 */
function createNotification(idUser, idActeur, type, idSource = null) {
  const info = db.prepare(
    'INSERT INTO Notification (idUser, idActeur, type, idSource) VALUES (?, ?, ?, ?)'
  ).run(idUser, idActeur, type, idSource);
  return info.lastInsertRowid;
}

/**
 * Vérifie si la même notification existe déjà
 * ("IS ?" au lieu de "= ?" pour que NULL soit bien comparé à NULL)
 */
function exists(idUser, idActeur, type, idSource = null) {
  const row = db.prepare(
    `SELECT 1 FROM Notification
     WHERE idUser = ? AND idActeur = ? AND type = ? AND idSource IS ?`
  ).get(idUser, idActeur, type, idSource);
  return !!row;
}

/**
 * Liste les notifications d'un utilisateur, GROUPÉES par (type, idSource).
 * Pour chaque groupe : nombre de notifications, nombre de personnes différentes,
 * nombre de non lues, date de la plus récente et pseudo du dernier acteur.
 */
function getGroupedByUser(idUser) {
  const query = `
    SELECT
      n.type,
      n.idSource,
      COUNT(*) AS nombre,
      COUNT(DISTINCT n.idActeur) AS nbActeurs,
      SUM(CASE WHEN n.lu = 0 THEN 1 ELSE 0 END) AS nonLues,
      MAX(n.dateNotif) AS dateDerniere,
      (
        SELECT u.pseudo
        FROM Notification n2
        JOIN Utilisateur u ON u.idUser = n2.idActeur
        WHERE n2.idUser = n.idUser
          AND n2.type = n.type
          AND n2.idSource IS n.idSource
        ORDER BY n2.dateNotif DESC, n2.idNotif DESC
        LIMIT 1
      ) AS dernierActeur
    FROM Notification n
    WHERE n.idUser = ?
      AND ${PUBLICATION_EXISTE}
    GROUP BY n.type, n.idSource
    ORDER BY dateDerniere DESC
    LIMIT 50
  `;
  return db.prepare(query).all(idUser);
}

/**
 * Nombre de groupes contenant au moins une notification non lue (pour la pastille)
 */
function countUnreadGroups(idUser) {
  const row = db.prepare(
    `SELECT COUNT(*) AS total FROM (
       SELECT 1 FROM Notification n
       WHERE n.idUser = ? AND n.lu = 0
         AND ${PUBLICATION_EXISTE}
       GROUP BY n.type, n.idSource
     )`
  ).get(idUser);
  return row.total;
}

/**
 * Marque toutes les notifications d'un utilisateur comme lues
 */
function markAllAsRead(idUser) {
  return db.prepare(
    'UPDATE Notification SET lu = 1 WHERE idUser = ? AND lu = 0'
  ).run(idUser);
}

/**
 * Marque comme lues les notifications d'un seul groupe
 */
function markGroupAsRead(idUser, type, idSource = null) {
  return db.prepare(
    `UPDATE Notification SET lu = 1
     WHERE idUser = ? AND type = ? AND idSource IS ? AND lu = 0`
  ).run(idUser, type, idSource);
}

/**
 * Vrai si l'un des deux utilisateurs a bloqué l'autre
 */
function sontBloques(idUser1, idUser2) {
  const row = db.prepare(
    `SELECT 1 FROM Blocage
     WHERE (idUserBloqueur = ? AND idUserBloque = ?)
        OR (idUserBloqueur = ? AND idUserBloque = ?)`
  ).get(idUser1, idUser2, idUser2, idUser1);
  return !!row;
}

/**
 * Retourne l'id de l'auteur d'une publication (null si elle n'existe pas)
 */
function getPublicationAuthor(idPubli) {
  const row = db.prepare('SELECT idUser FROM Publication WHERE idPubli = ?').get(idPubli);
  return row ? row.idUser : null;
}

/**
 * Retourne l'id de l'auteur d'un commentaire (null s'il n'existe pas)
 */
function getCommentAuthor(idComm) {
  const row = db.prepare('SELECT idUser FROM Commentaire WHERE idComm = ?').get(idComm);
  return row ? row.idUser : null;
}

/**
 * Vrai si cet utilisateur a actuellement un LIKE (et pas un dislike) sur la publication
 */
function isLikedBy(idPubli, idUser) {
  const row = db.prepare(
    'SELECT estLike FROM LikeDislike WHERE idUser = ? AND idPubli = ?'
  ).get(idUser, idPubli);
  return !!row && row.estLike === 1;
}

/**
 * Vrai si cet utilisateur a actuellement un LIKE (et pas un dislike) sur ce commentaire
 */
function isCommentLikedBy(idComm, idUser) {
  const row = db.prepare(
    'SELECT estLike FROM LikeCommentaire WHERE idUser = ? AND idComm = ?'
  ).get(idUser, idComm);
  return !!row && row.estLike === 1;
}

/**
 * Retourne l'auteur et la publication d'un commentaire (undefined s'il n'existe pas)
 */
function getCommentInfo(idComm) {
  return db.prepare(
    'SELECT idUser, idPubli FROM Commentaire WHERE idComm = ?'
  ).get(idComm);
}

/**
 * Nombre de conversations contenant au moins un message non lu PAR CET UTILISATEUR :
 * message d'un autre, plus récent que son marque-page, et envoyé depuis son arrivée
 * dans la conversation. Sert à la pastille du bouton Messagerie.
 */
function countUnreadMessageConversations(idUser) {
  const row = db.prepare(
    `SELECT COUNT(DISTINCT m.idConversation) AS total
     FROM ConversationMembre cm
     JOIN Message m ON m.idConversation = cm.idConversation
     WHERE cm.idUser = ?
       AND m.idUser != ?
       AND m.idMessage > cm.idDernierMessageLu
       AND m.dateEnvoi >= cm.dateRejoint`
  ).get(idUser, idUser);
  return row.total;
}

module.exports = {
  createNotification,
  exists,
  sontBloques,
  getGroupedByUser,
  countUnreadGroups,
  countUnreadMessageConversations,
  markAllAsRead,
  markGroupAsRead,
  getPublicationAuthor,
  getCommentAuthor,
  getCommentInfo,
  isLikedBy,
  isCommentLikedBy
};