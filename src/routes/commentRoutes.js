const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');

// Interface graphique EJS
router.get('/view/:idPubli', commentController.renderPostPage);

// Actions formulaires
router.post('/', commentController.addComment);
router.post('/:idComm/edit', commentController.editComment);
router.post('/:idComm/delete', commentController.removeComment);

// API REST
router.get('/:idPubli', commentController.getComments);
router.delete('/:idComm', commentController.removeComment);

module.exports = router;