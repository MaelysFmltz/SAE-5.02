const defaultDb = require('../config/database');

/**
 * Résout l'instance de base de données à utiliser (passée en paramètre ou par défaut).
 */
function resolveDb(db) {
  return (db && typeof db.prepare === 'function') ? db : defaultDb;
}

function findByEmail(email, db = defaultDb) {
  return resolveDb(db)
    .prepare('SELECT * FROM Utilisateur WHERE email = ?')
    .get(email);
}

function findByPseudo(pseudo, db = defaultDb) {
  return resolveDb(db)
    .prepare('SELECT * FROM Utilisateur WHERE pseudo = ?')
    .get(pseudo);
}

/**
 * Supporte à la fois findById(idUser) et findById(db, idUser).
 */
function findById(param1, param2) {
  let database = defaultDb;
  let idUser = param1;

  if (param2 !== undefined) {
    database = resolveDb(param1);
    idUser = param2;
  }

  return database
    .prepare('SELECT * FROM Utilisateur WHERE idUser = ?')
    .get(idUser);
}

function createUser(
  pseudo,
  email,
  motDePasse,
  dateNaissance,
  db = defaultDb
) {
  const stmt = resolveDb(db).prepare(`
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

function updateLastLogin(idUser, db = defaultDb) {
  return resolveDb(db)
    .prepare(`
      UPDATE Utilisateur
      SET dateDerniereConnexion = CURRENT_TIMESTAMP
      WHERE idUser = ?
    `)
    .run(idUser);
}

function updatePseudo(idUser, pseudo, db = defaultDb) {
  return resolveDb(db)
    .prepare('UPDATE Utilisateur SET pseudo = ? WHERE idUser = ?')
    .run(pseudo, idUser);
}

function updateEmail(idUser, email, db = defaultDb) {
  return resolveDb(db)
    .prepare('UPDATE Utilisateur SET email = ? WHERE idUser = ?')
    .run(email, idUser);
}

function updatePassword(idUser, motDePasse, db = defaultDb) {
  return resolveDb(db)
    .prepare('UPDATE Utilisateur SET motDePasse = ? WHERE idUser = ?')
    .run(motDePasse, idUser);
}

function updateRole(idUser, role, db = defaultDb) {
  return resolveDb(db)
    .prepare('UPDATE Utilisateur SET role = ? WHERE idUser = ?')
    .run(role, idUser);
}

function deleteUser(idUser, db = defaultDb) {
  return resolveDb(db)
    .prepare('DELETE FROM Utilisateur WHERE idUser = ?')
    .run(idUser);
}

function modifierStatut(param1, param2, param3) {
  let database = defaultDb;
  let idUser = param1;
  let statut = param2;

  if (param3 !== undefined) {
    database = resolveDb(param1);
    idUser = param2;
    statut = param3;
  }

  return database.prepare(`
    UPDATE Utilisateur
    SET statut = ?
    WHERE idUser = ?
  `).run(statut, idUser);
}

function obtenirUtilisateurs(db = defaultDb) {
  return resolveDb(db).prepare(`
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

function searchUsers(query, db = defaultDb) {
  const searchTerm = `%${query}%`;
  return resolveDb(db).prepare(`
    SELECT idUser, pseudo, email, role, statut, dateInscription
    FROM Utilisateur
    WHERE pseudo LIKE ? OR email LIKE ?
    LIMIT 20
  `).all(searchTerm, searchTerm);
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
  updateRole,
  deleteUser,
  modifierStatut,
  obtenirUtilisateurs,
  searchUsers
};