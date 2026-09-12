const db = require('../config/database');
const userModel = require('../models/userModel');
const profileModel = require('../models/profileModel');

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

// Transaction atomique : si la création du profil échoue, l'utilisateur n'est pas créé
const executeRegisterTransaction = db.transaction((pseudo, email, hashedPassword, birthDate) => {
  const newUser = userModel.createUser(pseudo, email, hashedPassword, birthDate);
  const newUserId = newUser?.lastInsertRowid || newUser?.idUser || newUser;
  profileModel.createProfile(newUserId);
  return newUser;
});

async function register(
  pseudo,
  email,
  motDePasse,
  dateNaissance
) {
  if (!pseudo || !email || !motDePasse) {
    throw new Error('Pseudo, email et mot de passe obligatoires');
  }

  const validPseudo = validatePseudo(pseudo);
  const validEmail = validateEmail(email);
  const validPassword = validatePassword(motDePasse);
  const validBirthDate = validateBirthDate(dateNaissance);

  const userEmail = await userModel.findByEmail(validEmail);
  if (userEmail) {
    throw new Error('Cet email est déjà utilisé');
  }

  const userPseudo = await userModel.findByPseudo(validPseudo);
  if (userPseudo) {
    throw new Error('Ce pseudo est déjà utilisé');
  }

  const hashedPassword = await hashPassword(validPassword);

  return executeRegisterTransaction(
    validPseudo,
    validEmail,
    hashedPassword,
    validBirthDate
  );
}

async function login(email, motDePasse) {
  if (!email || !motDePasse) {
    throw new Error('Email et mot de passe obligatoires');
  }

  const validEmail = validateEmail(email);

  if (
    typeof motDePasse !== 'string' ||
    motDePasse.length > 128
  ) {
    throw new Error('Email ou mot de passe incorrect');
  }

  const user = await userModel.findByEmail(validEmail);

  if (!user) {
    throw new Error('Email ou mot de passe incorrect');
  }

  // 1. Vérification du mot de passe en premier pour éviter l'oracle de statut
  const passwordIsValid = await comparePassword(
    motDePasse,
    user.motDePasse
  );

  if (!passwordIsValid) {
    throw new Error('Email ou mot de passe incorrect');
  }

  // 2. Vérification du statut après confirmation du mot de passe
  if (user.statut !== 'actif') {
    throw new Error('Ce compte n’est pas actif');
  }

  await userModel.updateLastLogin(user.idUser);

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