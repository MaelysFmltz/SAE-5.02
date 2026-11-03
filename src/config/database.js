const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// 1. Détermination du chemin (in-memory pour les tests ou fichier local)
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../database/database.db');

if (dbPath !== ':memory:') {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

// 2. Initialisation de l'instance SQLite
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

console.log(`Connexion à SQLite réussie (${dbPath === ':memory:' ? 'in-memory' : dbPath}).`);

// 3. Initialisation du schéma via dump.sql si la table principale est absente
const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Utilisateur'").get();

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

// 4. Migrations dynamiques (ajouts de colonnes sans casser les bases existantes)

// Migration Publication : activation/désactivation des commentaires par publication.
const publicationExiste = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Publication'").get();
if (publicationExiste) {
  const colonnesPublication = db.prepare('PRAGMA table_info(Publication)').all();
  if (!colonnesPublication.some(column => column.name === 'commentairesActifs')) {
    db.exec('ALTER TABLE Publication ADD COLUMN commentairesActifs INTEGER NOT NULL DEFAULT 1 CHECK(commentairesActifs IN (0, 1))');
    console.log('Migration Publication : colonne commentairesActifs ajoutée (commentaires activés par défaut).');
  }
}

const commentTableInfo = db.prepare("PRAGMA table_info(Commentaire)").all();
const hasIdParent = commentTableInfo.some(column => column.name === 'idParent');
if (!hasIdParent) {
  db.exec('ALTER TABLE Commentaire ADD COLUMN idParent INTEGER');
  console.log('Migration Commentaire : colonne idParent ajoutée.');
}

const conversationMembreExiste = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ConversationMembre'").get();
if (conversationMembreExiste) {
  const colonnes = db.prepare('PRAGMA table_info(ConversationMembre)').all();
  const aEstCreateur = colonnes.some(col => col.name === 'estCreateur');
  if (!aEstCreateur) {
    db.exec('ALTER TABLE ConversationMembre ADD COLUMN estCreateur INTEGER NOT NULL DEFAULT 0');
    console.log('Migration : colonne estCreateur ajoutée à ConversationMembre.');
  }
}

const messageExiste = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Message'").get();
if (messageExiste) {
  const colonnesMessage = db.prepare('PRAGMA table_info(Message)').all();
  const noms = colonnesMessage.map(col => col.name);

  if (!noms.includes('dateModification')) {
    db.exec('ALTER TABLE Message ADD COLUMN dateModification DATETIME');
    console.log('Migration : colonne dateModification ajoutée à Message.');
  }

  if (!noms.includes('supprime')) {
    db.exec('ALTER TABLE Message ADD COLUMN supprime INTEGER NOT NULL DEFAULT 0');
    console.log('Migration : colonne supprime ajoutée à Message.');
  }
}

// 4 bis. Migrations Notifications (idActeur + marque-page de lecture par membre)
const notificationExiste = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Notification'").get();
if (notificationExiste) {
  const colonnesNotif = db.prepare('PRAGMA table_info(Notification)').all();
  if (!colonnesNotif.some(col => col.name === 'idActeur')) {
    db.exec('ALTER TABLE Notification ADD COLUMN idActeur INTEGER REFERENCES Utilisateur(idUser) ON DELETE CASCADE');
    console.log('Migration : colonne idActeur ajoutée à Notification.');
  }
}

if (conversationMembreExiste) {
  const colonnesMembre = db.prepare('PRAGMA table_info(ConversationMembre)').all();
  if (!colonnesMembre.some(col => col.name === 'idDernierMessageLu')) {
    db.transaction(() => {
      db.exec('ALTER TABLE ConversationMembre ADD COLUMN idDernierMessageLu INTEGER NOT NULL DEFAULT 0');
      // Les messages déjà présents avant la migration sont considérés comme lus,
      // sinon toutes les anciennes conversations apparaîtraient d'un coup comme non lues.
      db.exec(`
        UPDATE ConversationMembre
        SET idDernierMessageLu = COALESCE(
          (SELECT MAX(m.idMessage) FROM Message m WHERE m.idConversation = ConversationMembre.idConversation), 0)
      `);
    })();
    console.log('Migration : colonne idDernierMessageLu ajoutée à ConversationMembre.');
  }
}

// 5. Migration Signalement (support du type 'message' et de la réponse modérateur)
const signalementExiste = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='Signalement'").get();
if (signalementExiste) {
  // Vérification de la contrainte CHECK sur 'message'
  if (!signalementExiste.sql.includes("'message'")) {
    db.transaction(() => {
      db.prepare(`
        CREATE TABLE Signalement_new (
          idSignalement INTEGER PRIMARY KEY AUTOINCREMENT,
          idUserAuteur INTEGER NOT NULL,
          typeContenu TEXT CHECK(typeContenu IN ('publication', 'commentaire', 'utilisateur', 'media', 'message')) NOT NULL,
          idContenu INTEGER NOT NULL,
          motif TEXT NOT NULL,
          dateSignalement DATETIME DEFAULT CURRENT_TIMESTAMP,
          statut TEXT CHECK(statut IN ('en_attente', 'traite', 'rejete')) DEFAULT 'en_attente',
          reponseModeration TEXT,
          FOREIGN KEY (idUserAuteur) REFERENCES Utilisateur(idUser) ON DELETE CASCADE
        )
      `).run();

      const colonnes = db.prepare('PRAGMA table_info(Signalement)').all().map(c => c.name);
      const hasReponse = colonnes.includes('reponseModeration');

      if (hasReponse) {
        db.prepare(`
          INSERT INTO Signalement_new (idSignalement, idUserAuteur, typeContenu, idContenu, motif, dateSignalement, statut, reponseModeration)
          SELECT idSignalement, idUserAuteur, typeContenu, idContenu, motif, dateSignalement, statut, reponseModeration
          FROM Signalement
        `).run();
      } else {
        db.prepare(`
          INSERT INTO Signalement_new (idSignalement, idUserAuteur, typeContenu, idContenu, motif, dateSignalement, statut)
          SELECT idSignalement, idUserAuteur, typeContenu, idContenu, motif, dateSignalement, statut
          FROM Signalement
        `).run();
      }

      db.prepare('DROP TABLE Signalement').run();
      db.prepare('ALTER TABLE Signalement_new RENAME TO Signalement').run();
    })();
    console.log("Migration Signalement : contrainte CHECK mise à jour avec le type 'message'.");
  } else {
    // Si la table gère déjà 'message', on s'assure que reponseModeration existe
    const colonnes = db.prepare('PRAGMA table_info(Signalement)').all();
    if (!colonnes.some(c => c.name === 'reponseModeration')) {
      db.exec('ALTER TABLE Signalement ADD COLUMN reponseModeration TEXT');
      console.log('Migration Signalement : colonne reponseModeration ajoutée.');
    }
  }
}

module.exports = db;