const fs = require('fs/promises');
const path = require('path');

/*
 * ============================================================
 * SUPPRESSION SÉCURISÉE D'UN FICHIER UPLOADÉ
 * ============================================================
 */

/**
 * Supprime un fichier utilisateur (publication, Duo, collage,
 * avatar...) uniquement s'il se trouve directement dans le
 * dossier uploads, jamais via un chemin fourni par le client.
 */
async function deleteUploadedFile(filename) {
    if (typeof filename !== 'string' || !filename) {
        throw new Error('Nom de fichier invalide');
    }

    const uploadDir = path.resolve(__dirname, '../../uploads');

    /*
     * On interdit tout chemin.
     * Seul un nom de fichier simple est accepté.
     */
    if (filename !== path.basename(filename)) {
        throw new Error('Nom de fichier invalide');
    }

    const filePath = path.resolve(uploadDir, filename);

    /*
     * Le fichier doit être directement dans uploads.
     */
    if (path.dirname(filePath) !== uploadDir) {
        throw new Error('Chemin de fichier invalide');
    }

    try {
        await fs.unlink(filePath);
    } catch (error) {
        /*
         * Un fichier déjà absent n'est pas bloquant.
         */
        if (error.code === 'ENOENT') {
            return;
        }

        throw error;
    }
}

module.exports = { deleteUploadedFile };
