const express = require('express');

const friendshipController = require('../controllers/friendshipController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post(
    '/:idUserCible',
    authMiddleware,
    friendshipController.suivre
);

router.delete(
    '/:idUserCible',
    authMiddleware,
    friendshipController.neplusSuivre
);

router.get(
    '/:idUser/amis',
    authMiddleware,
    friendshipController.listerAmis
);

router.get(
    '/:idUser/abonnements',
    authMiddleware,
    friendshipController.listerAbonnements
);

router.get(
    '/:idUser/abonnes',
    authMiddleware,
    friendshipController.listerAbonnes
);

module.exports = router;
