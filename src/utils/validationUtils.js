const PSEUDO_REGEX = /^[a-zA-ZÀ-ÿ0-9_-]{3,30}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

module.exports = {
  sanitizeText,
  validatePseudo,
  validateEmail,
  validatePassword,
  validateBirthDate
};