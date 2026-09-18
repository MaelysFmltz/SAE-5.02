/*
 * ============================================================
 * VALIDATION PARTAGÉE DES MÉDIAS UPLOADÉS
 *
 * Regroupe les constantes et vérifications de signature binaire
 * utilisées par tous les points d'entrée qui acceptent un fichier
 * (publication classique, Duo, collage, photo de profil), pour
 * éviter que chacun réimplémente sa propre version.
 * ============================================================
 */

const IMAGE_MAX_SIZE = 20 * 1024 * 1024;
const VIDEO_MAX_SIZE = 100 * 1024 * 1024;

const IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp'
];

const VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime'
];

function isRealJPEG(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 3) {
        return false;
    }

    return (
        buffer[0] === 0xFF &&
        buffer[1] === 0xD8 &&
        buffer[2] === 0xFF
    );
}

function isRealPNG(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
        return false;
    }

    return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4E &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0D &&
        buffer[5] === 0x0A &&
        buffer[6] === 0x1A &&
        buffer[7] === 0x0A
    );
}

function isRealWebP(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
        return false;
    }

    return (
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
    );
}

function isRealMP4(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
        return false;
    }

    const maxOffset = Math.min(buffer.length - 4, 64);

    for (let i = 0; i <= maxOffset; i++) {
        if (buffer.toString('ascii', i, i + 4) === 'ftyp') {
            return true;
        }
    }

    return false;
}

function isRealWebM(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
        return false;
    }

    return (
        buffer[0] === 0x1A &&
        buffer[1] === 0x45 &&
        buffer[2] === 0xDF &&
        buffer[3] === 0xA3
    );
}

function isRealOGG(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
        return false;
    }

    return buffer.toString('ascii', 0, 4) === 'OggS';
}

/**
 * Détermine le type de média (image/vidéo) déclaré par le fichier
 * et vérifie sa taille ainsi que sa signature binaire réelle.
 *
 * Retourne { typeMedia } en cas de succès, ou lève une erreur avec
 * un message adapté sinon (utilisable directement dans une réponse
 * HTTP 400).
 */
function validateMediaFile(file, buffer) {
    let typeMedia = null;

    if (IMAGE_TYPES.includes(file.mimetype)) {
        typeMedia = 'image';
    } else if (VIDEO_TYPES.includes(file.mimetype)) {
        typeMedia = 'video';
    } else {
        throw new Error('Format de fichier non autorisé.');
    }

    const maxSize = typeMedia === 'image' ? IMAGE_MAX_SIZE : VIDEO_MAX_SIZE;

    if (file.size > maxSize) {
        throw new Error(
            typeMedia === 'image'
                ? 'L’image ne doit pas dépasser 20 Mo.'
                : 'La vidéo ne doit pas dépasser 100 Mo.'
        );
    }

    if (typeMedia === 'image') {
        let validImage = false;
        let formatLabel = '';

        if (file.mimetype === 'image/jpeg') {
            formatLabel = 'JPEG';
            validImage = isRealJPEG(buffer);
        } else if (file.mimetype === 'image/png') {
            formatLabel = 'PNG';
            validImage = isRealPNG(buffer);
        } else if (file.mimetype === 'image/webp') {
            formatLabel = 'WebP';
            validImage = isRealWebP(buffer);
        }

        if (!validImage) {
            throw new Error(
                `Le fichier envoyé n'est pas un véritable ${formatLabel}.`
            );
        }
    }

    if (typeMedia === 'video') {
        let validVideo = false;

        if (
            file.mimetype === 'video/mp4' ||
            file.mimetype === 'video/quicktime'
        ) {
            validVideo = isRealMP4(buffer);
        } else if (file.mimetype === 'video/webm') {
            validVideo = isRealWebM(buffer);
        } else if (file.mimetype === 'video/ogg') {
            validVideo = isRealOGG(buffer);
        }

        if (!validVideo) {
            throw new Error(
                "Le fichier envoyé n'est pas une véritable vidéo."
            );
        }
    }

    return { typeMedia };
}

module.exports = {
    IMAGE_MAX_SIZE,
    VIDEO_MAX_SIZE,
    IMAGE_TYPES,
    VIDEO_TYPES,
    isRealJPEG,
    isRealPNG,
    isRealWebP,
    isRealMP4,
    isRealWebM,
    isRealOGG,
    validateMediaFile
};
