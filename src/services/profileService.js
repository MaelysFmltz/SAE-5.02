const profileModel = require('../models/profileModel');
const { validatePseudo, sanitizeText } = require('../utils/validationUtils');
const postModel = require('../models/postModel');
const reactionModel = require('../models/reactionModel');
const postService = require('./postService');

/**
 * Formate un objet profil pour y adjoindre l'URL d'avatar
 */
function formatProfileData(profile) {
  if (!profile) return null;
  return {
    ...profile,
    avatarUrl: profile.avatarNomMedia ? `/uploads/${profile.avatarNomMedia}` : null
  };
}

/**
 * Récupère les publications d'un utilisateur, avec réactions,
 * réparties en publications originales / reposts-duos-collages,
 * en ne gardant que celles visibles par idUserVisiteur (un
 * propriétaire voit tout, un visiteur uniquement le public,
 * ses propres publications et celles de ses amis).
 */
function getVisiblePublicationsForProfile(idUser, idUserVisiteur) {
  const isOwner = Number(idUser) === Number(idUserVisiteur);

  const allPosts = postModel.findByUserId(idUser);

  const visiblePosts = isOwner
    ? allPosts
    : postService.filtrerPublicationsVisibles(allPosts, idUserVisiteur);

  /*
   * Un repost/Duo/collage peut rester visible alors que sa publication
   * d'origine, elle, ne l'est plus pour idUserVisiteur (post redevenu
   * privé, amitié rompue...) : sans ce masquage, son média/contenu
   * original resterait exposé via la carte du repost/Duo/collage.
   */
  const maskedPosts = postService.masquerOriginauxInvisibles(
    visiblePosts,
    idUserVisiteur
  );

  const idsDejaRepostes = idUserVisiteur
    ? postModel.findRepostedPubliIds(idUserVisiteur)
    : new Set();

  const withReactions = maskedPosts.map(publication => {
    const reactions = reactionModel.getPostReactions(
      publication.idPubli,
      idUserVisiteur
    );

    return {
      ...publication,
      likes: reactions.likes,
      dislikes: reactions.dislikes,
      userReaction: reactions.userReaction,
      dejaReposte: idsDejaRepostes.has(publication.idPubli)
    };
  });

  return {
    publications: withReactions.filter(
      publication => publication.typePublication === 'original'
    ),
    reposts: withReactions.filter(publication =>
      ['repost', 'duo', 'collage'].includes(publication.typePublication)
    )
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

  const { publications, reposts } =
    getVisiblePublicationsForProfile(idUser, idUser);

  return {
    ...formatProfileData(profile),
    publications,
    reposts
  };
}

/**
 * Récupère le profil public d'un utilisateur à partir de son pseudo
 */
async function getPublicProfile(pseudo, idUserVisiteur = null) {
  const cleanPseudo = validatePseudo(pseudo);

  const profile = profileModel.getProfileByPseudo(cleanPseudo);
  if (!profile) {
    throw new Error('Utilisateur introuvable');
  }

  const { publications, reposts } =
    getVisiblePublicationsForProfile(profile.idUser, idUserVisiteur);

  return {
    idUser: profile.idUser,
    pseudo: profile.pseudo,
    role: profile.role, // Permet d'afficher la pastille modérateur/admin
    nom: profile.nom,
    prenom: profile.prenom,
    bio: profile.bio,
    idMedia: profile.idMedia,
    avatarUrl: profile.avatarNomMedia ? `/uploads/${profile.avatarNomMedia}` : null,
    publications,
    reposts
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

/**
 * Définit (ou remplace) la photo de profil de l'utilisateur.
 * Retourne le nom du fichier précédent (à supprimer sur le
 * disque par l'appelant), ou null s'il n'y en avait pas.
 */
async function updateAvatar(idUser, nomMedia, typeMedia) {
  if (!idUser) {
    throw new Error('Action non autorisée');
  }

  const ancienAvatar = profileModel.getAvatarMedia(idUser);

  profileModel.setAvatar(idUser, nomMedia, typeMedia);

  return ancienAvatar ? ancienAvatar.nomMedia : null;
}

module.exports = {
  getMyProfile,
  getPublicProfile,
  updateMyProfile,
  updateAvatar
};