const userModel = require('../models/userModel');

const {
  hashPassword,
  comparePassword
} = require('../utils/passwordUtils');

const {
  createToken
} = require('../utils/tokenUtils');

async function register(
  pseudo,
  email,
  motDePasse,
  dateNaissance
) {
  if (!pseudo || !email || !motDePasse) {
    throw new Error(
      'Pseudo, email et mot de passe obligatoires'
    );
  }

  const userEmail =
    await userModel.findByEmail(email);

  if (userEmail) {
    throw new Error(
      'Cet email est déjà utilisé'
    );
  }

  const userPseudo =
    await userModel.findByPseudo(pseudo);

  if (userPseudo) {
    throw new Error(
      'Ce pseudo est déjà utilisé'
    );
  }

  const hashedPassword =
    await hashPassword(motDePasse);

  const user =
    await userModel.createUser(
      pseudo,
      email,
      hashedPassword,
      dateNaissance
    );

  return user;
}

async function login(email, motDePasse) {
  if (!email || !motDePasse) {
    throw new Error(
      'Email et mot de passe obligatoires'
    );
  }

  const user =
    await userModel.findByEmail(email);

  if (!user) {
    throw new Error(
      'Email ou mot de passe incorrect'
    );
  }

  if (user.statut !== 'actif') {
    throw new Error(
      'Ce compte n’est pas actif'
    );
  }

  const passwordIsValid =
    await comparePassword(
      motDePasse,
      user.motDePasse
    );

  if (!passwordIsValid) {
    throw new Error(
      'Email ou mot de passe incorrect'
    );
  }

  await userModel.updateLastLogin(
    user.idUser
  );

  const token = createToken(user);

  return {
    token,
    user: {
      idUser: user.idUser,
      pseudo: user.pseudo,
      email: user.email,
      role: user.role
    }
  };
}

module.exports = {
  register,
  login
};