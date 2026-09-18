const commentModel = require('../models/commentModel');
const reactionModel = require('../models/reactionModel');
const db = require('../config/database');
const jwt = require('jsonwebtoken');
const postService = require('../services/postService');
const { linkifyHashtags } = require('../utils/hashtagUtils');

// ============================================================
// ATTACHER LES RÉACTIONS AUX COMMENTAIRES
// ============================================================

function attachReactionsRecursively(comments, currentUserId) {
  return comments.map(comment => {
    return {
      ...comment,
      reactions: reactionModel.getCommentReactions(
        comment.idComm,
        currentUserId
      ),
      replies: attachReactionsRecursively(
        comment.replies || [],
        currentUserId
      )
    };
  });
}

// ============================================================
// AFFICHER UNE PUBLICATION AVEC SES COMMENTAIRES
// ============================================================

async function renderPostPage(req, res) {
  try {
    const idPubli = parseInt(req.params.idPubli, 10);

    if (isNaN(idPubli)) {
      return res.status(400).send('Publication invalide.');
    }

    // --------------------------------------------------------
    // Utilisateur connecté (si présent).
    //
    // Cette page est accessible à la fois via une route protégée
    // (/publication/:idPubli, authMiddleware déjà passé, req.user
    // défini) et via une route publique (/api/comments/view/:idPubli,
    // sans authMiddleware) : on décode alors le JWT nous-mêmes si
    // un token est présent, sinon la publication est traitée comme
    // consultée par un visiteur anonyme.
    // --------------------------------------------------------

    let currentUser = req.user || null;

    if (!currentUser) {
      let token = req.cookies?.token;

      if (
        !token &&
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer ')
      ) {
        token = req.headers.authorization.split(' ')[1];
      }

      if (token) {
        try {
          currentUser = jwt.verify(
            token,
            process.env.JWT_SECRET || 'secret_de_secours_temporaire'
          );
        } catch (error) {
          currentUser = null;
        }
      }
    }

    // --------------------------------------------------------
    // Récupération de la publication, avec vérification de la
    // visibilité (publique / propriétaire / ami uniquement).
    // --------------------------------------------------------

    let post;

    try {
      post = postService.getPublicationForUser(
        idPubli,
        currentUser?.idUser
      );
    } catch (error) {
      return res.status(404).send('Publication introuvable.');
    }

    // --------------------------------------------------------
    // Commentaires parents + enfants
    // --------------------------------------------------------

    const rawComments = commentModel.getCommentsByPostId(
      idPubli,
      currentUser?.idUser
    );

    const comments = attachReactionsRecursively(
      rawComments,
      currentUser?.idUser
    );

    // --------------------------------------------------------
    // Réactions de la publication
    // --------------------------------------------------------

    const reactions = reactionModel.getPostReactions(
      idPubli,
      currentUser?.idUser
    );

    // --------------------------------------------------------
    // Affichage
    // --------------------------------------------------------

    res.render('post', {
      post,
      comments,
      reactions,
      currentUser,
      linkifyHashtags
    });

  } catch (error) {
    console.error('Erreur renderPostPage :', error);
    res.status(500).send('Erreur affichage publication.');
  }
}

// ============================================================
// AJOUTER UN COMMENTAIRE OU UNE RÉPONSE
// ============================================================

async function addComment(req, res) {
  try {
    const idUser = req.user.idUser;
    const idPubli = parseInt(req.body?.idPubli, 10);

    let idParent = null;

    if (
      req.body?.idParent !== undefined &&
      req.body?.idParent !== null &&
      req.body?.idParent !== ''
    ) {
      idParent = parseInt(req.body.idParent, 10);

      if (isNaN(idParent)) {
        return res.status(400).json({
          error: 'ID du commentaire parent invalide.'
        });
      }
    }

    const contenuCom = req.body?.contenuCom
      ? String(req.body.contenuCom).trim()
      : '';

    // --------------------------------------------------------
    // Vérifications
    // --------------------------------------------------------

    if (isNaN(idPubli)) {
      return res.status(400).json({
        error: 'ID publication invalide.'
      });
    }

    if (!contenuCom) {
      return res.status(400).json({
        error: 'Le commentaire ne peut pas être vide.'
      });
    }

    if (contenuCom.length > 500) {
      return res.status(400).json({
        error: 'Limite de 500 caractères dépassée.'
      });
    }

    let parentId = idParent || null;

    if (parentId) {
      const parentComment = commentModel.getCommentById(parentId);

      if (!parentComment) {
        return res.status(404).json({
          error: 'Commentaire parent introuvable'
        });
      }

      if (parentComment.idParent) {
        parentId = parentComment.idParent;
      }
    }

    // --------------------------------------------------------
    // Création
    // --------------------------------------------------------

    const newComment = commentModel.createComment(
      idUser,
      idPubli,
      contenuCom,
      parentId
    );

    // --------------------------------------------------------
    // Données utilisateur et réactions
    // --------------------------------------------------------

    const createdComment = db.prepare(`
      SELECT
        c.idComm,
        c.idUser,
        c.idPubli,
        c.idParent,
        c.contenuCom,
        c.dateCommentaire,
        c.dateModif,
        u.pseudo AS pseudo
      FROM Commentaire c
      JOIN Utilisateur u
        ON c.idUser = u.idUser
      WHERE c.idComm = ?
    `).get(newComment.idComm);

    const reactions = reactionModel.getCommentReactions(
      newComment.idComm,
      idUser
    );

    res.status(201).json({
      success: true,
      comment: {
        ...createdComment,
        replies: [],
        reactions
      }
    });

  } catch (error) {
    console.error('Erreur addComment :', error);
    res.status(500).json({
      error: error.message || 'Erreur lors de l’ajout du commentaire.'
    });
  }
}

