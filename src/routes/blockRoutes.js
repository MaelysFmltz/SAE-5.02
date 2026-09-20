const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const blockService = require('../services/blockService');

const router = express.Router();

// Liste des comptes bloqués par l'utilisateur connecté (pour settings)
router.get('/', authMiddleware, (req, res) => {
  try {
    const list = blockService.listerBloques(req.user.idUser);
    return res.status(200).json({ blockedUsers: list });
  } catch (error) {
    console.error('Erreur listerBloques :', error);
    return res.status(500).json({ error: 'Impossible de récupérer la liste des comptes bloqués.' });
  }
});

// Bloquer un utilisateur
router.post('/:idUserTarget', authMiddleware, (req, res) => {
  const idUserTarget = Number(req.params.idUserTarget);
  const result = blockService.bloquerUtilisateur(req.user.idUser, idUserTarget);

  if (!result.succes) {
    return res.status(400).json({ error: result.erreur });
  }

  return res.status(200).json({ message: 'Utilisateur bloqué avec succès.' });
});

// Débloquer un utilisateur
router.delete('/:idUserTarget', authMiddleware, (req, res) => {
  const idUserTarget = Number(req.params.idUserTarget);
  const result = blockService.debloquerUtilisateur(req.user.idUser, idUserTarget);

  if (!result.succes) {
    return res.status(400).json({ error: result.erreur });
  }

  return res.status(200).json({ message: 'Utilisateur débloqué avec succès.' });
});

module.exports = router;