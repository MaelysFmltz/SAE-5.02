const express = require('express');
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const adminOrModeratorMiddleware = require('../middlewares/adminOrModeratorMiddleware');
const db = require('../config/database');

const router = express.Router();

// 1. Accès au Panel Web (modérateurs, administrateurs et superadmin)
router.get(
    '/',
    authMiddleware,
    adminOrModeratorMiddleware,
    (req, res) => {
        res.render('admin', { user: req.user });
    }
);

// 2. Recherche d'utilisateurs par query ?q= (Administrateurs et superadmin)
router.get(
    '/search',
    authMiddleware,
    adminMiddleware,
    (req, res) => {
        const query = (req.query.q || '').trim();
        if (!query) {
            return res.status(200).json({ users: [] });
        }

        const superPseudo = process.env.SUPERADMIN_PSEUDO || '';
        const superEmail = process.env.SUPERADMIN_EMAIL || '';

        const users = db.prepare(`
            SELECT idUser, pseudo, email, statut, role 
            FROM Utilisateur 
            WHERE (pseudo LIKE ? OR email LIKE ?)
              AND pseudo != ? AND email != ?
            LIMIT 20
        `).all(`%${query}%`, `%${query}%`, superPseudo, superEmail);

        return res.status(200).json({ users });
    }
);

// Alias pour compatibilité avec le frontend
router.get(
    '/utilisateurs',
    authMiddleware,
    adminOrModeratorMiddleware,
    adminController.obtenirUtilisateurs
);

// 3. Modification du statut
router.patch(
    '/utilisateurs/:idUser/statut',
    authMiddleware,
    adminOrModeratorMiddleware,
    adminController.modifierStatutUtilisateur
);

// 4. Attribution des rôles
router.patch(
    '/utilisateurs/:idUser/role',
    authMiddleware,
    adminMiddleware,
    adminController.modifierRoleUtilisateur
);

// 5. Suppression définitive du compte en base SQLite
router.delete(
    '/utilisateurs/:idUser',
    authMiddleware,
    adminMiddleware,
    adminController.supprimerUtilisateurDefinitif
);

module.exports = router;