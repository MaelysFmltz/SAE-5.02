const MAX_EDITED_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_EDITED_VIDEO_SIZE = 100 * 1024 * 1024;

/**
 * Règles serveur appliquées aux images produites par l'éditeur navigateur.
 */
function validateEditedImage({ buffer, mimetype, size }) {
    if (!Buffer.isBuffer(buffer)) return { valid: false, error: 'Image éditée invalide.' };
    if (mimetype !== 'image/jpeg') return { valid: false, error: 'Une image éditée doit être au format JPEG.' };
    if (size > MAX_EDITED_IMAGE_SIZE) return { valid: false, error: 'L’image éditée ne doit pas dépasser 20 Mo.' };
    if (buffer.length < 3 || buffer[0] !== 0xFF || buffer[1] !== 0xD8 || buffer[2] !== 0xFF) {
        return { valid: false, error: 'Le contenu réel de l’image éditée n’est pas un JPEG valide.' };
    }
    return { valid: true };
}

/**
 * Règles serveur appliquées aux vidéos exportées par l'éditeur navigateur.
 * L'éditeur navigateur exporte en WebM.
 */
function validateEditedVideo({ buffer, mimetype, size }) {
    if (!Buffer.isBuffer(buffer)) return { valid: false, error: 'Vidéo éditée invalide.' };
    if (mimetype !== 'video/webm') return { valid: false, error: 'Une vidéo éditée doit être au format WebM.' };
    if (size > MAX_EDITED_VIDEO_SIZE) return { valid: false, error: 'La vidéo éditée ne doit pas dépasser 100 Mo.' };
    // WebM/Matroska utilise EBML et commence normalement par 1A 45 DF A3.
    if (buffer.length < 4 || buffer[0] !== 0x1A || buffer[1] !== 0x45 || buffer[2] !== 0xDF || buffer[3] !== 0xA3) {
        return { valid: false, error: 'Le contenu réel de la vidéo éditée n’est pas un WebM valide.' };
    }
    return { valid: true };
}

module.exports = {
    MAX_EDITED_IMAGE_SIZE,
    MAX_EDITED_VIDEO_SIZE,
    validateEditedImage,
    validateEditedVideo
};
