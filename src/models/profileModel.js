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
      p.idMedia
    FROM Utilisateur u
    LEFT JOIN Profil p ON u.idUser = p.idUser
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
      p.idMedia
    FROM Utilisateur u
    LEFT JOIN Profil p ON u.idUser = p.idUser
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

module.exports = {
  createProfile,
  getProfileByUserId,
  getProfileByPseudo,
  updateProfile
};