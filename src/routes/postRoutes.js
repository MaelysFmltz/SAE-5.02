const express = require('express');

const authMiddleware =
  require('../middlewares/authMiddleware');

const uploadMiddleware =
  require('../middlewares/uploadMiddleware');

const {
  showPostPage,
  createPostController
} = require('../controllers/postController');


const router = express.Router();


/*
 * ============================================================
 * PAGE FRONTEND
 * ============================================================
 *
 * Cette requête GET sert uniquement à afficher le formulaire.
 *
 * L'envoi de la publication et de la vidéo se fait exclusivement
 * avec POST /post.
 */

router.get(
  '/',
  showPostPage
);


/*
 * ============================================================
 * CRÉATION D'UNE PUBLICATION
 * ============================================================
 *
 * POST /post
 *
 * Authorization:
 * Bearer <JWT>
 *
 * multipart/form-data :
 *
 * contenuPub = texte facultatif
 * video      = vidéo facultative
 *
 * Il n'existe volontairement aucun champ idPubli.
 */

router.post(
  '/',
  authMiddleware,
  uploadMiddleware,
  createPostController
);


module.exports = router;

