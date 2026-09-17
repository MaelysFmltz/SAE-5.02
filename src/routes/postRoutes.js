
const express = require('express');
const multer = require('multer');

const postController = require('../controllers/postController');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.get('/', authMiddleware, postController.getImages);

router.post(
    '/upload',
    authMiddleware,
    (req, res, next) => {
        upload.single('media')(req, res, (err) => {
            if (err) {
                // Fichier refusé par le fileFilter
                if (err.message === 'Type de fichier non autorisé') {
                    return res.status(400).json({
                        error: 'Type de fichier non autorisé.'
                    });
                }

                // Limite de taille Multer
                if (err instanceof multer.MulterError) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(400).json({
                            error: 'Le fichier est trop volumineux.'
                        });
                    }

                    return res.status(400).json({
                        error: err.message
                    });
                }

                return res.status(400).json({
                    error: err.message || 'Erreur lors de l’envoi du fichier.'
                });
            }

            next();
        });
    },
    postController.uploadImage
);

router.delete(
    '/api/:idPubli',
    authMiddleware,
    postController.deletePost
);

router.get('/api', authMiddleware, postController.getImagesApi);

router.get(
    '/api/user/:idUser',
    authMiddleware,
    postController.getUserImagesApi
);

module.exports = router;

