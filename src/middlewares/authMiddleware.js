const jwt = require('jsonwebtoken');
const db = require('../config/database');
const userModel = require('../models/userModel');

/**
 * Détermine si la requête correspond à une page HTML standard.
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

  // 1. Récupération via Cookie httpOnly
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Récupération via Header Authorization
  else if (req.headers && req.headers.authorization) {
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

  // 3. Absence de Token
  if (!token) {
    if (isHtmlRequest(req)) {
      return redirectToLogin(res);
    }
    return res.status(401).json({
      error: 'Token manquant'
    });
  }

  // 4. Validation JWT
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

    // =========================================================
    // CONTRÔLE SUPERADMIN VIRTUEL (.ENV)
    // =========================================================
    const superPseudo = process.env.SUPERADMIN_PSEUDO;
    const superEmail = process.env.SUPERADMIN_EMAIL;

    if (
      decoded.idUser === -999 ||
      (superPseudo && decoded.pseudo === superPseudo) ||
      (superEmail && decoded.email === superEmail)
    ) {
      req.user = {
        ...decoded,
        idUser: -999,
        pseudo: superPseudo || decoded.pseudo,
        email: superEmail || decoded.email,
        role: 'admin',
        statut: 'actif'
      };

      // Le Superadmin n'a accès qu'à l'admin, aux profils et aux publications isolées
      // Pas de messagerie (/messages) pour préserver le secret des correspondances privées
      if (isHtmlRequest(req)) {
        const currentPath = (req.originalUrl || '').split('?')[0];
        const isAllowedForSuperadmin = 
          currentPath === '/admin' || 
          currentPath === '/super-admin' || 
          currentPath.startsWith('/profile/') ||
          currentPath.startsWith('/publication/');

        if (!isAllowedForSuperadmin) {
          return res.redirect('/admin');
        }
      }

      return next();
    }
    // =========================================================

    // Récupération de l'utilisateur standard en base
    let user = null;
    try {
      user = userModel.findById(decoded.idUser);
    } catch (e) {
      user = null;
    }

    if (user && user.statut && user.statut !== 'actif') {
      if (req.cookies && req.cookies.token) res.clearCookie('token');

      if (isHtmlRequest(req)) {
        return res.redirect(`/banned?statut=${encodeURIComponent(user.statut)}`);
      }

      const messages = {
        suspendu: 'Votre compte est temporairement suspendu.',
        banni: 'Votre compte a été banni pour non-respect des règles.',
        supprime: 'Ce compte a été supprimé.'
      };

      return res.status(403).json({
        error: messages[user.statut] || 'Ce compte n’est pas actif.',
        statut: user.statut
      });
    }

    req.user = {
      ...decoded,
      idUser: decoded.idUser,
      pseudo: decoded.pseudo || user?.pseudo,
      role: user?.role || decoded.role || 'user',
      statut: user?.statut || 'actif'
    };

    return next();
  } catch (err) {
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