const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const {
  validatePublicationContent,
  validateVideoFile
} = require('../utils/validationUtils');

const {
  createPublication,
  createVideoMedia,
  deletePublication
} = require('../models/postModel');


/*
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */

const UPLOAD_DIR = path.join(
  __dirname,
  '../../uploads'
);

const TEMPORARY_DIR = path.join(
  UPLOAD_DIR,
  'temporary'
);

const FFMPEG_TIMEOUT = 120000;


/*
 * ============================================================
 * UTILITAIRES
 * ============================================================
 */

function ensureUploadDirectories() {
  fs.mkdirSync(
    UPLOAD_DIR,
    {
      recursive: true,
      mode: 0o750
    }
  );

  fs.mkdirSync(
    TEMPORARY_DIR,
    {
      recursive: true,
      mode: 0o750
    }
  );
}


function generateRandomFilename() {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(32, (error, buffer) => {
      if (error) {
        return reject(error);
      }

      resolve(
        `${buffer.toString('hex')}.webm`
      );
    });
  });
}


async function safeUnlink(filePath) {
  if (!filePath) {
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(
        'Impossible de supprimer le fichier :',
        error.message
      );
    }
  }
}


/*
 * ============================================================
 * EXECUTION SÉCURISÉE D'UN PROGRAMME
 * ============================================================
 *
 * Aucun shell.
 * Aucun argument utilisateur concaténé dans une commande.
 */

function runProcess(
  command,
  args,
  timeout = FFMPEG_TIMEOUT
) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      command,
      args,
      {
        shell: false,
        windowsHide: true,
        stdio: [
          'ignore',
          'pipe',
          'pipe'
        ]
      }
    );

    let stdout = '';
    let stderr = '';

    let finished = false;

    const timer = setTimeout(() => {
      if (finished) {
        return;
      }

      finished = true;

      child.kill('SIGKILL');

      reject(
        new Error(
          'Le traitement de la vidéo a dépassé le délai autorisé'
        )
      );
    }, timeout);

    child.stdout.on(
      'data',
      (data) => {
        stdout += data.toString();
      }
    );

    child.stderr.on(
      'data',
      (data) => {
        stderr += data.toString();
      }
    );

    child.on(
      'error',
      (error) => {
        if (finished) {
          return;
        }

        finished = true;
        clearTimeout(timer);

        reject(error);
      }
    );

    child.on(
      'close',
      (code) => {
        if (finished) {
          return;
        }

        finished = true;
        clearTimeout(timer);

        if (code !== 0) {
          const error = new Error(
            'Le traitement de la vidéo a échoué'
          );

          error.stderr = stderr;
          error.stdout = stdout;
          error.exitCode = code;

          return reject(error);
        }

        resolve({
          stdout,
          stderr
        });
      }
    );
  });
}


/*
 * ============================================================
 * FFPROBE
 * ============================================================
 *
 * On ne fait pas confiance à l'extension ou au MIME.
 *
 * ffprobe vérifie réellement le conteneur et le flux vidéo.
 */

async function inspectVideo(filePath) {
  let result;

  try {
    result = await runProcess(
      'ffprobe',
      [
        '-v',
        'error',

        '-select_streams',
        'v:0',

        '-show_entries',
        'stream=codec_type,codec_name,width,height,duration',

        '-show_entries',
        'format=format_name,duration',

        '-of',
        'json',

        filePath
      ],
      30000
    );
  } catch (error) {
    throw new Error(
      'Le fichier envoyé n’est pas une vidéo valide'
    );
  }

  let data;

  try {
    data = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      'Impossible de vérifier la vidéo'
    );
  }

  if (
    !data.streams ||
    !Array.isArray(data.streams) ||
    data.streams.length === 0
  ) {
    throw new Error(
      'Aucun flux vidéo valide n’a été trouvé'
    );
  }

  const videoStream = data.streams[0];

  if (videoStream.codec_type !== 'video') {
    throw new Error(
      'Le fichier ne contient pas de flux vidéo'
    );
  }

  const durationValue =
    videoStream.duration ||
    data.format?.duration;

  const duration = Number(
    durationValue
  );

  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    throw new Error(
      'La durée de la vidéo est invalide'
    );
  }

  if (
    !Number.isFinite(videoStream.width) ||
    !Number.isFinite(videoStream.height) ||
    videoStream.width <= 0 ||
    videoStream.height <= 0
  ) {
    throw new Error(
      'Les dimensions de la vidéo sont invalides'
    );
  }

  const formatName =
    typeof data.format?.format_name === 'string'
      ? data.format.format_name.toLowerCase()
      : '';

  return {
    codecName:
      typeof videoStream.codec_name === 'string'
        ? videoStream.codec_name.toLowerCase()
        : '',

    formatName,

    duration: Math.ceil(duration),

    width: videoStream.width,

    height: videoStream.height
  };
}


/*
 * ============================================================
 * CONVERSION WEBM
 * ============================================================
 */

