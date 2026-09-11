const authService = require('../services/authService');

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
    console.error(err);
    res.status(400).json({
      error: err.message
    });
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
      maxAge: 2 * 60 * 60 * 1000 // 2 heures (identique à l'expiration du JWT)
    });

    res.status(200).json({
      message: 'Connexion réussie',
      token: result.token,
      user: result.user
    });
  } catch (err) {
    console.error(err);
    res.status(401).json({
      error: err.message
    });
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