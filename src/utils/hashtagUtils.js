const HASHTAG_REGEX = /#([a-zA-Z0-9_\u00C0-\u017F]{1,30})/g;

/**
 * Échappe le HTML pour le corps de texte sans briser les apostrophes
 * @param {string} str 
 * @returns {string}
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Extrait les hashtags uniques d'un texte (minuscules, sans '#')
 * @param {string} text 
 * @returns {string[]}
 */
function extractHashtags(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return [];
  }

  const matches = text.matchAll(HASHTAG_REGEX);
  const tags = new Set();

  for (const match of matches) {
    const cleanTag = match[1].toLowerCase();
    if (cleanTag.length >= 1 && cleanTag.length <= 30) {
      tags.add(cleanTag);
    }
  }

  return Array.from(tags);
}

/**
 * Échappe d'abord le HTML (<, >, &), puis transforme les vrais #tags en liens cliquables
 * @param {string} text 
 * @returns {string} HTML sécurisé
 */
function linkifyHashtags(text) {
  if (typeof text !== 'string') return '';
  
  const safeText = escapeHtml(text);
  return safeText.replace(HASHTAG_REGEX, (fullMatch, tagName) => {
    const cleanTag = tagName.toLowerCase();
    return `<a href="/search?q=%23${encodeURIComponent(cleanTag)}" class="hashtag-link">#${tagName}</a>`;
  });
}

module.exports = {
  escapeHtml,
  extractHashtags,
  linkifyHashtags
};