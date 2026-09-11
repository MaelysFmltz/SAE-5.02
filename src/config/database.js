const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// 1. Chemin vers le dossier data et le fichier app.db
// (surchargeable par DB_PATH, utilisé par les tests avec ':memory:')
const dbDirPath = path.resolve(__dirname, '../../data');
const dbFilePath = process.env.DB_PATH || path.join(dbDirPath, 'app.db');

if (dbFilePath !== ':memory:' && !fs.existsSync(dbDirPath)) {
  fs.mkdirSync(dbDirPath, { recursive: true });
}

// 2. Ouverture de la base
const db = new Database(dbFilePath);
db.pragma('foreign_keys = ON');

console.log('Connexion à SQLite réussie.');

// 3. Vérification de l'existence de la table Utilisateur
const tableExists = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Utilisateur'")
  .get();

// 4. Si la table n'existe pas, on applique dump.sql
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