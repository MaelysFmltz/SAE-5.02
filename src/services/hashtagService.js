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
 * Récupère le classement des hashtags les plus populaires (publications publiques uniquement)
 * @param {object} db Instance SQLite
 * @param {number} limit
 */
function obtenirTendances(db, limit = 10) {
  return hashtagModel.getTendances(db, limit);
}

/**
 * Récupère les publications associées à un hashtag en filtrant selon la visibilité et les amis
 * @param {object} db Instance SQLite
 * @param {string} tag
 * @param {number} idCurrentUser
 */
function obtenirPublicationsParHashtag(db, tag, idCurrentUser) {
  const cleanTag = tag.replace(/^#/, '').trim();
  if (!cleanTag) return [];
  return hashtagModel.getPublicationsByHashtag(db, cleanTag, idCurrentUser);
}

/**
 * Recherche globale unifiée (profils, hashtags et publications) avec respect strict de la confidentialité
 * @param {object} db Instance SQLite
 * @param {string} query Terme recherché
 * @param {number} idCurrentUser Identifiant de l'utilisateur demandeur
 */
function rechercherTout(db, query, idCurrentUser) {
  const q = (query || '').trim();
  if (!q) {
    return { utilisateurs: [], hashtags: [], publications: [] };
  }

  const isHashtagSearch = q.startsWith('#');
  const tagQuery = q.replace(/^#/, '');

  // 1. Recherche de hashtags (publics uniquement)
  const hashtags = hashtagModel.searchHashtags(db, tagQuery, 10);

  // 2. Recherche d'utilisateurs (avec échappement LIKE)
  let utilisateurs = [];
  if (!isHashtagSearch) {
    const escapedUserQuery = hashtagModel.escapeLike(q);
    utilisateurs = db.prepare(`
      SELECT u.idUser, u.pseudo, pr.nom, pr.prenom, pr.idMedia AS idAvatar
      FROM Utilisateur u
      LEFT JOIN Profil pr ON u.idUser = pr.idUser
      WHERE (u.pseudo LIKE (? || '%') ESCAPE '\\'
         OR pr.prenom LIKE (? || '%') ESCAPE '\\'
         OR pr.nom LIKE (? || '%') ESCAPE '\\')
        AND u.statut = 'actif'
      LIMIT 10
    `).all(escapedUserQuery, escapedUserQuery, escapedUserQuery);
  }

  // 3. Recherche de publications avec contrôle d'accès
  let publications = [];
  if (isHashtagSearch) {
    publications = hashtagModel.getPublicationsByHashtag(db, tagQuery, idCurrentUser);
  } else {
    const escapedPostQuery = hashtagModel.escapeLike(q);
    publications = db.prepare(`
      SELECT DISTINCT
        p.idPubli,
        p.contenuPub,
        p.datePubli,
        p.visibilite,
        u.idUser,
        u.pseudo,
        pr.idMedia AS idAvatar,
        m.nomMedia
      FROM Publication p
      JOIN Utilisateur u ON p.idUser = u.idUser
      LEFT JOIN Profil pr ON u.idUser = pr.idUser
      LEFT JOIN Media m ON m.idPubli = p.idPubli
      WHERE p.contenuPub LIKE ('%' || ? || '%') ESCAPE '\\'
        AND (
          p.visibilite = 1
          OR p.idUser = ?
          OR EXISTS (
            SELECT 1
            FROM Abonnement a1
            JOIN Abonnement a2 
              ON a1.idUserAbonne = a2.idUserSuivi 
              AND a1.idUserSuivi = a2.idUserAbonne
            WHERE a1.idUserAbonne = ? 
              AND a1.idUserSuivi = p.idUser
          )
        )
      ORDER BY p.datePubli DESC
      LIMIT 15
    `).all(escapedPostQuery, idCurrentUser, idCurrentUser);
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