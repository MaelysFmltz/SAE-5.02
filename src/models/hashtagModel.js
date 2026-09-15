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
 * Supprime les anciennes liaisons de la publication avant de réinsérer.
 * @param {object} db Instance SQLite
 * @param {number} idPubli Identifiant de la publication
 * @param {string[]} tagNames Liste des hashtags (sans '#')
 */
function associerHashtagsPubli(db, idPubli, tagNames) {
  if (!idPubli || !Array.isArray(tagNames)) return;

  const transaction = db.transaction(() => {
    // Nettoyer d'éventuelles liaisons existantes pour cette publication
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
 * Récupère les hashtags les plus populaires classés par nombre de publications associées.
 * @param {object} db Instance SQLite
 * @param {number} limit Nombre maximum de hashtags renvoyés
 * @returns {Array<{ nom: string, nbPosts: number }>}
 */
function getTendances(db, limit = 10) {
  return db.prepare(`
    SELECT h.nom, COUNT(ph.idPubli) AS nbPosts
    FROM Hashtag h
    JOIN PubliHashtag ph ON h.idHashtag = ph.idHashtag
    GROUP BY h.idHashtag
    ORDER BY nbPosts DESC, h.nom ASC
    LIMIT ?
  `).all(limit);
}

/**
 * Récupère les publications associées à un hashtag donné (les plus récentes en premier).
 * @param {object} db Instance SQLite
 * @param {string} nom Nom du hashtag (sans '#')
 * @returns {Array} Liste des publications avec leur auteur
 */
function getPublicationsByHashtag(db, nom) {
  const cleanNom = nom.toLowerCase().trim();

  return db.prepare(`
    SELECT 
      p.idPubli,
      p.contenuPub,
      p.datePubli,
      u.idUser,
      u.pseudo,
      pr.idMedia AS idAvatar
    FROM Hashtag h
    JOIN PubliHashtag ph ON h.idHashtag = ph.idHashtag
    JOIN Publication p ON ph.idPubli = p.idPubli
    JOIN Utilisateur u ON p.idUser = u.idUser
    LEFT JOIN Profil pr ON u.idUser = pr.idUser
    WHERE h.nom = ?
    ORDER BY p.datePubli DESC
  `).all(cleanNom);
}

/**
 * Recherche des hashtags qui commencent par un préfixe (pour autocomplétion / barre de recherche).
 * @param {object} db Instance SQLite
 * @param {string} query Terme recherché
 * @param {number} limit
 * @returns {Array<{ nom: string, nbPosts: number }>}
 */
function searchHashtags(db, query, limit = 5) {
  const cleanQuery = query.toLowerCase().replace(/^#/, '').trim();

  return db.prepare(`
    SELECT h.nom, COUNT(ph.idPubli) AS nbPosts
    FROM Hashtag h
    LEFT JOIN PubliHashtag ph ON h.idHashtag = ph.idHashtag
    WHERE h.nom LIKE ?
    GROUP BY h.idHashtag
    ORDER BY nbPosts DESC
    LIMIT ?
  `).all(`${cleanQuery}%`, limit);
}

module.exports = {
  findOrCreateHashtag,
  associerHashtagsPubli,
  getTendances,
  getPublicationsByHashtag,
  searchHashtags
};