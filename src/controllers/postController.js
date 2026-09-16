const fs = require('fs/promises');
const path = require('path');

const postService =
require('../services/postService');

/*

* ============================================================
* CONSTANTES
* ============================================================
  */

const IMAGE_MAX_SIZE =
20 * 1024 * 1024;

const VIDEO_MAX_SIZE =
100 * 1024 * 1024;

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

/*

* ============================================================
* VÉRIFICATION DES SIGNATURES BINAIRES
* ============================================================
  */

/**

* Vérifie la signature réelle d'un JPEG.
  */
  function isRealJPEG(buffer) {

  if (
  !Buffer.isBuffer(buffer) ||
  buffer.length < 3
  ) {

  
   return false;
  
  }

  return (
  buffer[0] === 0xFF &&
  buffer[1] === 0xD8 &&
  buffer[2] === 0xFF
  );
  }

/**

* Vérifie la signature réelle d'un PNG.
  */
  function isRealPNG(buffer) {

  if (
  !Buffer.isBuffer(buffer) ||
  buffer.length < 8
  ) {

  
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

/**

* Vérifie la signature réelle d'un WebP.
  */
  function isRealWebP(buffer) {

  if (
  !Buffer.isBuffer(buffer) ||
  buffer.length < 12
  ) {

  
   return false;
  

  }

  return (
  buffer.toString(
  'ascii',
  0,
  4
  ) === 'RIFF' &&

  
   buffer.toString(
       'ascii',
       8,
       12
   ) === 'WEBP'
  

  );
  }

/**

* Vérifie qu'un fichier contient une structure MP4/MOV.
*
* Les conteneurs ISO Base Media utilisent normalement
* une boîte "ftyp" dans leur en-tête.
  */
  function isRealMP4(buffer) {

  if (
  !Buffer.isBuffer(buffer) ||
  buffer.length < 12
  ) {

  
   return false;
  

  }

  const maxOffset =
  Math.min(
  buffer.length - 4,
  64
  );

  for (
  let i = 0;
  i <= maxOffset;
  i++
  ) {

  
   if (
       buffer.toString(
           'ascii',
           i,
           i + 4
       ) === 'ftyp'
   ) {

       return true;
   }
  

  }

  return false;
  }

/**

* Vérifie la signature EBML d'un WebM.
  */
  function isRealWebM(buffer) {

  if (
  !Buffer.isBuffer(buffer) ||
  buffer.length < 4
  ) {

  
   return false;
  

  }

  return (
  buffer[0] === 0x1A &&
  buffer[1] === 0x45 &&
  buffer[2] === 0xDF &&
  buffer[3] === 0xA3
  );
  }

/**

* Vérifie la signature d'un fichier OGG.
  */
  function isRealOGG(buffer) {

  if (
  !Buffer.isBuffer(buffer) ||
  buffer.length < 4
  ) {

  
   return false;
  

  }

  return (
  buffer.toString(
  'ascii',
  0,
  4
  ) === 'OggS'
  );
  }

/*

* ============================================================
* SUPPRESSION SÉCURISÉE D'UN FICHIER
* ============================================================
  */

/**

* Supprime un fichier utilisateur uniquement s'il se trouve
* directement dans le dossier uploads.
*
* Les noms de fichiers provenant de la base sont également
* contrôlés avant la suppression physique.
  */
  async function deleteUploadedFile(filename) {

  if (
  typeof filename !== 'string' ||
  !filename
  ) {

  
   throw new Error(
       'Nom de fichier invalide'
   );
  

  }

  const uploadDir =
  path.resolve(
  __dirname,
  '../../uploads'
  );

  /*

  * On interdit tout chemin.
  *
  * Seul un nom de fichier simple est accepté.
    */
    if (
    filename !== path.basename(filename)
    ) {

    throw new Error(
    'Nom de fichier invalide'
    );
    }

  const filePath =
  path.resolve(
  uploadDir,
  filename
  );

  /*

  * Le fichier doit être directement dans uploads.
    */
    if (
    path.dirname(filePath) !== uploadDir
    ) {

    throw new Error(
    'Chemin de fichier invalide'
    );
    }

  try {

  
   await fs.unlink(filePath);
  

  } catch (error) {

  
   /*
    * Un fichier déjà absent n'est pas bloquant :
    * la publication peut quand même être supprimée.
    */
   if (error.code === 'ENOENT') {
       return;
   }


   throw error;
  

  }
  }

/*

* ============================================================
* UPLOAD D'UNE PUBLICATION
* ============================================================
  */

async function uploadImage(req, res) {


let uploadedFilePath = null;

try {

    /*
     * ====================================================
     * AUTHENTIFICATION
     * ====================================================
     */

    if (
        !req.user ||
        !req.user.idUser
    ) {

        return res.status(401).json({
            error: 'Utilisateur non authentifié'
        });
    }


    /*
     * ====================================================
     * FICHIER
     * ====================================================
     */

    if (!req.file) {

        return res.status(400).json({
            error: 'Aucun fichier envoyé'
        });
    }


    const file =
        req.file;


    uploadedFilePath =
        file.path;


    /*
     * ====================================================
     * DÉTERMINATION DU TYPE
     * ====================================================
     */

    let typeMedia = null;


    if (
        IMAGE_TYPES.includes(
            file.mimetype
        )
    ) {

        typeMedia = 'image';

    } else if (
        VIDEO_TYPES.includes(
            file.mimetype
        )
    ) {

        typeMedia = 'video';

    } else {

        await fs
            .unlink(uploadedFilePath)
            .catch(() => {});


        return res.status(400).json({
            error:
                'Format de fichier non autorisé.'
        });
    }


    /*
     * ====================================================
     * LIMITE DE TAILLE
     * ====================================================
     */

    const maxSize =
        typeMedia === 'image'
            ? IMAGE_MAX_SIZE
            : VIDEO_MAX_SIZE;


    if (file.size > maxSize) {

        await fs
            .unlink(uploadedFilePath)
            .catch(() => {});


        return res.status(400).json({
            error:
                typeMedia === 'image'
                    ? 'L’image ne doit pas dépasser 20 Mo.'
                    : 'La vidéo ne doit pas dépasser 100 Mo.'
        });
    }


    /*
     * ====================================================
     * LECTURE DU FICHIER
     * ====================================================
     */

    const buffer =
        await fs.readFile(
            uploadedFilePath
        );


    /*
     * ====================================================
     * VÉRIFICATION IMAGE
     * ====================================================
     */

    if (typeMedia === 'image') {

        let validImage = false;


        if (
            file.mimetype === 'image/jpeg'
        ) {

            validImage =
                isRealJPEG(buffer);

        } else if (
            file.mimetype === 'image/png'
        ) {

            validImage =
                isRealPNG(buffer);

        } else if (
            file.mimetype === 'image/webp'
        ) {

            validImage =
                isRealWebP(buffer);
        }


        if (!validImage) {

            await fs
                .unlink(uploadedFilePath)
                .catch(() => {});


            return res.status(400).json({
                error:
                    'Le contenu réel du fichier ne correspond pas au type déclaré.'
            });
        }
    }


    /*
     * ====================================================
     * VÉRIFICATION VIDÉO
     * ====================================================
     */

    if (typeMedia === 'video') {

        let validVideo = false;


        if (
            file.mimetype === 'video/mp4'
        ) {

            validVideo =
                isRealMP4(buffer);

        } else if (
            file.mimetype === 'video/quicktime'
        ) {

            /*
             * MOV utilise également le conteneur
             * ISO Base Media et possède normalement ftyp.
             */
            validVideo =
                isRealMP4(buffer);

        } else if (
            file.mimetype === 'video/webm'
        ) {

            validVideo =
                isRealWebM(buffer);

        } else if (
            file.mimetype === 'video/ogg'
        ) {

            validVideo =
                isRealOGG(buffer);
        }


        if (!validVideo) {

            await fs
                .unlink(uploadedFilePath)
                .catch(() => {});


            return res.status(400).json({
                error:
                    'Le contenu réel du fichier ne correspond pas au type déclaré.'
            });
        }
    }


    /*
     * ====================================================
     * DESCRIPTION
     * ====================================================
     */

    const contenuPub =
        req.body.contenuPub
            ? String(
                req.body.contenuPub
            ).trim()
            : null;


    /*
     * ====================================================
     * VISIBILITÉ
     * ====================================================
     */

    const visibilite =
        req.body.visibilite !== undefined
            ? Number(
                req.body.visibilite
            )
            : 1;


    if (
        visibilite !== 0 &&
        visibilite !== 1
    ) {

        await fs
            .unlink(uploadedFilePath)
            .catch(() => {});


        return res.status(400).json({
            error:
                'Visibilité invalide.'
        });
    }


    /*
     * ====================================================
     * CRÉATION DE LA PUBLICATION
     * ====================================================
     *
     * L'identité est toujours récupérée depuis le JWT.
     *
     * Une éventuelle valeur idUser envoyée par le client
     * n'est jamais utilisée.
     */

    const post =
        await postService.createMediaPost(
            req.user.idUser,
            contenuPub,
            visibilite,
            file.filename,
            typeMedia
        );


    /*
     * Le fichier est maintenant associé à une publication.
     * On ne doit plus le supprimer dans le catch général
     * si la création DB a réussi.
     */
    uploadedFilePath = null;


    return res.status(201).json({

        message:
            'Publication créée avec succès.',

        post,

        url:
            `/uploads/${file.filename}`
    });

} catch (error) {

    console.error(
        'Erreur upload :',
        error
    );


    /*
     * Si une erreur arrive avant la création réussie
     * de la publication, le fichier temporaire est supprimé.
     */
    if (uploadedFilePath) {

        await fs
            .unlink(uploadedFilePath)
            .catch(() => {});
    }


    return res.status(500).json({
        error:
            'Erreur lors de la publication.'
    });
}


}

/*

* ============================================================
* SUPPRESSION D'UNE PUBLICATION
* ============================================================
  */

/**

* Supprime une publication.
*
* Seul son propriétaire peut la supprimer.
  */
  async function deletePost(req, res) {

  try {

  
   /*
    * ====================================================
    * AUTHENTIFICATION
    * ====================================================
    */

   if (
       !req.user ||
       !req.user.idUser
   ) {

       return res.status(401).json({
           error:
               'Utilisateur non authentifié'
       });
   }


   /*
    * ====================================================
    * IDENTIFIANT
    * ====================================================
    */

   const idPubli =
       Number(
           req.params.idPubli
       );


   if (
       !Number.isInteger(idPubli) ||
       idPubli <= 0
   ) {

       return res.status(400).json({
           error:
               'Identifiant de publication invalide'
       });
   }


   /*
    * ====================================================
    * SUPPRESSION EN BASE
    * ====================================================
    *
    * postService.deletePost() vérifie que la publication
    * appartient à req.user.idUser.
    */

   const media =
       await postService.deletePost(
           idPubli,
           req.user.idUser
       );


   /*
    * ====================================================
    * SUPPRESSION DU FICHIER
    * ====================================================
    *
    * Le nom vient de la base mais est contrôlé avant
    * toute suppression physique.
    */

   try {

       await deleteUploadedFile(
           media.nomMedia
       );

   } catch (fileError) {

       /*
        * La publication est déjà supprimée de la base.
        * On journalise l'erreur pour permettre son nettoyage
        * ultérieurement sans exposer de chemin système.
        */
       console.error(
           'Erreur suppression fichier média :',
           fileError.message
       );
   }


   return res.status(200).json({
       message:
           'Publication supprimée'
   });
  

  } catch (error) {

  
   console.error(
       'Erreur suppression publication :',
       error
   );


   /*
    * Erreur d'autorisation renvoyée par le service.
    */
   if (error.status) {

       return res.status(
           error.status
       ).json({
           error:
               error.message
       });
   }


   return res.status(500).json({
       error:
           'Erreur lors de la suppression de la publication'
   });
  

  }
  }

/*

* ============================================================
* PAGE DE CRÉATION DE PUBLICATION
* ============================================================
  */

async function getImages(req, res) {


try {

    const posts =
        await postService.getAllPosts();


    return res.render(
        'posts',
        {
            user: req.user,
            posts
        }
    );

} catch (error) {

    console.error(
        'Erreur chargement page publication :',
        error
    );


    return res.status(500).send(
        'Erreur lors du chargement de la page.'
    );
}


}

/*

* ============================================================
* API DE TOUTES LES PUBLICATIONS
* ============================================================
  */

async function getImagesApi(req, res) {


try {

    const posts =
        await postService.getAllPosts();


    return res.status(200).json(
        posts
    );

} catch (error) {

    console.error(
        'Erreur API publications :',
        error
    );


    return res.status(500).json({
        error:
            'Erreur lors du chargement des publications.'
    });
}


}

/*

* ============================================================
* API DES PUBLICATIONS D'UN UTILISATEUR
* ============================================================
  */

async function getUserImagesApi(req, res) {


try {

    const idUser =
        Number(
            req.params.idUser
        );


    if (
        !Number.isInteger(idUser) ||
        idUser <= 0
    ) {

        return res.status(400).json({
            error:
                'Identifiant utilisateur invalide.'
        });
    }


    const posts =
        await postService.getUserPosts(
            idUser
        );


    return res.status(200).json(
        posts
    );

} catch (error) {

    console.error(
        'Erreur API publications utilisateur :',
        error
    );


    return res.status(500).json({
        error:
            'Erreur lors du chargement des publications.'
    });
}


}

/*

* ============================================================
* EXPORTS
* ============================================================
  */

module.exports = {


uploadImage,

getImages,

getImagesApi,

getUserImagesApi,

isRealJPEG,

isRealPNG,

isRealWebP,

isRealMP4,

isRealWebM,

isRealOGG,

deletePost
};