async function convertToWebM(
  sourcePath,
  destinationPath
) {
  await runProcess(
    'ffmpeg',
    [
      '-hide_banner',

      '-loglevel',
      'error',

      '-nostdin',

      '-y',

      '-i',
      sourcePath,

      /*
       * Vidéo VP9 dans un conteneur WebM.
       */
      '-c:v',
      'libvpx-vp9',

      /*
       * Audio Opus.
       */
      '-c:a',
      'libopus',

      /*
       * Évite de conserver des flux supplémentaires.
       */
      '-map',
      '0:v:0',

      '-map',
      '0:a:0?',

      /*
       * WebM.
       */
      '-f',
      'webm',

      destinationPath
    ]
  );
}


/*
 * ============================================================
 * TRAITEMENT DE LA VIDÉO
 * ============================================================
 */

async function processVideo(file) {
  validateVideoFile(file);

  const sourcePath = file.path;

  const videoInfo =
    await inspectVideo(sourcePath);

  /*
   * Un fichier n'est considéré comme WebM que si ffprobe
   * confirme un conteneur WebM.
   */
  const isWebM =
    videoInfo.formatName === 'webm' ||
    videoInfo.formatName.includes(',webm');

  const finalFilename =
    await generateRandomFilename();

  const finalPath = path.join(
    UPLOAD_DIR,
    finalFilename
  );

  /*
   * Sécurité supplémentaire :
   * le chemin final est toujours construit par notre serveur.
   */
  if (
    path.dirname(finalPath) !==
    path.resolve(UPLOAD_DIR)
  ) {
    throw new Error(
      'Chemin de destination invalide'
    );
  }

  if (isWebM) {
    /*
     * Le fichier a déjà été vérifié par ffprobe.
     *
     * On le déplace simplement vers son nom définitif.
     */
    await fs.promises.rename(
      sourcePath,
      finalPath
    );
  } else {
    /*
     * MP4 / MOV / AVI :
     * conversion vers WebM.
     */
    await convertToWebM(
      sourcePath,
      finalPath
    );

    /*
     * Le fichier temporaire original n'est plus nécessaire.
     */
    await safeUnlink(sourcePath);
  }

  /*
   * Vérification du fichier WebM produit.
   *
   * Cela évite d'enregistrer en base un fichier de sortie
   * corrompu ou incomplet.
   */
  const finalInfo =
    await inspectVideo(finalPath);

  if (
    finalInfo.formatName !== 'webm' &&
    !finalInfo.formatName.includes(',webm')
  ) {
    await safeUnlink(finalPath);

    throw new Error(
      'La conversion WebM a échoué'
    );
  }

  return {
    filename: finalFilename,
    path: finalPath,
    duration: finalInfo.duration
  };
}


/*
 * ============================================================
 * CRÉATION D'UNE PUBLICATION
 * ============================================================
 */

async function createPost({
  idUser,
  contenuPub,
  video
}) {
  if (
    !Number.isInteger(idUser) ||
    idUser <= 0
  ) {
    throw new Error(
      'Utilisateur authentifié invalide'
    );
  }

  const cleanContent =
    validatePublicationContent(
      contenuPub
    );

  /*
   * Il faut au minimum un contenu ou une vidéo.
   */
  if (!cleanContent && !video) {
    throw new Error(
      'La publication doit contenir du texte ou une vidéo'
    );
  }

  ensureUploadDirectories();

  let idPubli = null;
  let processedVideo = null;

  try {
    /*
     * --------------------------------------------------------
     * 1. Création de la publication
     * --------------------------------------------------------
     */

    idPubli = createPublication(
      idUser,
      cleanContent
    );


    /*
     * --------------------------------------------------------
     * 2. Traitement vidéo
     * --------------------------------------------------------
     */

    if (video) {
      processedVideo =
        await processVideo(video);

      /*
       * ------------------------------------------------------
       * 3. Création du média associé
       * ------------------------------------------------------
       */

      createVideoMedia(
        idPubli,
        processedVideo.filename,
        processedVideo.duration
      );
    }

    return {
      idPubli,
      idUser,
      contenuPub: cleanContent,
      media: processedVideo
        ? {
            nomMedia:
              processedVideo.filename,

            typeMedia: 'video',

            duree:
              processedVideo.duration
          }
        : null
    };
  } catch (error) {

    /*
     * Suppression du fichier temporaire/original
     * en cas d'échec.
     */
    if (video?.path) {
      await safeUnlink(video.path);
    }

    /*
     * Suppression du fichier final éventuel.
     */
    if (processedVideo?.path) {
      await safeUnlink(
        processedVideo.path
      );
    }

    /*
     * Suppression de la publication créée si le traitement
     * du média échoue.
     *
     * Grâce à la clé étrangère ON DELETE CASCADE,
     * un éventuel Media associé est également supprimé.
     */
    if (idPubli !== null) {
      try {
        deletePublication(idPubli);
      } catch (deleteError) {
        console.error(
          'Impossible de supprimer la publication après erreur :',
          deleteError.message
        );
      }
    }

    throw error;
  }
}


module.exports = {
  createPost
};
