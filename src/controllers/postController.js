const {
  createPost
} = require('../services/postService');


/*
 * ============================================================
 * AFFICHAGE DU FORMULAIRE
 * ============================================================
 */

function showPostPage(req, res) {
  return res.render('post');
}


/*
 * ============================================================
 * CRÉATION D'UNE PUBLICATION
 * ============================================================
 */

async function createPostController(req, res) {
  try {
    /*
     * authMiddleware a déjà vérifié le JWT.
     *
     * Le JWT contient idUser.
     */
    const idUser =
      Number(req.user?.idUser);

    if (
      !Number.isInteger(idUser) ||
      idUser <= 0
    ) {
      return res.status(401).json({
        error:
          'Utilisateur non authentifié'
      });
    }

    const result =
      await createPost({
        idUser,

        contenuPub:
          req.body?.contenuPub,

        video:
          req.file || null
      });

    return res.status(201).json({
      message:
        'Publication créée avec succès',

      publication:
        result
    });
  } catch (error) {
    console.error(
      'Erreur création publication :',
      error
    );

    /*
     * Erreurs de validation.
     */
    const validationErrors = [
      'Publication',
      'vidéo',
      'vidéo valide',
      'Format vidéo',
      'Type MIME',
      'Taille de vidéo',
      'durée',
      'dimensions',
      'flux vidéo',
      'conversion WebM',
      'Utilisateur authentifié',
      'contenu de la publication'
    ];

    const isValidationError =
      validationErrors.some(
        (message) =>
          error.message?.toLowerCase()
            .includes(message.toLowerCase())
      );

    if (isValidationError) {
      return res.status(400).json({
        error: error.message
      });
    }

    return res.status(500).json({
      error:
        'Une erreur interne est survenue lors de la création de la publication'
    });
  }
}


module.exports = {
  showPostPage,
  createPostController
};

