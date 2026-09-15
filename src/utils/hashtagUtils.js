// Regex : un # suivi de 1-30 lettres/chiffres
const HASHTAG_REGEX = /#([a-zA-Z0-9_\u00C0-\u017F]{1,30})/g;

/**
 * Extrait la liste des hashtags uniques d'un texte, normalisés en minuscules et sans le '#'
 * @param {string} text 
 * @returns {string[]} Tableau des noms de hashtags (ex: ['paris', 'photo'])
 */
function extractHashtags(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return [];
  }

  const matches = text.matchAll(HASHTAG_REGEX);
  const tags = new Set();

  for (const match of matches) {
    const cleanTag = match[1].toLowerCase();
    // Limite de sécurité : entre 1 et 30 caractères
    if (cleanTag.length >= 1 && cleanTag.length <= 30) {
      tags.add(cleanTag);
    }
  }

  return Array.from(tags);
}

/**
 * Remplace les #tag dans un texte sécurisé par un lien hypertexte cliquable vers /search?q=%23tag
 * @param {string} escapedText Texte préalablement échappé contre le XSS
 * @returns {string} Texte HTML avec liens cliquables
 */
function linkifyHashtags(escapedText) {
  if (typeof escapedText !== 'string') {
    return '';
  }

  return escapedText.replace(HASHTAG_REGEX, (fullMatch, tagName) => {
    const cleanTag = tagName.toLowerCase();
    return `<a href="/search?q=%23${encodeURIComponent(cleanTag)}" class="hashtag-link">#${tagName}</a>`;
  });
}

module.exports = {
  extractHashtags,
  linkifyHashtags
};