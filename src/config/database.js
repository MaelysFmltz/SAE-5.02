const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// 1. Chemin prioritaire pour les tests (:memory:), sinon database/database.db
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../database/database.db');

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

console.log(
  `Connexion à SQLite réussie (${dbPath === ':memory:' ? 'in-memory' : dbPath}).`
);

// 3. Initialisation du schéma si la base est neuve
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

// ============================================================
// MIGRATION COMMENTAIRES
// Ajout de idParent si la base existante ne possède pas encore
// cette colonne.
// ============================================================

const commentTableInfo = db
  .prepare("PRAGMA table_info(Commentaire)")
  .all();

const hasIdParent = commentTableInfo.some(
  column => column.name === 'idParent'
);

if (!hasIdParent) {
  db.exec(`
    ALTER TABLE Commentaire
    ADD COLUMN idParent INTEGER
  `);

  console.log(
    'Migration Commentaire : colonne idParent ajoutée.'
  );
}

// 4. Petites migrations à chaud pour les bases déjà existantes (créées avant
// l'ajout d'une colonne) : pas de système de migration dans ce projet, donc
// on complète le schéma au démarrage si besoin.
const conversationMembreExiste = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ConversationMembre'")
  .get();

if (conversationMembreExiste) {
  const colonnes = db.prepare('PRAGMA table_info(ConversationMembre)').all();
  const aEstCreateur = colonnes.some((col) => col.name === 'estCreateur');

  if (!aEstCreateur) {
    db.exec('ALTER TABLE ConversationMembre ADD COLUMN estCreateur INTEGER NOT NULL DEFAULT 0');
    console.log('Migration : colonne estCreateur ajoutée à ConversationMembre.');
  }
}

const messageExiste = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Message'")
  .get();

if (messageExiste) {
  const colonnesMessage = db.prepare('PRAGMA table_info(Message)').all();
  const noms = colonnesMessage.map((col) => col.name);

  if (!noms.includes('dateModification')) {
    db.exec('ALTER TABLE Message ADD COLUMN dateModification DATETIME');
    console.log('Migration : colonne dateModification ajoutée à Message.');
  }

  if (!noms.includes('supprime')) {
    db.exec('ALTER TABLE Message ADD COLUMN supprime INTEGER NOT NULL DEFAULT 0');
    console.log('Migration : colonne supprime ajoutée à Message.');
  }
}

module.exports = db;
