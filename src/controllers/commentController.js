const commentModel = require('../models/commentModel');
const reactionModel = require('../models/reactionModel');
const db = require('../config/database');
const jwt = require('jsonwebtoken');

// Fonction utilitaire pour attacher les compteurs de likes récursivement
function attachReactionsRecursively(comments, currentUserId) {
  return comments.map(c => {
    return {
      ...c,
      reactions: reactionModel.getCommentReactions(c.idComm, currentUserId),
      replies: attachReactionsRecursively(c.replies || [], currentUserId)
    };
  });
}

async function renderPostPage(req, res) {
  try {
    const idPubli = parseInt(req.params.idPubli, 10);
    if (isNaN(idPubli)) return res.status(400).send('Publication invalide.');

    const post = db.prepare(`
      SELECT p.*, u.pseudo AS auteurPseudo
      FROM Publication p
      JOIN Utilisateur u ON p.idUser = u.idUser
      WHERE p.idPubli = ?
    `).get(idPubli);

    if (!post) return res.status(404).send('Publication introuvable.');

    let currentUser = null;
    let token = req.cookies?.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      try {
        currentUser = jwt.verify(token, process.env.JWT_SECRET || 'pixora_secret_key');
      } catch (e) {
        currentUser = null;
      }
    }

    const rawComments = commentModel.getCommentsByPostId(idPubli);
    const comments = attachReactionsRecursively(rawComments, currentUser?.idUser);
    const reactions = reactionModel.getPostReactions(idPubli, currentUser?.idUser);

    res.render('post', { post, comments, reactions, currentUser });
  } catch (error) {
    console.error('Erreur renderPostPage :', error);
    res.status(500).send('Erreur affichage publication.');
  }
}

async function addComment(req, res) {
  try {
    const idUser = req.user.idUser;
    const targetPostId = parseInt(req.body?.idPubli, 10);
    const idParent = req.body?.idParent ? parseInt(req.body.idParent, 10) : null;
    const contenuCom = req.body?.contenuCom ? req.body.contenuCom.trim() : '';

    if (isNaN(targetPostId)) return res.status(400).json({ error: 'ID publication invalide.' });
    if (!contenuCom) return res.status(400).json({ error: 'Le commentaire ne peut pas être vide.' });
    if (contenuCom.length > 500) return res.status(400).json({ error: 'Limite de 500 caractères dépassée.' });

    const newComment = commentModel.createComment(idUser, targetPostId, contenuCom, idParent);
    res.status(201).json({ success: true, comment: newComment });
  } catch (error) {
    console.error('Erreur addComment :', error);
    res.status(500).json({ error: 'Erreur lors de l’ajout.' });
  }
}

async function editComment(req, res) {
  try {
    const idUser = req.user.idUser;
    const idComm = parseInt(req.params.idComm, 10);
    const contenuCom = req.body?.contenuCom ? req.body.contenuCom.trim() : '';

    if (!contenuCom || contenuCom.length > 500) {
      return res.status(400).json({ error: 'Contenu invalide (1 à 500 caractères).' });
    }

    const updated = commentModel.updateComment(idComm, idUser, contenuCom);
    if (!updated) {
      return res.status(403).json({ error: 'Action refusée : auteur différent.' });
    }

    res.status(200).json({ success: true, message: 'Commentaire modifié.' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur modification.' });
  }
}

async function removeCommentApi(req, res) {
  try {
    const idUser = req.user.idUser;
    const idComm = parseInt(req.params.idComm, 10);

    const deleted = commentModel.deleteComment(idComm, idUser);
    if (!deleted) {
      return res.status(403).json({ error: 'Action refusée : droit insuffisant.' });
    }

    res.status(200).json({ success: true, message: 'Commentaire supprimé.' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur suppression.' });
  }
}

async function handleReaction(req, res) {
  try {
    const idUser = req.user.idUser;
    const idPubli = parseInt(req.body?.idPubli, 10);
    const type = req.body?.type === 'DISLIKE' ? 'DISLIKE' : 'LIKE';
    const result = reactionModel.toggleReaction(idUser, idPubli, type);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Erreur réaction.' });
  }
}

async function handleCommentReaction(req, res) {
  try {
    const idUser = req.user.idUser;
    const idComm = parseInt(req.params.idComm, 10);
    const type = req.body?.type === 'DISLIKE' ? 'DISLIKE' : 'LIKE';
    const result = reactionModel.toggleCommentReaction(idUser, idComm, type);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Erreur réaction commentaire.' });
  }
}

async function getComments(req, res) {
  try {
    const idPubli = parseInt(req.params.idPubli, 10);
    res.json(commentModel.getCommentsByPostId(idPubli));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  renderPostPage,
  addComment,
  editComment,
  removeCommentApi,
  getComments,
  handleReaction,
  handleCommentReaction
};