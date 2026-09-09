const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(
  __dirname,
  '../../../../../database.db'
);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(
      'Erreur de connexion à SQLite :',
      err.message
    );
  } else {
    console.log('Connexion à SQLite réussie.');
  }
});

module.exports = db;