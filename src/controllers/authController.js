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
  res.status(200).json({
    message: 'Déconnexion réussie'
  });
}

module.exports = {
  register,
  login,
  logout
};