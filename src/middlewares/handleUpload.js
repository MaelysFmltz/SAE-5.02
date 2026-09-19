const multer = require('multer');
const upload = require('./uploadMiddleware');

/*
 * Middleware générique pour traduire les erreurs de multer
 * (fileFilter, taille) en réponse JSON 400 exploitable par
 * le front, quelle que soit la route d'upload.
 */
function handleUpload(fieldName) {
    return (req, res, next) => {
        upload.single(fieldName)(req, res, (err) => {
            if (err) {
                if (err.message === 'Type de fichier non autorisé') {
                    return res.status(400).json({
                        error: 'Type de fichier non autorisé.'
                    });
                }

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
                    error:
                        err.message ||
                        'Erreur lors de l’envoi du fichier.'
                });
            }

            next();
        });
    };
}

module.exports = handleUpload;
