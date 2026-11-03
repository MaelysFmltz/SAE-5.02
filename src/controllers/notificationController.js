/**
 * Controller Notification
 * Reçoit les requêtes HTTP liées aux notifications (liste, compteur, marquage
 * en lu) et délègue à notificationService.
 * Les erreurs internes sont journalisées côté serveur et renvoyées au client
 * avec un message générique (pas de détail SQL).
 */
const notificationService = require('../services/notificationService');

async function getMine(req, res) {
  try {
    const notifications = await notificationService.getMyNotifications(req.user.idUser);
    return res.status(200).json(notifications);
  } catch (err) {
    console.error('Erreur GET /api/notifications :', err);
    return res.status(500).json({ error: 'Erreur lors du chargement des notifications' });
  }
}

async function getUnreadCount(req, res) {
  try {
    const count = await notificationService.countUnread(req.user.idUser);
    const messages = await notificationService.countUnreadMessages(req.user.idUser);
    return res.status(200).json({ count, messages });
  } catch (err) {
    console.error('Erreur GET /api/notifications/unread-count :', err);
    return res.status(500).json({ error: 'Erreur lors du chargement des notifications' });
  }
}

async function markAsRead(req, res) {
  try {
    const { type, idSource } = req.body || {};
    await notificationService.markAsRead(req.user.idUser, type, idSource);
    return res.status(200).json({ message: 'Notifications marquées comme lues' });
  } catch (err) {
    if (err.estValidation) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Erreur PUT /api/notifications/read :', err);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour des notifications' });
  }
}

module.exports = {
  getMine,
  getUnreadCount,
  markAsRead
};
