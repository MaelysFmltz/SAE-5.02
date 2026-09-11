const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');


const uploadDirectory = path.join(
    __dirname,
    '../../uploads'
);


// Création automatique du dossier uploads
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, {
        recursive: true
    });
}


const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, uploadDirectory);
    },

    filename: function (req, file, cb) {

        const filename =
            `${crypto.randomUUID()}.jpg`;

        cb(null, filename);
    }

});


const upload = multer({

    storage,

    limits: {
        fileSize: 20 * 1024 * 1024,
        files: 1
    },

    fileFilter: function (req, file, cb) {

        if (file.mimetype !== 'image/jpeg') {

            return cb(
                new Error(
                    'Seules les images JPEG sont autorisées.'
                )
            );
        }

        cb(null, true);
    }

});


module.exports = upload;