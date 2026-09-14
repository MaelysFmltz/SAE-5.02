const commentModel = require('../models/commentModel');
const reactionModel = require('../models/reactionModel');
const db = require('../config/database');

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

    if (!post) {
      return res.status(404).send('Publication introuvable.');
    }

    // Récupération des commentaires avec leurs réactions respectives
    const rawComments = commentModel.getCommentsByPostId(idPubli);
    const comments = rawComments.map(c => ({
      ...c,
      reactions: reactionModel.getCommentReactions(c.idComm, null)
    }));

    // Réactions de la publication
    const reactions = reactionModel.getPostReactions(idPubli, null);

    res.render('post', { post, comments, reactions });
  } catch (error) {
    console.error('Erreur renderPostPage :', error);
    res.status(500).send('Erreur affichage publication.');
  }
}

async function addComment(req, res) {
  try {
    const idUser = req.user.idUser;
    const targetPostId = parseInt(req.body?.idPubli, 10);
    const contenuCom = req.body?.contenuCom ? req.body.contenuCom.trim() : '';

    if (isNaN(targetPostId)) return res.status(400).json({ error: 'ID publication invalide.' });
    if (!contenuCom) return res.status(400).json({ error: 'Le commentaire ne peut pas être vide.' });
    if (contenuCom.length > 500) return res.status(400).json({ error: 'Limite de 500 caractères dépassée.' });

    const postExists = db.prepare('SELECT idPubli FROM Publication WHERE idPubli = ?').get(targetPostId);
    if (!postExists) return res.status(404).json({ error: 'Publication introuvable.' });

    const newComment = commentModel.createComment(idUser, targetPostId, contenuCom);
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
      return res.status(403).json({ error: 'Action refusée : vous devez être l’auteur du commentaire.' });
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
      return res.status(403).json({ error: 'Action refusée : droit de suppression insuffisant.' });
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

    if (isNaN(idComm)) {
      return res.status(400).json({ error: 'Identifiant de commentaire invalide.' });
    }

    const result = reactionModel.toggleCommentReaction(idUser, idComm, type);
    res.status(200).json(result);
  } catch (error) {
    console.error('Erreur handleCommentReaction :', error);
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