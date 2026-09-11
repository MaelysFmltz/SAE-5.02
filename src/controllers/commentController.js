const commentModel = require('../models/commentModel');
const db = require('../config/database');

async function renderPostPage(req, res) {
  try {
    const idPubli = parseInt(req.params.idPubli, 10);

    const post = db.prepare('SELECT * FROM Publication WHERE idPubli = ?').get(idPubli) || {
      idPubli: idPubli,
      contenuPub: 'Publication de test'
    };

    const comments = commentModel.getCommentsByPostId(idPubli);
    res.render('post', { post, comments, currentUserId: 1 });
  } catch (error) {
    console.error('Erreur renderPostPage :', error);
    res.status(500).send('Erreur affichage publication');
  }
}

async function addComment(req, res) {
  try {
    const { idUser, idPubli, contenuCom } = req.body;
    const targetPostId = idPubli || parseInt(req.params.idPubli, 10) || 1;

    if (contenuCom && contenuCom.trim()) {
      const texte = contenuCom.trim();
      if (texte.length > 500) {
        return res.status(400).send('Le commentaire dépasse la limite de 500 caractères.');
      }
      commentModel.createComment(idUser || 1, targetPostId, texte);
    }

    res.redirect(`/api/comments/view/${targetPostId}`);
  } catch (error) {
    console.error('Erreur addComment :', error);
    res.status(500).send('Erreur lors de l’ajout');
  }
}

async function editComment(req, res) {
  try {
    const idComm = parseInt(req.params.idComm, 10);
    const { idUser, idPubli, contenuCom } = req.body;

    if (contenuCom && contenuCom.trim()) {
      const texte = contenuCom.trim();
      if (texte.length > 500) {
        return res.status(400).send('Le commentaire dépasse la limite de 500 caractères.');
      }
      commentModel.updateComment(idComm, idUser || 1, texte);
    }

    res.redirect(`/api/comments/view/${idPubli}`);
  } catch (error) {
    console.error('Erreur editComment :', error);
    res.status(500).send('Erreur lors de la modification');
  }
}

async function removeComment(req, res) {
  try {
    const idComm = parseInt(req.params.idComm, 10);
    const idUser = req.body.idUser || 1;
    const idPubli = req.body.idPubli || 1;

    commentModel.deleteComment(idComm, idUser);
    res.redirect(`/api/comments/view/${idPubli}`);
  } catch (error) {
    console.error('Erreur removeComment :', error);
    res.status(500).send('Erreur lors de la suppression');
  }
}

async function getComments(req, res) {
  try {
    const idPubli = parseInt(req.params.idPubli, 10);
    const comments = commentModel.getCommentsByPostId(idPubli);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  renderPostPage,
  addComment,
  editComment,
  removeComment,
  getComments
};