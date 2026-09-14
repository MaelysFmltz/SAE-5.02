const jwt = require('jsonwebtoken');
const db = require('../config/database');
const userModel = require('../models/userModel');

function authMiddleware(req, res, next) {
  const authorization =
    req.headers.authorization;

  if (!authorization) {
    return res.status(401).json({
      error: 'Token manquant'
    });
  }

  const parts = authorization.split(' ');

  if (
    parts.length !== 2 ||
    parts[0] !== 'Bearer'
  ) {
    return res.status(401).json({
      error: 'Format du token invalide'
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Vérifier l'utilisateur dans la base à chaque requête
    // pour prendre en compte une suspension ou une
    // modification de rôle après la création du JWT.
    const user = userModel.findById(
      db,
      decoded.idUser
    );

    if (!user) {
      return res.status(401).json({
        error: 'Utilisateur introuvable'
      });
    }

    if (user.statut !== 'actif') {
      return res.status(403).json({
        error: 'Ce compte n’est pas actif'
      });
    }

    // Utiliser les informations actuelles de la BDD
    // plutôt que le rôle potentiellement ancien du JWT.
    req.user = {
      ...decoded,
      pseudo: user.pseudo,
      role: user.role,
      statut: user.statut
    };

    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Token invalide ou expiré'
    });
  }
}

module.exports = authMiddleware;