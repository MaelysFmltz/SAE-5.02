/**
 * Modèle Notification
 * Accès direct à la base pour la table Notification : création, vérification
 * de doublon, liste groupée par événement, compteur de non lues, marquage en lu.
 * idUser = destinataire, idActeur = personne qui a déclenché la notification.
 */
const db = require('../config/database');

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
       SELECT 1 FROM Notification
       WHERE idUser = ? AND lu = 0
       GROUP BY type, idSource
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

module.exports = {
  createNotification,
  exists,
  getGroupedByUser,
  countUnreadGroups,
  markAllAsRead,
  markGroupAsRead
};