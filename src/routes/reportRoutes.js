const express = require('express');
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminOrModeratorMiddleware = require('../middlewares/adminOrModeratorMiddleware');
const db = require('../config/database');

const router = express.Router();

// 1. Créer un signalement (Tout utilisateur connecté)
router.post(
  '/',
  authMiddleware,
  reportController.creerSignalement
);

// 2. Mes signalements (Tout utilisateur connecté — déclaré AVANT /:idSignalement)
router.get(
  '/mes-signalements',
  authMiddleware,
  reportController.obtenirMesSignalements
);

// 3. Tous les signalements (Réservé au staff)
router.get(
  '/',
  authMiddleware,
  adminOrModeratorMiddleware,
  reportController.obtenirSignalements
);

// 4. Supprimer un signalement par son auteur ou le staff
router.delete(
  '/:idSignalement',
  authMiddleware,
  (req, res) => {
    const idSignalement = Number(req.params.idSignalement);
    const idUser = req.user.idUser;
    const isStaff = ['admin', 'moderator', 'superadmin'].includes(req.user.role) || idUser === -999;

    try {
      const ticket = db.prepare('SELECT idSignalement, idUserAuteur FROM Signalement WHERE idSignalement = ?').get(idSignalement);
      if (!ticket) {
        return res.status(404).json({ error: 'Signalement introuvable.' });
      }

      if (!isStaff && ticket.idUserAuteur !== idUser) {
        return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres signalements.' });
      }

      db.prepare('DELETE FROM Signalement WHERE idSignalement = ?').run(idSignalement);
      return res.status(200).json({ message: 'Signalement supprimé avec succès.' });
    } catch (e) {
      console.error('Erreur suppression signalement :', e);
      return res.status(500).json({ error: 'Impossible de supprimer le signalement.' });
    }
  }
);

// 5. Détail d'un signalement
router.get(
  '/:idSignalement',
  authMiddleware,
  reportController.obtenirSignalement
);

// 6. Modifier le statut d'un ticket (Staff)
router.patch(
  '/:idSignalement/statut',
  authMiddleware,
  adminOrModeratorMiddleware,
  reportController.modifierStatutSignalement
);

module.exports = router;