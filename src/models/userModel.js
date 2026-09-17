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

function updatePseudo(idUser, pseudo) {
  return db
    .prepare('UPDATE Utilisateur SET pseudo = ? WHERE idUser = ?')
    .run(pseudo, idUser);
}

function updateEmail(idUser, email) {
  return db
    .prepare('UPDATE Utilisateur SET email = ? WHERE idUser = ?')
    .run(email, idUser);
}

function updatePassword(idUser, hashedPassword) {
  return db
    .prepare('UPDATE Utilisateur SET motDePasse = ? WHERE idUser = ?')
    .run(hashedPassword, idUser);
}

function deleteUser(idUser) {
  return db
    .prepare('DELETE FROM Utilisateur WHERE idUser = ?')
    .run(idUser);
}

function searchUsers(query) {
  const searchTerm = `%${query}%`;
  return db
    .prepare(`
      SELECT idUser, pseudo, email, role, dateInscription
      FROM Utilisateur
      WHERE pseudo LIKE ? OR email LIKE ?
      LIMIT 20
    `)
    .all(searchTerm, searchTerm);
}

function updateRole(idUser, role) {
  return db
    .prepare('UPDATE Utilisateur SET role = ? WHERE idUser = ?')
    .run(role, idUser);
}

module.exports = {
  findByEmail,
  findByPseudo,
  findById,
  createUser,
  updateLastLogin,
  updatePseudo,
  updateEmail,
  updatePassword,
  deleteUser,
  searchUsers,
  updateRole
};