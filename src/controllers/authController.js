const authService = require('../services/authService');

/**
 * Normalise les messages d'erreur pour éviter la fuite d'informations SQL ou serveur
 */
function handleAuthError(err, res, defaultStatus = 400) {
  console.error(err);

  // Détection des conflits d'unicité SQLite (inscriptions concurrentes ou doublons)
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err.message && err.message.includes('UNIQUE constraint failed'))) {
    return res.status(409).json({
      error: 'Cet email ou pseudo est déjà utilisé'
    });
  }

  // Si c'est une autre erreur interne SQLite
  if (err.code && err.code.startsWith('SQLITE_')) {
    return res.status(500).json({
      error: 'Une erreur interne est survenue'
    });
  }

  // Erreurs applicatives contrôlées (validation, mauvais identifiants, etc.)
  return res.status(defaultStatus).json({
    error: err.message || 'Une erreur est survenue'
  });
}

async function register(req, res) {
  try {
    const {
      pseudo,
      email,
      motDePasse,
      dateNaissance
    } = req.body;

    const user = await authService.register(
      pseudo,
      email,
      motDePasse,
      dateNaissance
    );

    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      user
    });
  } catch (err) {
    handleAuthError(err, res, 400);
  }
}

async function login(req, res) {
  try {
    const {
      email,
      motDePasse
    } = req.body;

    const result = await authService.login(
      email,
      motDePasse
    );

    // Stockage du token dans un cookie HTTP sécurisé
    res.cookie('token', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000 // 2 heures (identique à l'expiration du JWT)
    });

    res.status(200).json({
      message: 'Connexion réussie',
      token: result.token,
      user: result.user
    });
  } catch (err) {
    handleAuthError(err, res, 401);
  }
}

async function logout(req, res) {
  res.clearCookie('token');

  // Si la déconnexion vient d'un formulaire de page web, redirection vers l'accueil
  if (req.accepts('html')) {
    return res.redirect('/');
  }

  res.status(200).json({
    message: 'Déconnexion réussie'
  });
}

module.exports = {
  register,
  login,
  logout
};