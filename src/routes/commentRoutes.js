const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');

// 1. Interface graphique EJS pour afficher la publication et ses commentaires
router.get('/view/:idPubli', commentController.renderPostPage);

// 2. Gestion des commentaires via formulaires HTML
router.post('/', commentController.addComment);
router.post('/:idComm/edit', commentController.editComment);
router.post('/:idComm/delete', commentController.removeComment);

// 3. Routes API REST pures (optionnelles, pour appels fetch / postman)
router.get('/:idPubli', commentController.getComments);
router.delete('/:idComm', commentController.removeComment);

// L'export doit obligatoirement être tout à la fin
module.exports = router;