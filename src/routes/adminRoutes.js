const express = require('express');
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const adminOrModeratorMiddleware = require('../middlewares/adminOrModeratorMiddleware');

const router = express.Router();

// 1. Accès au Panel Web (ouvert aux modérateurs, administrateurs et superadmin)
router.get(
    '/',
    authMiddleware,
    adminOrModeratorMiddleware,
    (req, res) => {
        res.render('admin', { user: req.user });
    }
);

// 2. Liste des utilisateurs (accessible aux modérateurs et administrateurs)
router.get(
    '/utilisateurs',
    authMiddleware,
    adminOrModeratorMiddleware,
    adminController.obtenirUtilisateurs
);

// 3. Modification du statut (suspendre, bannir, réactiver, supprimer)
router.patch(
    '/utilisateurs/:idUser/statut',
    authMiddleware,
    adminOrModeratorMiddleware,
    adminController.modifierStatutUtilisateur
);

// 4. Attribution des rôles (réservée aux administrateurs et superadmin)
router.patch(
    '/utilisateurs/:idUser/role',
    authMiddleware,
    adminMiddleware,
    adminController.modifierRoleUtilisateur
);

module.exports = router;