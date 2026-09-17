const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const authMiddleware = require('../middlewares/authMiddleware');

// 1. Consultation Web (EJS)
router.get('/view/:idPubli', commentController.renderPostPage);

// 2. Consultation API (JSON)
router.get('/:idPubli', authMiddleware, commentController.getComments);

// 3. Actions d'écriture sur les publications (routes fixes en premier)
router.post('/', authMiddleware, commentController.addComment);
router.post('/react', authMiddleware, commentController.handleReaction);

// 4. Actions ciblées sur un commentaire spécifique (routes dynamiques :idComm)
router.post('/:idComm/react', authMiddleware, commentController.handleCommentReaction);
router.put('/:idComm', authMiddleware, commentController.editComment);
router.delete('/:idComm', authMiddleware, commentController.removeCommentApi);

module.exports = router;