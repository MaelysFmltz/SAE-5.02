const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(
  __dirname,
  '../../database/database.db'
);

let db;

try {
  db = new Database(dbPath);

  console.log('Connexion à SQLite réussie.');
} catch (err) {
  console.error(
    'Erreur de connexion à SQLite :',
    err.message
  );

  process.exit(1);
}

module.exports = db;