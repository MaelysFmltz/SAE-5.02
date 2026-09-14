const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH;

let db;

if (dbPath === ':memory:') {
  db = new Database(':memory:');
} else {
  const dbDirPath = path.resolve(__dirname, '../../data');
  const dbFilePath = dbPath || path.join(dbDirPath, 'app.db');

  if (!fs.existsSync(dbDirPath)) {
    fs.mkdirSync(dbDirPath, { recursive: true });
  }

  db = new Database(dbFilePath);
}

db.pragma('foreign_keys = ON');

console.log('Connexion à SQLite réussie.');

const tableExists = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='Utilisateur'"
  )
  .get();

if (!tableExists) {
  const dumpPath = path.resolve(__dirname, '../../database/dump.sql');

  if (fs.existsSync(dumpPath)) {
    const schema = fs.readFileSync(dumpPath, 'utf-8');
    db.exec(schema);
    console.log('Tables créées avec succès via dump.sql.');
  } else {
    console.error(
      'Erreur : fichier database/dump.sql introuvable à',
      dumpPath
    );
  }
}

module.exports = db;