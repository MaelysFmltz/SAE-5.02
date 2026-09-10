const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  MAX_VIDEO_SIZE,
  ALLOWED_VIDEO_EXTENSIONS,
  ALLOWED_VIDEO_MIME_TYPES
} = require('../utils/validationUtils');


/*
 * ============================================================
 * RÉPERTOIRES
 * ============================================================
 */

const UPLOAD_ROOT = path.join(
  __dirname,
  '../../uploads'
);

const TEMPORARY_DIR = path.join(
  UPLOAD_ROOT,
  'temporary'
);


/*
 * Création des répertoires si nécessaire.
 */
fs.mkdirSync(TEMPORARY_DIR, {
  recursive: true,
  mode: 0o750
});


/*
 * ============================================================
 * STOCKAGE MULTER
 * ============================================================
 *
 * Le fichier est temporairement enregistré avec un nom
 * aléatoire cryptographiquement sûr.
 *
 * Le nom original de l'utilisateur n'est jamais utilisé.
 */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMPORARY_DIR);
  },

  filename: (req, file, cb) => {
    crypto.randomBytes(32, (error, buffer) => {
      if (error) {
        return cb(error);
      }

      cb(
        null,
        `${buffer.toString('hex')}.upload`
      );
    });
  }
});


/*
 * ============================================================
 * FILTRE
 * ============================================================
 */

const fileFilter = (req, file, cb) => {
  try {
    const originalName =
      typeof file.originalname === 'string'
        ? file.originalname
        : '';

    const extension = path
      .extname(originalName)
      .toLowerCase();

    const mimetype =
      typeof file.mimetype === 'string'
        ? file.mimetype.toLowerCase()
        : '';

    if (!ALLOWED_VIDEO_EXTENSIONS.has(extension)) {
      return cb(
        new Error(
          'Format vidéo non autorisé. Formats acceptés : MP4, MOV, AVI et WebM'
        )
      );
    }

    if (!ALLOWED_VIDEO_MIME_TYPES.has(mimetype)) {
      return cb(
        new Error(
          'Type MIME vidéo non autorisé'
        )
      );
    }

    cb(null, true);
  } catch (error) {
    cb(error);
  }
};


/*
 * ============================================================
 * MULTER
 * ============================================================
 */

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: MAX_VIDEO_SIZE,

    files: 1,

    fields: 1,

    parts: 2,

    fieldNameSize: 100,

    fieldSize: 1024
  }
});


/*
 * ============================================================
 * MIDDLEWARE EXPORTÉ
 * ============================================================
 */

module.exports = (req, res, next) => {
  upload.single('video')(req, res, (error) => {
    if (error instanceof multer.MulterError) {

      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'La vidéo ne peut pas dépasser 50 Mo.'
        });
      }

      return res.status(400).json({
        error: `Erreur lors de l'envoi de la vidéo : ${error.message}`
      });
    }

    if (error) {
      return res.status(400).json({
        error: error.message ||
          'La vidéo n’a pas pu être envoyée.'
      });
    }

    /*
     * La vidéo est facultative :
     * une publication texte seule reste possible.
     */
    if (!req.file) {
      return next();
    }

    next();
  });
};

