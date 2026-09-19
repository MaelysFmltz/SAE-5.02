const jwt = require('jsonwebtoken');
const db = require('../config/database');
const userModel = require('../models/userModel');

/**
 * Détermine si la requête correspond à une page HTML.
 */
function isHtmlRequest(req) {
  const originalUrl = (req.originalUrl || '').split('?')[0];

  const isApi =
    originalUrl === '/api' ||
    originalUrl.startsWith('/api/') ||
    originalUrl.includes('/api/');

  if (isApi) {
    return false;
  }

  return req.method === 'GET';
}

/**
 * Redirige une page HTML vers la connexion.
 */
function redirectToLogin(res) {
  return res.redirect('/');
}

/**
 * Middleware d'authentification JWT.
 */
function authMiddleware(req, res, next) {
  let token = null;

  // 1. COOKIE
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. HEADER AUTHORIZATION
  else if (req.headers.authorization) {
    const authorization = req.headers.authorization.trim();
    const parts = authorization.split(/\s+/);

    if (
      parts.length === 2 &&
      parts[0].toLowerCase() === 'bearer' &&
      parts[1]
    ) {
      token = parts[1];
    }
  }

  // 3. TOKEN ABSENT
  if (!token) {
    if (isHtmlRequest(req)) {
      return redirectToLogin(res);
    }
    return res.status(401).json({
      error: 'Token manquant'
    });
  }

  // 4. VALIDATION JWT ET VÉRIFICATION DU STATUT EN BDD
  try {
    const secret = process.env.JWT_SECRET || 'secret_de_secours_temporaire';
    const decoded = jwt.verify(token, secret);

    if (!decoded || !decoded.idUser) {
      if (req.cookies && req.cookies.token) {
        res.clearCookie('token');
      }

      if (isHtmlRequest(req)) {
        return redirectToLogin(res);
      }

      return res.status(401).json({
        error: 'Token invalide'
      });
    }

    // Contrôle direct en base de données pour prendre en compte
    // les bannissements/suspensions et changements de rôle immédiats
    const user = userModel.findById(decoded.idUser) || (typeof userModel.findById === 'function' ? userModel.findById(db, decoded.idUser) : null);

    if (!user) {
      if (req.cookies && req.cookies.token) res.clearCookie('token');
      if (isHtmlRequest(req)) return redirectToLogin(res);
      return res.status(401).json({ error: 'Utilisateur introuvable' });
    }

    if (user.statut && user.statut !== 'actif') {
      if (req.cookies && req.cookies.token) res.clearCookie('token');
      if (isHtmlRequest(req)) return redirectToLogin(res);
      return res.status(403).json({ error: 'Ce compte n’est pas actif' });
    }

    req.user = {
      ...decoded,
      idUser: user.idUser,
      pseudo: user.pseudo,
      role: user.role,
      statut: user.statut
    };

    return next();
  } catch (err) {
    console.error('Erreur authentification :', err.message);

    if (req.cookies && req.cookies.token) {
      res.clearCookie('token');
    }

    if (isHtmlRequest(req)) {
      return redirectToLogin(res);
    }

    return res.status(401).json({
      error: 'Token invalide ou expiré'
    });
  }
}

module.exports = authMiddleware;