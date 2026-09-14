// src/middlewares/uploadMiddleware.js

const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  MAX_VIDEO_SIZE,
  validateVideoFile
} = require('../utils/validationUtils');

const UPLOAD_ROOT = path.join(
  __dirname,
  '../../uploads'
);

const TEMPORARY_DIR = path.join(
  UPLOAD_ROOT,
  'temporary'
);

fs.mkdirSync(TEMPORARY_DIR, {
  recursive: true,
  mode: 0o750
});

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

const upload = multer({
  storage,

  limits: {
    fileSize: MAX_VIDEO_SIZE,
    files: 1,
    fields: 1,
    fieldNameSize: 100,
    fieldSize: 1024
  }
});

function removeTemporaryFile(file) {
  if (!file || !file.path) {
    return;
  }

  try {
    fs.unlinkSync(file.path);
  } catch (_) {
    // Le fichier peut déjà avoir été supprimé.
  }
}

module.exports = (req, res, next) => {
  upload.single('video')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      removeTemporaryFile(req.file);

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
      removeTemporaryFile(req.file);

      return res.status(400).json({
        error:
          error.message ||
          'La vidéo n’a pas pu être envoyée.'
      });
    }

    if (!req.file) {
      return next();
    }

    try {
      validateVideoFile(req.file);
    } catch (validationError) {
      removeTemporaryFile(req.file);

      return res.status(400).json({
        error:
          validationError.message ||
          'Le fichier envoyé n’est pas une vidéo valide.'
      });
    }

    next();
  });
};
