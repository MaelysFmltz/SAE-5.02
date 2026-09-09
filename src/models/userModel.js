const db = require('../config/database');

function findByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM Utilisateur WHERE email = ?',
      [email],
      (err, user) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(user);
      }
    );
  });
}

function findByPseudo(pseudo) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM Utilisateur WHERE pseudo = ?',
      [pseudo],
      (err, user) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(user);
      }
    );
  });
}

function findById(idUser) {
  return new Promise((resolve, reject) => {
    db.get(
      `
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
      WHERE idUser = ?
      `,
      [idUser],
      (err, user) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(user);
      }
    );
  });
}

function createUser(
  pseudo,
  email,
  motDePasse,
  dateNaissance
) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO Utilisateur
      (
        pseudo,
        email,
        motDePasse,
        dateNaissance
      )
      VALUES (?, ?, ?, ?)
    `;

    db.run(
      sql,
      [
        pseudo,
        email,
        motDePasse,
        dateNaissance || null
      ],
      function (err) {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          idUser: this.lastID,
          pseudo,
          email,
          dateNaissance
        });
      }
    );
  });
}

function updateLastLogin(idUser) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      UPDATE Utilisateur
      SET dateDerniereConnexion = CURRENT_TIMESTAMP
      WHERE idUser = ?
      `,
      [idUser],
      function (err) {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      }
    );
  });
}

module.exports = {
  findByEmail,
  findByPseudo,
  findById,
  createUser,
  updateLastLogin
};