// ============================================================
// MODIFIER UN COMMENTAIRE
// ============================================================

async function editComment(req, res) {
  try {
    const idUser = req.user.idUser;
    const idComm = parseInt(req.params.idComm, 10);
    const contenuCom = req.body?.contenuCom
      ? String(req.body.contenuCom).trim()
      : '';

    if (isNaN(idComm)) {
      return res.status(400).json({
        error: 'ID commentaire invalide.'
      });
    }

    if (!contenuCom || contenuCom.length > 500) {
      return res.status(400).json({
        error: 'Contenu invalide (1 à 500 caractères).'
      });
    }

    const updated = commentModel.updateComment(
      idComm,
      idUser,
      contenuCom
    );

    if (!updated) {
      return res.status(403).json({
        error: 'Action refusée : auteur différent.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Commentaire modifié.'
    });

  } catch (error) {
    console.error('Erreur editComment :', error);
    res.status(500).json({
      error: 'Erreur modification.'
    });
  }
}

// ============================================================
// SUPPRIMER UN COMMENTAIRE
// ============================================================

async function removeCommentApi(req, res) {
  try {
    const idUser = req.user.idUser;
    const idComm = parseInt(req.params.idComm, 10);

    if (isNaN(idComm)) {
      return res.status(400).json({
        error: 'ID commentaire invalide.'
      });
    }

    const deleted = commentModel.deleteComment(
      idComm,
      idUser
    );

    if (!deleted) {
      return res.status(403).json({
        error: 'Action refusée : droit insuffisant.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Commentaire supprimé.'
    });

  } catch (error) {
    console.error('Erreur removeCommentApi :', error);
    res.status(500).json({
      error: 'Erreur suppression.'
    });
  }
}

// ============================================================
// RÉACTION SUR UNE PUBLICATION
// ============================================================

async function handleReaction(req, res) {
  try {
    const idUser = req.user.idUser;
    const idPubli = parseInt(req.body?.idPubli, 10);
    const type = req.body?.type === 'DISLIKE' ? 'DISLIKE' : 'LIKE';

    if (isNaN(idPubli)) {
      return res.status(400).json({
        error: 'ID publication invalide.'
      });
    }

    const result = reactionModel.toggleReaction(
      idUser,
      idPubli,
      type
    );

    res.status(200).json(result);

  } catch (error) {
    console.error('Erreur handleReaction :', error);
    res.status(500).json({
      error: 'Erreur réaction publication.'
    });
  }
}

// ============================================================
// RÉACTION SUR UN COMMENTAIRE
// ============================================================

async function handleCommentReaction(req, res) {
  try {
    const idUser = req.user.idUser;
    const idComm = parseInt(req.params.idComm, 10);
    const type = req.body?.type === 'DISLIKE' ? 'DISLIKE' : 'LIKE';

    if (isNaN(idComm)) {
      return res.status(400).json({
        error: 'ID commentaire invalide.'
      });
    }

    const result = reactionModel.toggleCommentReaction(
      idUser,
      idComm,
      type
    );

    res.status(200).json(result);

  } catch (error) {
    console.error('Erreur handleCommentReaction :', error);
    res.status(500).json({
      error: 'Erreur réaction commentaire.'
    });
  }
}

// ============================================================
// RÉCUPÉRER LES COMMENTAIRES D'UNE PUBLICATION
// ============================================================

async function getComments(req, res) {
  try {
    const idPubli = parseInt(req.params.idPubli, 10);

    if (isNaN(idPubli)) {
      return res.status(400).json({
        error: 'ID publication invalide.'
      });
    }

    const comments = commentModel.getCommentsByPostId(
      idPubli,
      req.user.idUser
    );

    res.status(200).json(comments);

  } catch (error) {
    console.error('Erreur getComments :', error);
    res.status(500).json({
      error: 'Erreur lors du chargement des commentaires.'
    });
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  renderPostPage,
  addComment,
  editComment,
  removeCommentApi,
  getComments,
  handleReaction,
  handleCommentReaction
};