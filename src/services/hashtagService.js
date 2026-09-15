const hashtagModel = require('../models/hashtagModel');
const { extractHashtags } = require('../utils/hashtagUtils');

/**
 * Analyse le contenu d'un post, extrait les hashtags et les enregistre
 * @param {object} db Instance SQLite
 * @param {number} idPubli
 * @param {string} contenuPub
 */
function traiterHashtagsPublication(db, idPubli, contenuPub) {
  if (!idPubli || typeof contenuPub !== 'string') {
    return;
  }

  const tags = extractHashtags(contenuPub);
  hashtagModel.associerHashtagsPubli(db, idPubli, tags);
}

/**
 * Récupère le classement des hashtags les plus populaires
 * @param {object} db Instance SQLite
 * @param {number} limit
 */
function obtenirTendances(db, limit = 10) {
  return hashtagModel.getTendances(db, limit);
}

/**
 * Récupère les publications associées à un hashtag spécifique
 * @param {object} db Instance SQLite
 * @param {string} tag
 */
function obtenirPublicationsParHashtag(db, tag) {
  const cleanTag = tag.replace(/^#/, '').trim();
  if (!cleanTag) return [];
  return hashtagModel.getPublicationsByHashtag(db, cleanTag);
}

/**
 * Recherche globale unifiée (profils, hashtags et publications)
 * @param {object} db Instance SQLite
 * @param {string} query Terme recherché
 */
function rechercherTout(db, query) {
  const q = (query || '').trim();
  if (!q) {
    return { utilisateurs: [], hashtags: [], publications: [] };
  }

  // 1. Si la recherche commence par '#', cibler en priorité les hashtags
  const isHashtagSearch = q.startsWith('#');
  const tagQuery = q.replace(/^#/, '');

  // Recherche des hashtags correspondants
  const hashtags = hashtagModel.searchHashtags(db, tagQuery, 10);

  // Recherche d'utilisateurs par pseudo ou nom/prénom
  const utilisateurs = isHashtagSearch
    ? []
    : db.prepare(`
        SELECT u.idUser, u.pseudo, pr.nom, pr.prenom, pr.idMedia AS idAvatar
        FROM Utilisateur u
        LEFT JOIN Profil pr ON u.idUser = pr.idUser
        WHERE u.pseudo LIKE ? OR pr.prenom LIKE ? OR pr.nom LIKE ?
        LIMIT 10
      `).all(`%${q}%`, `%${q}%`, `%${q}%`);

  // Recherche de publications (soit par le tag lié, soit par texte brut dans le contenu)
  let publications = [];
  if (isHashtagSearch) {
    publications = hashtagModel.getPublicationsByHashtag(db, tagQuery);
  } else {
    publications = db.prepare(`
      SELECT 
        p.idPubli,
        p.contenuPub,
        p.datePubli,
        u.idUser,
        u.pseudo,
        pr.idMedia AS idAvatar
      FROM Publication p
      JOIN Utilisateur u ON p.idUser = u.idUser
      LEFT JOIN Profil pr ON u.idUser = pr.idUser
      WHERE p.contenuPub LIKE ?
      ORDER BY p.datePubli DESC
      LIMIT 15
    `).all(`%${q}%`);
  }

  return {
    utilisateurs,
    hashtags,
    publications
  };
}

module.exports = {
  traiterHashtagsPublication,
  obtenirTendances,
  obtenirPublicationsParHashtag,
  rechercherTout
};