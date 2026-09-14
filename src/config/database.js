const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '../../database/database.db');

const dumpPath = path.join(
  __dirname,
  '../../database/dump.sql'
);

let db;

try {
  db = new Database(dbPath);

  const table = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
    AND name = 'Utilisateur'
  `).get();

  if (!table) {
    if (!fs.existsSync(dumpPath)) {
      throw new Error(`Fichier SQL introuvable : ${dumpPath}`);
    }

    const schema = fs.readFileSync(dumpPath, 'utf8');

    db.exec(schema);

    console.log('Base SQLite initialisée avec dump.sql.');
  }

  db.pragma('foreign_keys = ON');

  console.log('Connexion à SQLite réussie.');
} catch (err) {
  console.error(
    'Erreur de connexion à SQLite :',
    err.message
  );

  process.exit(1);
}

module.exports = db;