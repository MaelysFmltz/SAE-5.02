const fs = require('fs/promises');


/**
 * Vérifie la signature d'un fichier JPEG.
 *
 * Un fichier JPEG commence par :
 * FF D8 FF
 */
async function isRealJPEG(filePath) {

    const file = await fs.open(filePath, 'r');

    try {

        const buffer = Buffer.alloc(3);

        await file.read(
            buffer,
            0,
            3,
            0
        );

        return (
            buffer[0] === 0xFF &&
            buffer[1] === 0xD8 &&
            buffer[2] === 0xFF
        );

    } finally {
        await file.close();
    }
}


module.exports = {
    isRealJPEG
};