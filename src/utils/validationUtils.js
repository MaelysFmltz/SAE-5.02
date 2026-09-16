/**
 * @file validationUtils.js
 * @description Utilitaires d'assainissement et de validation des données d'authentification et de profil.
 * @module utils/validationUtils
 */

/**
 * Expression régulière pour la validation des pseudonymes : 3 à 30 caractères (lettres, chiffres, tirets, underscores).
 * @constant {RegExp}
 */
const PSEUDO_REGEX = /^[a-z0-9_-]{3,30}$/;

/**
 * Expression régulière pour le format strict de date AAAA-MM-JJ.
 * @constant {RegExp}
 */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Expression régulière pour l'adresse email conforme RFC :
 * - Partie locale ne commençant/finissant pas par un point et sans points consécutifs.
 * - Domaine valide se terminant par un TLD d'au moins 2 lettres.
 * @constant {RegExp}
 */
const EMAIL_REGEX = /^[a-zA-Z0-9_%+-]+(?:\.[a-zA-Z0-9_%+-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

/**
 * Nettoie une chaîne de caractères en retirant les balises HTML et les caractères de contrôle non imprimables.
 *
 * @param {unknown} value - Valeur brute reçue.
 * @returns {string} Chaîne nettoyée et tronquée des espaces superflus.
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

/**
 * Valide et normalise un pseudonyme utilisateur.
 *
 * @param {unknown} pseudo - Pseudonyme à contrôler.
 * @returns {string} Pseudonyme assaini et converti en minuscules.
 * @throws {Error} Si le pseudo ne respecte pas les critères de longueur ou de composition.
 */
function validatePseudo(pseudo) {
  const cleanPseudo = sanitizeText(pseudo).toLowerCase();

  if (!PSEUDO_REGEX.test(cleanPseudo)) {
    throw new Error(
      'Le pseudo doit contenir entre 3 et 30 caractères : lettres, chiffres, tirets ou underscores'
    );
  }

  return cleanPseudo;
}

/**
 * Valide et normalise une adresse email.
 * Vérifie l'absence de point terminal avant l'@, la longueur RFC (max 254 chars) et la structure du domaine.
 *
 * @param {unknown} email - Adresse email à contrôler.
 * @returns {string} Adresse email assainie en minuscules.
 * @throws {Error} Si l'adresse est invalide ou malformée.
 */
function validateEmail(email) {
  const cleanEmail = sanitizeText(email).toLowerCase();

  if (!cleanEmail || cleanEmail.length > 254) {
    throw new Error('Le format de l’adresse email est incorrect');
  }

  const [localPart] = cleanEmail.split('@');
  if (!localPart || localPart.length > 64) {
    throw new Error('Le format de l’adresse email est incorrect');
  }

  if (!EMAIL_REGEX.test(cleanEmail)) {
    throw new Error('Le format de l’adresse email est incorrect');
  }

  return cleanEmail;
}

/**
 * Valide la robustesse d'un mot de passe utilisateur.
 * Exige au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.
 *
 * @param {unknown} motDePasse - Mot de passe en clair.
 * @returns {string} Mot de passe non altéré.
 * @throws {Error} Si l'un des critères de complexité n'est pas satisfait.
 */
function validatePassword(motDePasse) {
  if (typeof motDePasse !== 'string') {
    throw new Error('Le mot de passe doit être une chaîne de caractères');
  }

  if (motDePasse.length < 8 || motDePasse.length > 128) {
    throw new Error('Le mot de passe doit contenir entre 8 et 128 caractères');
  }

  if (!/[a-z]/.test(motDePasse)) {
    throw new Error('Le mot de passe doit contenir une lettre minuscule');
  }

  if (!/[A-Z]/.test(motDePasse)) {
    throw new Error('Le mot de passe doit contenir une lettre majuscule');
  }

  if (!/[0-9]/.test(motDePasse)) {
    throw new Error('Le mot de passe doit contenir un chiffre');
  }

  if (!/[^a-zA-Z0-9]/.test(motDePasse)) {
    throw new Error('Le mot de passe doit contenir un caractère spécial');
  }

  return motDePasse;
}

/**
 * Valide la cohérence chronologique et l'âge d'une date de naissance (format AAAA-MM-JJ).
 * Rejette les dates futures, les âges inférieurs à 13 ans et les âges supérieurs à 120 ans.
 *
 * @param {unknown} dateNaissance - Date sous forme de chaîne AAAA-MM-JJ ou valeur vide.
 * @returns {string|null} Date validée ou null si optionnelle et non renseignée.
 * @throws {Error} Si le format, le calendrier ou l'âge est incohérent.
 */
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
    throw new Error('La date de naissance doit être au format AAAA-MM-JJ');
  }

  const [year, month, day] = dateNaissance.split('-').map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  const isValidDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isValidDate) {
    throw new Error('La date de naissance est invalide');
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const currentDay = now.getUTCDate();

  // Calcul d'âge précis en années révolues
  let age = currentYear - year;
  const monthDiff = currentMonth - (month - 1);
  if (monthDiff < 0 || (monthDiff === 0 && currentDay < day)) {
    age--;
  }

  if (date > now) {
    throw new Error('La date de naissance ne peut pas être dans le futur');
  }

  if (age < 13) {
    throw new Error('Vous devez avoir au moins 13 ans pour vous inscrire');
  }

  if (age > 120) {
    throw new Error('La date de naissance est invalide');
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