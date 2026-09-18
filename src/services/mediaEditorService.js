const MAX_EDITED_IMAGE_SIZE = 20 * 1024 * 1024;

/**
 * Règles serveur appliquées aux images produites par l'éditeur navigateur.
 * L'éditeur exporte toujours en JPEG.
 */
function validateEditedImage({ buffer, mimetype, size }) {
    if (!Buffer.isBuffer(buffer)) {
        return { valid: false, error: 'Image éditée invalide.' };
    }
    if (mimetype !== 'image/jpeg') {
        return { valid: false, error: 'Une image éditée doit être au format JPEG.' };
    }
    if (size > MAX_EDITED_IMAGE_SIZE) {
        return { valid: false, error: 'L’image éditée ne doit pas dépasser 20 Mo.' };
    }
    if (buffer.length < 3 || buffer[0] !== 0xFF || buffer[1] !== 0xD8 || buffer[2] !== 0xFF) {
        return { valid: false, error: 'Le contenu réel de l’image éditée n’est pas un JPEG valide.' };
    }
    return { valid: true };
}

module.exports = { MAX_EDITED_IMAGE_SIZE, validateEditedImage };
