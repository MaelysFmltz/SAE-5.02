const userModel = require('../models/userModel');

const {
  hashPassword,
  comparePassword
} = require('../utils/passwordUtils');

const {
  createToken
} = require('../utils/tokenUtils');

const {
  validatePseudo,
  validateEmail,
  validatePassword,
  validateBirthDate
} = require('../utils/validationUtils');

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

  const validPseudo =
    validatePseudo(pseudo);

  const validEmail =
    validateEmail(email);

  const validPassword =
    validatePassword(motDePasse);

  const validBirthDate =
    validateBirthDate(dateNaissance);

  const userEmail =
    await userModel.findByEmail(validEmail);

  if (userEmail) {
    throw new Error(
      'Cet email est déjà utilisé'
    );
  }

  const userPseudo =
    await userModel.findByPseudo(validPseudo);

  if (userPseudo) {
    throw new Error(
      'Ce pseudo est déjà utilisé'
    );
  }

  const hashedPassword =
    await hashPassword(validPassword);

  return userModel.createUser(
    validPseudo,
    validEmail,
    hashedPassword,
    validBirthDate
  );
}

async function login(email, motDePasse) {
  if (!email || !motDePasse) {
    throw new Error(
      'Email et mot de passe obligatoires'
    );
  }

  const validEmail =
    validateEmail(email);

  // À la connexion, on ne vérifie pas les règles de création :
  // l'ancien mot de passe doit simplement rester inchangé.
  if (
    typeof motDePasse !== 'string' ||
    motDePasse.length > 128
  ) {
    throw new Error(
      'Email ou mot de passe incorrect'
    );
  }

  const user =
    await userModel.findByEmail(validEmail);

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