const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminOrModeratorMiddleware = require('../middlewares/adminOrModeratorMiddleware');

// 1. Consultation Web (EJS)
router.get('/view/:idPubli', commentController.renderPostPage);

// 2. Consultation API (JSON - accessible aux tests et utilisateurs)
router.get('/:idPubli', commentController.getComments);

// 3. Actions d'écriture sur les publications (authentification JWT obligatoire)
router.post('/', authMiddleware, commentController.addComment);
router.post('/react', authMiddleware, commentController.handleReaction);

// 4. Modération directe d'un commentaire (Admin & Modérateur)
router.delete('/:idComm/moderation', authMiddleware, adminOrModeratorMiddleware, commentController.supprimerCommentaireMod);

// 5. Routes legacy (édition/suppression) : authentification JWT obligatoire
router.post('/:idComm/edit', authMiddleware, commentController.editComment);
router.post('/:idComm/delete', authMiddleware, commentController.removeCommentApi);

// 6. Routes REST modernes
router.post('/:idComm/react', authMiddleware, commentController.handleCommentReaction);
router.put('/:idComm', authMiddleware, commentController.editComment);
router.delete('/:idComm', authMiddleware, commentController.removeCommentApi);

module.exports = router;