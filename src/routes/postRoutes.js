const express = require('express');

const postController =
    require('../controllers/postController');

const authMiddleware =
    require('../middlewares/authMiddleware');

const upload =
    require('../middlewares/uploadMiddleware');


const router = express.Router();


/*
 * POST /post/upload
 *
 * Authentification obligatoire.
 */
router.post(
    '/upload',
    authMiddleware,
    upload.single('image'),
    postController.uploadImage
);


/*
 * GET /post
 *
 * Affiche la page EJS.
 */
router.get(
    '/',
    postController.getImages
);


/*
 * GET /post/api
 *
 * Retourne les publications en JSON.
 */
router.get(
    '/api',
    postController.getImagesApi
);


module.exports = router;