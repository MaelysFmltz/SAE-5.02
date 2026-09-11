const db = require('../config/database');

function findByEmail(email) {
  return db
    .prepare('SELECT * FROM Utilisateur WHERE email = ?')
    .get(email);
}

function findByPseudo(pseudo) {
  return db
    .prepare('SELECT * FROM Utilisateur WHERE pseudo = ?')
    .get(pseudo);
}

function findById(idUser) {
  return db
    .prepare('SELECT * FROM Utilisateur WHERE idUser = ?')
    .get(idUser);
}

function createUser(
  pseudo,
  email,
  motDePasse,
  dateNaissance
) {
  const stmt = db.prepare(`
    INSERT INTO Utilisateur
    (pseudo, email, motDePasse, dateNaissance)
    VALUES (?, ?, ?, ?)
  `);

  const result = stmt.run(
    pseudo,
    email,
    motDePasse,
    dateNaissance || null
  );

  return {
    idUser: result.lastInsertRowid,
    pseudo,
    email,
    dateNaissance
  };
}

function updateLastLogin(idUser) {
  return db
    .prepare(`
      UPDATE Utilisateur
      SET dateDerniereConnexion = CURRENT_TIMESTAMP
      WHERE idUser = ?
    `)
    .run(idUser);
}

function modifierStatut(db, idUser, statut) {
    return db.prepare(`
        UPDATE Utilisateur
        SET statut = ?
        WHERE idUser = ?
    `).run(statut, idUser);
}

function obtenirUtilisateurs(db) {
    return db.prepare(`
        SELECT
            idUser,
            pseudo,
            email,
            dateInscription,
            dateNaissance,
            statut,
            role,
            dateDerniereConnexion
        FROM Utilisateur
        ORDER BY idUser
    `).all();
}

module.exports = {
  findByEmail,
  findByPseudo,
  findById,
  createUser,
  updateLastLogin,
  modifierStatut,
  obtenirUtilisateurs
};