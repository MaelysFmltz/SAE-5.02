const path = require('path');

const PSEUDO_REGEX = /^[a-zA-ZÀ-ÿ0-9_-]{3,30}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;


/*
 * ============================================================
 * UTILISATEUR
 * ============================================================
 */

function sanitizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '');
}


function validatePseudo(pseudo) {
  const cleanPseudo = sanitizeText(pseudo);

  if (!PSEUDO_REGEX.test(cleanPseudo)) {
    throw new Error(
      'Le pseudo doit contenir entre 3 et 30 caractères : lettres, chiffres, tirets ou underscores'
    );
  }

  return cleanPseudo;
}


function validateEmail(email) {
  const cleanEmail = sanitizeText(email).toLowerCase();

  if (
    cleanEmail.length > 254 ||
    !EMAIL_REGEX.test(cleanEmail)
  ) {
    throw new Error(
      'Le format de l’adresse email est incorrect'
    );
  }

  return cleanEmail;
}


function validatePassword(motDePasse) {
  if (typeof motDePasse !== 'string') {
    throw new Error(
      'Le mot de passe doit être une chaîne de caractères'
    );
  }

  if (motDePasse.length < 8 || motDePasse.length > 128) {
    throw new Error(
      'Le mot de passe doit contenir entre 8 et 128 caractères'
    );
  }

  if (!/[a-z]/.test(motDePasse)) {
    throw new Error(
      'Le mot de passe doit contenir une lettre minuscule'
    );
  }

  if (!/[A-Z]/.test(motDePasse)) {
    throw new Error(
      'Le mot de passe doit contenir une lettre majuscule'
    );
  }

  if (!/[0-9]/.test(motDePasse)) {
    throw new Error(
      'Le mot de passe doit contenir un chiffre'
    );
  }

  if (!/[^a-zA-Z0-9]/.test(motDePasse)) {
    throw new Error(
      'Le mot de passe doit contenir un caractère spécial'
    );
  }

  // Le mot de passe ne doit pas être trim() ou modifié.
  return motDePasse;
}


function validateBirthDate(dateNaissance) {
  if (
    dateNaissance === undefined ||
    dateNaissance === null ||
    dateNaissance === ''
  ) {
    return null;
  }

  if (
    typeof dateNaissance !== 'string' ||
    !DATE_REGEX.test(dateNaissance)
  ) {
    throw new Error(
      'La date de naissance doit être au format AAAA-MM-JJ'
    );
  }

  const [year, month, day] =
    dateNaissance.split('-').map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  const isValidDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isValidDate) {
    throw new Error(
      'La date de naissance est invalide'
    );
  }

  const today = new Date();

  if (date > today) {
    throw new Error(
      'La date de naissance ne peut pas être dans le futur'
    );
  }

  return dateNaissance;
}


/*
 * ============================================================
 * PUBLICATION
 * ============================================================
 */

const MAX_PUBLICATION_LENGTH = 5000;

function validatePublicationContent(contenuPub) {
  if (
    contenuPub === undefined ||
    contenuPub === null ||
    contenuPub === ''
  ) {
    return null;
  }

  if (typeof contenuPub !== 'string') {
    throw new Error(
      'Le contenu de la publication doit être une chaîne de caractères'
    );
  }

  const cleanContent = sanitizeText(contenuPub);

  if (cleanContent.length > MAX_PUBLICATION_LENGTH) {
    throw new Error(
      `Le contenu de la publication ne peut pas dépasser ${MAX_PUBLICATION_LENGTH} caractères`
    );
  }

  return cleanContent;
}


/*
 * ============================================================
 * VIDÉOS
 * ============================================================
 */

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

const ALLOWED_VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.avi',
  '.webm'
]);

const ALLOWED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm'
]);


function validateVideoExtension(filename) {
  if (
    typeof filename !== 'string' ||
    filename.length === 0
  ) {
    throw new Error(
      'Nom de fichier vidéo invalide'
    );
  }

  const extension = path.extname(filename).toLowerCase();

  if (!ALLOWED_VIDEO_EXTENSIONS.has(extension)) {
    throw new Error(
      'Format vidéo non autorisé. Formats acceptés : MP4, MOV, AVI et WebM'
    );
  }

  return extension;
}


function validateVideoMimeType(mimetype) {
  if (
    typeof mimetype !== 'string' ||
    !ALLOWED_VIDEO_MIME_TYPES.has(mimetype.toLowerCase())
  ) {
    throw new Error(
      'Type MIME vidéo non autorisé'
    );
  }

  return mimetype.toLowerCase();
}


function validateVideoSize(size) {
  if (
    typeof size !== 'number' ||
    !Number.isSafeInteger(size) ||
    size <= 0
  ) {
    throw new Error(
      'Taille de vidéo invalide'
    );
  }

  if (size > MAX_VIDEO_SIZE) {
    throw new Error(
      'La vidéo ne peut pas dépasser 50 Mo'
    );
  }

  return size;
}


function validateVideoFile(file) {
  if (!file || typeof file !== 'object') {
    throw new Error(
      'Aucune vidéo valide n’a été fournie'
    );
  }

  validateVideoExtension(file.originalname);
  validateVideoMimeType(file.mimetype);
  validateVideoSize(file.size);

  return true;
}


module.exports = {
  sanitizeText,

  validatePseudo,
  validateEmail,
  validatePassword,
  validateBirthDate,

  validatePublicationContent,

  validateVideoExtension,
  validateVideoMimeType,
  validateVideoSize,
  validateVideoFile,

  MAX_PUBLICATION_LENGTH,
  MAX_VIDEO_SIZE,
  ALLOWED_VIDEO_EXTENSIONS,
  ALLOWED_VIDEO_MIME_TYPES
};

