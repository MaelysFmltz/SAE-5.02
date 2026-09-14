const multer = require('multer');
const path = require('path');
const fs = require('fs');


const uploadDir =
    path.join(
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
 * Stockage des fichiers.
 */
const storage =
    multer.diskStorage({

        destination: function (
            req,
            file,
            cb
        ) {

            cb(
                null,
                uploadDir
            );

        },


        filename: function (
            req,
            file,
            cb
        ) {

            const extension =
                path.extname(
                    file.originalname
                ).toLowerCase();


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
    'image/jpg',
    'image/png',
    'image/webp',

    // Vidéos
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime'

];


const fileFilter =
    function (
        req,
        file,
        cb
    ) {

        if (
            allowedMimeTypes.includes(
                file.mimetype
            )
        ) {

            cb(
                null,
                true
            );

        } else {

            cb(
                new Error(
                    'Format de fichier non autorisé. Utilisez une image ou une vidéo.'
                ),
                false
            );

        }

    };


/*
 * Limites :
 *
 * Image : 20 Mo
 * Vidéo : 100 Mo
 *
 * Comme multer n'a qu'une limite globale,
 * on utilise 100 Mo ici puis on vérifie
 * la taille exacte dans le controller.
 */
const upload =
    multer({

        storage,

        fileFilter,

        limits: {

            fileSize:
                100 * 1024 * 1024

        }

    });


module.exports = upload;