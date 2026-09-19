
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(
    __dirname,
    '../../uploads'
);


/*
 * Création du dossier uploads
 * s'il n'existe pas.
 */
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(
        uploadDir,
        {
            recursive: true
        }
    );
}


/*
 * Extensions imposées par le serveur.
 *
 * IMPORTANT :
 * On ne doit JAMAIS utiliser
 * path.extname(file.originalname)
 * car le nom original est contrôlé
 * par le client.
 */
const extensionsParMime = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',

    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/ogg': '.ogg',
    'video/quicktime': '.mov'
};


/*
 * Stockage des fichiers.
 */
const storage = multer.diskStorage({

    destination: function (req, file, cb) {

        cb(
            null,
            uploadDir
        );

    },

    filename: function (req, file, cb) {

        /*
         * L'extension vient UNIQUEMENT
         * de la liste contrôlée par le serveur.
         */
        const extension =
            extensionsParMime[file.mimetype];

        /*
         * Sécurité supplémentaire :
         * normalement impossible car le fileFilter
         * vérifie déjà le MIME.
         */
        if (!extension) {
            return cb(
                new Error(
                    'Format de fichier non autorisé.'
                )
            );
        }

        /*
         * Nom généré par le serveur.
         * Le nom original du fichier n'est jamais utilisé.
         */
        const uniqueName =
            `${Date.now()}-${Math.round(
                Math.random() * 1E9
            )}${extension}`;

        cb(
            null,
            uniqueName
        );

    }

});


/*
 * Types autorisés.
 */
const allowedMimeTypes = [

    // Images
    'image/jpeg',
    'image/png',
    'image/webp',

    // Vidéos
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime'

];


/*
 * Vérification du MIME déclaré.
 *
 * IMPORTANT :
 * Le MIME n'est PAS considéré comme une preuve
 * que le fichier est réellement une vidéo ou une image.
 *
 * Le contenu sera vérifié dans le controller.
 */
const fileFilter = function (
    req,
    file,
    cb
) {

    if (
        allowedMimeTypes.includes(
            file.mimetype
        )
    ) {

        return cb(
            null,
            true
        );

    }

    return cb(
        new Error(
            'Format de fichier non autorisé. Utilisez une image ou une vidéo.'
        ),
        false
    );

};


/*
 * Limites :
 *
 * Image : 20 Mo
 * Vidéo : 100 Mo
 *
 * Multer utilise ici 100 Mo comme limite maximale.
 * Le controller vérifie ensuite la limite spécifique
 * aux images.
 */
const upload = multer({

    storage,

    fileFilter,

    limits: {

        fileSize:
            100 * 1024 * 1024

    }

});


module.exports = upload;

