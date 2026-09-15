const profileModel = require('../models/profileModel');
const { validatePseudo, sanitizeText } = require('../utils/validationUtils');

/**
 * Formate un objet profil pour y adjoindre l'URL d'avatar
 */
function formatProfileData(profile) {
  if (!profile) return null;
  return {
    ...profile,
    avatarUrl: profile.idMedia ? `/media/${profile.idMedia}` : null
  };
}

/**
 * Récupère le profil personnel complet de l'utilisateur connecté
 */
async function getMyProfile(idUser) {
  if (!idUser) {
    throw new Error('Identifiant utilisateur manquant');
  }

  const profile = profileModel.getProfileByUserId(idUser);
  if (!profile) {
    throw new Error('Profil introuvable');
  }

  return formatProfileData(profile);
}

/**
 * Récupère le profil public d'un utilisateur à partir de son pseudo
 */
async function getPublicProfile(pseudo) {
  const cleanPseudo = validatePseudo(pseudo);

  const profile = profileModel.getProfileByPseudo(cleanPseudo);
  if (!profile) {
    throw new Error('Utilisateur introuvable');
  }

  return {
    idUser: profile.idUser,
    pseudo: profile.pseudo,
    role: profile.role, // Permet d'afficher la pastille modérateur/admin
    nom: profile.nom,
    prenom: profile.prenom,
    bio: profile.bio,
    idMedia: profile.idMedia,
    avatarUrl: profile.idMedia ? `/media/${profile.idMedia}` : null
  };
}

/**
 * Met à jour les informations du profil de l'utilisateur connecté
 */
async function updateMyProfile(idUser, data) {
  if (!idUser) {
    throw new Error('Action non autorisée');
  }

  // Sanitisation contre le XSS stocké et normalisation
  const cleanNom = data.nom ? sanitizeText(String(data.nom)) : null;
  const cleanPrenom = data.prenom ? sanitizeText(String(data.prenom)) : null;
  const cleanBio = data.bio ? sanitizeText(String(data.bio)) : null;

  const nom = cleanNom && cleanNom.length > 0 ? cleanNom : null;
  const prenom = cleanPrenom && cleanPrenom.length > 0 ? cleanPrenom : null;
  const bio = cleanBio && cleanBio.length > 0 ? cleanBio : null;

  if (nom && nom.length > 50) {
    throw new Error('Le nom ne peut pas dépasser 50 caractères');
  }

  if (prenom && prenom.length > 50) {
    throw new Error('Le prénom ne peut pas dépasser 50 caractères');
  }

  if (bio && bio.length > 300) {
    throw new Error('La bio ne peut pas dépasser 300 caractères');
  }

  profileModel.updateProfile(idUser, { nom, prenom, bio });

  const updatedProfile = profileModel.getProfileByUserId(idUser);
  return formatProfileData(updatedProfile);
}

module.exports = {
  getMyProfile,
  getPublicProfile,
  updateMyProfile
};