const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH;

let db;

if (dbPath === ':memory:') {
  db = new Database(':memory:');
} else {
  const dbDirPath = path.resolve(__dirname, '../../database');
  const dbFilePath =
    dbPath || path.join(dbDirPath, 'database.db');

  if (!fs.existsSync(dbDirPath)) {
    fs.mkdirSync(dbDirPath, { recursive: true });
  }

  db = new Database(dbFilePath);

  const tableExists = db
    .prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      AND name = 'Utilisateur'
    `)
    .get();

  if (!tableExists) {
    const dumpPath =
      path.resolve(__dirname, '../../database/dump.sql');

    if (!fs.existsSync(dumpPath)) {
      throw new Error(
        'Erreur : fichier database/dump.sql introuvable'
      );
    }

    const schema =
      fs.readFileSync(dumpPath, 'utf-8');

    db.exec(schema);

    console.log(
      'Tables créées avec succès via dump.sql.'
    );
  }
}

db.pragma('foreign_keys = ON');

console.log('Connexion à SQLite réussie.');

module.exports = db;