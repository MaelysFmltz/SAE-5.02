const express = require('express');
const postController = require('../controllers/postController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

const router = express.Router();

router.delete(
    '/:idPubli',
    authMiddleware,
    adminMiddleware,
    postController.supprimerPublication
);

module.exports = router;