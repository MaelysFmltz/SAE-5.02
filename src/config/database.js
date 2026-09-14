const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// 1. Chemin prioritaire pour les tests (:memory:), sinon data/app.db
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../data/app.db');

// Si ce n'est pas une base en mémoire, s'assurer que le dossier parent existe
if (dbPath !== ':memory:') {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

// 2. Ouverture de la base
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

console.log(`Connexion à SQLite réussie (${dbPath === ':memory:' ? 'in-memory' : dbPath}).`);

// 3. Initialisation du schéma si la base est neuve
const tableExists = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Utilisateur'")
  .get();

if (!tableExists) {
  const dumpPath = path.resolve(__dirname, '../../database/dump.sql');
  if (fs.existsSync(dumpPath)) {
    const schema = fs.readFileSync(dumpPath, 'utf-8');
    db.exec(schema);
    console.log('Tables créées avec succès via dump.sql.');
  } else {
    console.error('Erreur : fichier database/dump.sql introuvable à', dumpPath);
  }
}

module.exports = db;