const express = require('express');

const postController =
    require('../controllers/postController');

const authMiddleware =
    require('../middlewares/authMiddleware');

const upload =
    require('../middlewares/uploadMiddleware');


const router = express.Router();


/*
 * Toutes les routes de publication
 * nécessitent une authentification.
 */
router.use(authMiddleware);


/*
 * GET /post
 *
 * Affiche UNIQUEMENT le formulaire
 * de création d'une publication.
 */
router.get(
    '/',
    postController.getImages
);


/*
 * POST /post/upload
 *
 * Crée la publication.
 */
router.post(
    '/upload',
    upload.single('image'),
    postController.uploadImage
);


/*
 * GET /post/api
 *
 * Toutes les publications.
 */
router.get(
    '/api',
    postController.getImagesApi
);


/*
 * GET /post/api/user/:idUser
 *
 * Publications d'un utilisateur.
 */
router.get(
    '/api/user/:idUser',
    postController.getUserImagesApi
);


module.exports = router;