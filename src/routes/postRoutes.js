const express = require('express');

const postController = require('../controllers/postController');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.get(
    '/',
    authMiddleware,
    postController.getImages
);

router.post(
    '/upload',
    authMiddleware,
    upload.single('media'),
    postController.uploadImage
);

router.get(
    '/api',
    authMiddleware,
    postController.getImagesApi
);

router.get(
    '/api/user/:idUser',
    authMiddleware,
    postController.getUserImagesApi
);

module.exports = router;