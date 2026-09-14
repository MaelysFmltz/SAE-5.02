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

// Temps maximal pour FFmpeg : 10 minutes
const FFMPEG_TIMEOUT = 10 * 60 * 1000;

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
 * EXÉCUTION D'UN PROGRAMME
 * ============================================================
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
    data = JSON.parse(
      result.stdout
    );
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

  const videoStream =
    data.streams[0];

  if (
    videoStream.codec_type !== 'video'
  ) {
    throw new Error(
      'Le fichier ne contient pas de flux vidéo'
    );
  }

  const durationValue =
    videoStream.duration ||
    data.format?.duration;

  const duration =
    Number(durationValue);

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

    duration: Math.ceil(
      duration
    ),

    width:
      videoStream.width,

    height:
      videoStream.height
  };
}


/*
 * ============================================================
 * CONVERSION WEBM
 * ============================================================
 */

/**
 * Convertit une vidéo en WebM.
 *
 * Les options deadline=realtime et cpu-used=8 rendent la conversion
 * beaucoup plus rapide que les paramètres VP9 par défaut.
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

      // Conserver uniquement la première vidéo et le premier audio.
      '-map',
      '0:v:0',

      '-map',
      '0:a:0?',

      // Limiter la résolution sans agrandir les petites vidéos.
      '-vf',
      'scale=1920:-2:force_original_aspect_ratio=decrease',

      // Codec vidéo WebM.
      '-c:v',
      'libvpx-vp9',

      // Réglages rapides de VP9.
      '-deadline',
      'realtime',

      '-cpu-used',
      '8',

      '-row-mt',
      '1',

      '-threads',
      '0',

      // Qualité constante.
      '-crf',
      '34',

      '-b:v',
      '0',

      // Codec audio WebM.
      '-c:a',
      'libopus',

      '-b:a',
      '128k',

      '-f',
      'webm',

      destinationPath
    ],
    FFMPEG_TIMEOUT
  );
}


/*
 * ============================================================
 * TRAITEMENT DE LA VIDÉO
 * ============================================================
 */

async function processVideo(file) {
  validateVideoFile(file);

  const sourcePath =
    file.path;

  const videoInfo =
    await inspectVideo(
      sourcePath
    );

  const isWebM =
    videoInfo.formatName === 'webm' ||
    videoInfo.formatName.includes(',webm');

  const finalFilename =
    await generateRandomFilename();

  const finalPath =
    path.join(
      UPLOAD_DIR,
      finalFilename
    );

  /*
   * Le fichier .part est utilisé pendant
   * toute la durée de la conversion.
   */
  const temporaryOutputPath =
    `${finalPath}.part`;

  /*
   * Vérification du chemin de destination.
   */
  if (
    path.dirname(finalPath) !==
    path.resolve(UPLOAD_DIR)
  ) {
    throw new Error(
      'Chemin de destination invalide'
    );
  }

  try {
    if (isWebM) {
      /*
       * La vidéo est déjà au format WebM.
       */
      await fs.promises.rename(
        sourcePath,
        finalPath
      );
    } else {
      /*
       * Conversion dans le fichier temporaire.
       */
      await convertToWebM(
        sourcePath,
        temporaryOutputPath
      );

      /*
       * Vérification du fichier WebM créé.
       */
      const convertedInfo =
        await inspectVideo(
          temporaryOutputPath
        );

      const convertedIsWebM =
        convertedInfo.formatName === 'webm' ||
        convertedInfo.formatName.includes(',webm');

      if (!convertedIsWebM) {
        throw new Error(
          'La conversion WebM a échoué'
        );
      }

      /*
       * La conversion est terminée.
       * Le fichier peut devenir définitif.
       */
      await fs.promises.rename(
        temporaryOutputPath,
        finalPath
      );

      /*
       * Suppression du fichier original.
       */
      await safeUnlink(
        sourcePath
      );
    }

    /*
     * Vérification finale du fichier.
     */
    const finalInfo =
      await inspectVideo(
        finalPath
      );

    const finalIsWebM =
      finalInfo.formatName === 'webm' ||
      finalInfo.formatName.includes(',webm');

    if (!finalIsWebM) {
      throw new Error(
        'La conversion WebM a échoué'
      );
    }

    return {
      filename:
        finalFilename,

      path:
        finalPath,

      duration:
        finalInfo.duration
    };
  } catch (error) {
    /*
     * Suppression du fichier temporaire
     * en cas d'erreur.
     */
    await safeUnlink(
      temporaryOutputPath
    );

    /*
     * Suppression du fichier final éventuel.
     */
    await safeUnlink(
      finalPath
    );

    throw error;
  }
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
   * Une publication doit contenir
   * du texte ou une vidéo.
   */
  if (
    !cleanContent &&
    !video
  ) {
    throw new Error(
      'La publication doit contenir du texte ou une vidéo'
    );
  }

  ensureUploadDirectories();

  let idPubli = null;
  let processedVideo = null;

  try {
    /*
     * Création de la publication.
     */
    idPubli =
      createPublication(
        idUser,
        cleanContent
      );

    /*
     * Traitement de la vidéo.
     */
    if (video) {
      processedVideo =
        await processVideo(
          video
        );

      /*
       * Création du média associé
       * dans la base de données.
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

      contenuPub:
        cleanContent,

      media:
        processedVideo
          ? {
              nomMedia:
                processedVideo.filename,

              typeMedia:
                'video',

              duree:
                processedVideo.duration
            }
          : null
    };
  } catch (error) {
    /*
     * Suppression du fichier uploadé
     * en cas d'erreur.
     */
    if (video?.path) {
      await safeUnlink(
        video.path
      );
    }

    /*
     * Suppression du fichier final
     * en cas d'erreur.
     */
    if (processedVideo?.path) {
      await safeUnlink(
        processedVideo.path
      );
    }

    /*
     * Suppression de la publication
     * créée avant l'erreur.
     */
    if (idPubli !== null) {
      try {
        deletePublication(
          idPubli
        );
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
