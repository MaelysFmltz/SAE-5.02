const db = require('../config/database');

/**
 * Crée une entrée profil vide pour un utilisateur nouvellement inscrit
 */
function createProfile(idUser) {
  const query = `
    INSERT INTO Profil (idUser, nom, prenom, bio, idMedia)
    VALUES (?, NULL, NULL, NULL, NULL)
  `;
  const info = db.prepare(query).run(idUser);
  return info.lastInsertRowid;
}

/**
 * Récupère le profil complet d'un utilisateur par son ID (pour son propre profil)
 */
function getProfileByUserId(idUser) {
  const query = `
    SELECT
      u.idUser,
      u.pseudo,
      u.email,
      u.role,
      u.statut,
      p.idProfil,
      p.nom,
      p.prenom,
      p.bio,
      p.idMedia,
      m.nomMedia AS avatarNomMedia
    FROM Utilisateur u
    LEFT JOIN Profil p ON u.idUser = p.idUser
    LEFT JOIN Media m ON m.idMedia = p.idMedia
    WHERE u.idUser = ?
  `;
  return db.prepare(query).get(idUser);
}

/**
 * Récupère le profil public d'un utilisateur par son pseudo (pour consultation externe)
 */
function getProfileByPseudo(pseudo) {
  const query = `
    SELECT
      u.idUser,
      u.pseudo,
      u.role,
      p.idProfil,
      p.nom,
      p.prenom,
      p.bio,
      p.idMedia,
      m.nomMedia AS avatarNomMedia
    FROM Utilisateur u
    LEFT JOIN Profil p ON u.idUser = p.idUser
    LEFT JOIN Media m ON m.idMedia = p.idMedia
    WHERE u.pseudo = ?
  `;
  return db.prepare(query).get(pseudo);
}

/**
 * Met à jour les données textuelles du profil (ou l'insère s'il n'existait pas)
 */
function updateProfile(idUser, { nom, prenom, bio }) {
  const query = `
    INSERT INTO Profil (idUser, nom, prenom, bio)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(idUser) DO UPDATE SET
      nom = excluded.nom,
      prenom = excluded.prenom,
      bio = excluded.bio
  `;
  return db.prepare(query).run(idUser, nom, prenom, bio);
}

/**
 * Récupère le média actuellement utilisé comme photo de profil
 * d'un utilisateur, s'il en a une.
 */
function getAvatarMedia(idUser) {
  return db.prepare(`
    SELECT m.idMedia, m.nomMedia
    FROM Profil p
    JOIN Media m ON m.idMedia = p.idMedia
    WHERE p.idUser = ?
  `).get(idUser);
}

/**
 * Enregistre un nouveau média (idPubli NULL, réservé à l'avatar)
 * et le définit comme photo de profil de l'utilisateur, en une
 * seule transaction. Crée la ligne Profil si elle n'existait pas
 * encore.
 */
function setAvatar(idUser, nomMedia, typeMedia) {
  const transaction = db.transaction(() => {
    const media = db.prepare(`
      INSERT INTO Media (idPubli, nomMedia, typeMedia)
      VALUES (NULL, ?, ?)
    `).run(nomMedia, typeMedia);

    db.prepare(`
      INSERT INTO Profil (idUser, idMedia)
      VALUES (?, ?)
      ON CONFLICT(idUser) DO UPDATE SET
        idMedia = excluded.idMedia
    `).run(idUser, media.lastInsertRowid);
  });

  transaction();
}

module.exports = {
  createProfile,
  getProfileByUserId,
  getProfileByPseudo,
  updateProfile,
  getAvatarMedia,
  setAvatar
};