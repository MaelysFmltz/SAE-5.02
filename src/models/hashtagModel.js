/**
 * Échappe les méta-caractères LIKE (% et _) pour éviter les fuites ou scans involontaires
 * @param {string} str 
 * @returns {string}
 */
function escapeLike(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Récupère un hashtag par son nom ou l'insère s'il n'existe pas encore.
 * @param {object} db Instance SQLite
 * @param {string} nom Nom normalisé du hashtag (sans '#')
 * @returns {number} idHashtag
 */
function findOrCreateHashtag(db, nom) {
  const cleanNom = nom.toLowerCase().trim();

  const existing = db.prepare(`
    SELECT idHashtag FROM Hashtag WHERE nom = ?
  `).get(cleanNom);

  if (existing) {
    return existing.idHashtag;
  }

  const result = db.prepare(`
    INSERT INTO Hashtag (nom) VALUES (?)
  `).run(cleanNom);

  return result.lastInsertRowid;
}

/**
 * Associe une liste de noms de hashtags à une publication.
 * @param {object} db Instance SQLite
 * @param {number} idPubli Identifiant de la publication
 * @param {string[]} tagNames Liste des hashtags (sans '#')
 */
function associerHashtagsPubli(db, idPubli, tagNames) {
  if (!idPubli || !Array.isArray(tagNames)) return;

  const transaction = db.transaction(() => {
    db.prepare(`
      DELETE FROM PubliHashtag WHERE idPubli = ?
    `).run(idPubli);

    const insertLiaison = db.prepare(`
      INSERT OR IGNORE INTO PubliHashtag (idPubli, idHashtag)
      VALUES (?, ?)
    `);

    for (const name of tagNames) {
      const idHashtag = findOrCreateHashtag(db, name);
      insertLiaison.run(idPubli, idHashtag);
    }
  });

  transaction();
}

/**
 * Récupère les hashtags les plus populaires basés UNIQUEMENT sur les publications publiques.
 * Les publications en visibilité privée/amis et les messages n'y figurent pas.
 * @param {object} db Instance SQLite
 * @param {number} limit
 * @returns {Array<{ nom: string, nbPosts: number }>}
 */
function getTendances(db, limit = 10) {
  return db.prepare(`
    SELECT h.nom, COUNT(p.idPubli) AS nbPosts
    FROM Hashtag h
    JOIN PubliHashtag ph ON h.idHashtag = ph.idHashtag
    JOIN Publication p ON ph.idPubli = p.idPubli
    WHERE p.visibilite = 1
    GROUP BY h.idHashtag
    HAVING nbPosts > 0
    ORDER BY nbPosts DESC, h.nom ASC
    LIMIT ?
  `).all(limit);
}

/**
 * Récupère les publications associées à un hashtag en respectant scrupuleusement la visibilité :
 * - Publication publique (visibilite = 1)
 * - OU auteur est l'utilisateur connecté
 * - OU publication 'amis uniquement' ET l'utilisateur connecté est un ami réciproque de l'auteur
 * @param {object} db Instance SQLite
 * @param {string} nom Nom du hashtag (sans '#')
 * @param {number} idCurrentUser ID de l'utilisateur effectuant la requête
 * @returns {Array} Liste des publications filtrées
 */
function getPublicationsByHashtag(db, nom, idCurrentUser) {
  const cleanNom = nom.toLowerCase().trim();

  return db.prepare(`
    SELECT DISTINCT
      p.idPubli,
      p.contenuPub,
      p.datePubli,
      p.visibilite,
      u.idUser,
      u.pseudo,
      pr.idMedia AS idAvatar,
      m.nomMedia
    FROM Hashtag h
    JOIN PubliHashtag ph ON h.idHashtag = ph.idHashtag
    JOIN Publication p ON ph.idPubli = p.idPubli
    JOIN Utilisateur u ON p.idUser = u.idUser
    LEFT JOIN Profil pr ON u.idUser = pr.idUser
    LEFT JOIN Media m ON m.idPubli = p.idPubli
    WHERE h.nom = ?
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
  `).all(cleanNom, idCurrentUser, idCurrentUser);
}

/**
 * Recherche des hashtags par préfixe sur les publications publiques uniquement.
 * @param {object} db Instance SQLite
 * @param {string} query Terme recherché
 * @param {number} limit
 * @returns {Array<{ nom: string, nbPosts: number }>}
 */
function searchHashtags(db, query, limit = 5) {
  const cleanQuery = escapeLike(query.toLowerCase().replace(/^#/, '').trim());
  if (!cleanQuery) return [];

  return db.prepare(`
    SELECT h.nom, COUNT(p.idPubli) AS nbPosts
    FROM Hashtag h
    JOIN PubliHashtag ph ON h.idHashtag = ph.idHashtag
    JOIN Publication p ON ph.idPubli = p.idPubli
    WHERE p.visibilite = 1
      AND h.nom LIKE (? || '%') ESCAPE '\\'
    GROUP BY h.idHashtag
    HAVING nbPosts > 0
    ORDER BY nbPosts DESC
    LIMIT ?
  `).all(cleanQuery, limit);
}

module.exports = {
  findOrCreateHashtag,
  associerHashtagsPubli,
  getTendances,
  getPublicationsByHashtag,
  searchHashtags,
  escapeLike
};