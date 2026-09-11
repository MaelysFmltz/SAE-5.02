const express = require('express');
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

const router = express.Router();

router.get(
    '/',
    (req, res) => {
        res.render('admin');
    }
);

router.get(
    '/utilisateurs',
    authMiddleware,
    adminMiddleware,
    adminController.obtenirUtilisateurs
);

router.patch(
    '/utilisateurs/:idUser/statut',
    authMiddleware,
    adminMiddleware,
    adminController.modifierStatutUtilisateur
);

module.exports = router;