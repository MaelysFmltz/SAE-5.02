/**
 * Controller Notification
 * Reçoit les requêtes HTTP liées aux notifications (liste, compteur, marquage
 * en lu) et délègue à notificationService.
 */
const notificationService = require('../services/notificationService');

async function getMine(req, res) {
  try {
    const notifications = await notificationService.getMyNotifications(req.user.idUser);
    return res.status(200).json(notifications);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getUnreadCount(req, res) {
  try {
    const count = await notificationService.countUnread(req.user.idUser);
    return res.status(200).json({ count });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function markAsRead(req, res) {
  try {
    const { type, idSource } = req.body || {};
    await notificationService.markAsRead(req.user.idUser, type, idSource);
    return res.status(200).json({ message: 'Notifications marquées comme lues' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getMine,
  getUnreadCount,
  markAsRead
};