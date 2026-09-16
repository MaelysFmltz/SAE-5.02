const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  let token = null;

  // 1. Vérification dans les cookies (pour la navigation EJS)
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } 
  // 2. Vérification dans les headers HTTP (compatibilité API de ton collègue)
  else if (req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  // Aucun token trouvé
  if (!token) {
    // Si c'est une requête de page HTML classique, on redirige vers le login
    if (req.accepts('html')) {
      return res.redirect('/');
    }
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret_de_secours_temporaire'
    );

    req.user = decoded; // Injecte { idUser, pseudo, role } dans la requête
    next();
  } catch (err) {
    // Token invalide ou expiré
    if (req.cookies && req.cookies.token) {
      res.clearCookie('token');
    }
    if (req.accepts('html')) {
      return res.redirect('/');
    }
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

module.exports = authMiddleware;