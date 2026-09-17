const userModel = require('../models/userModel');
const { validatePseudo, validateEmail, validatePassword } = require('../utils/validationUtils');
const { hashPassword, comparePassword } = require('../utils/passwordUtils');

async function changePseudo(idUser, newPseudo) {
  const cleanPseudo = validatePseudo(newPseudo);

  const existing = userModel.findByPseudo(cleanPseudo);
  if (existing && existing.idUser !== idUser) {
    throw new Error('Ce pseudonyme est déjà utilisé.');
  }

  userModel.updatePseudo(idUser, cleanPseudo);
  return cleanPseudo;
}

async function changeEmail(idUser, newEmail) {
  const cleanEmail = validateEmail(newEmail);

  const existing = userModel.findByEmail(cleanEmail);
  if (existing && existing.idUser !== idUser) {
    throw new Error('Cette adresse email est déjà prise.');
  }

  userModel.updateEmail(idUser, cleanEmail);
  return cleanEmail;
}

async function changePassword(idUser, oldPassword, newPassword, confirmPassword) {
  if (!oldPassword || !newPassword || !confirmPassword) {
    throw new Error('Tous les champs de mot de passe sont requis.');
  }

  if (newPassword !== confirmPassword) {
    throw new Error('Le nouveau mot de passe et sa confirmation ne correspondent pas.');
  }

  const user = userModel.findById(idUser);
  if (!user) {
    throw new Error('Utilisateur introuvable.');
  }

  const isValid = await comparePassword(oldPassword, user.motDePasse);
  if (!isValid) {
    throw new Error('Le mot de passe actuel est incorrect.');
  }

  validatePassword(newPassword);
  const hashedPassword = await hashPassword(newPassword);
  userModel.updatePassword(idUser, hashedPassword);

  return true;
}

async function removeAccount(idUser, currentPassword) {
  if (!currentPassword) {
    throw new Error('Le mot de passe est requis pour supprimer le compte.');
  }

  const user = userModel.findById(idUser);
  if (!user) {
    throw new Error('Utilisateur introuvable.');
  }

  const isValid = await comparePassword(currentPassword, user.motDePasse);
  if (!isValid) {
    throw new Error('Mot de passe incorrect. Suppression refusée.');
  }

  userModel.deleteUser(idUser);
  return true;
}

module.exports = {
  changePseudo,
  changeEmail,
  changePassword,
  removeAccount
};