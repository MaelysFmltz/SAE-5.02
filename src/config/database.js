/**
 * @file database.js
 * @description Configuration, initialisation et connexion à la base de données SQLite via `better-sqlite3`.
 * Gère le mode persistant sur disque, le mode en mémoire pour les tests unitaires (`:memory:`),
 * l'activation des contraintes d'intégrité référentielle et l'exécution du schéma initial.
 * @module config/database
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * Chemin absolu vers le fichier de base de données SQLite.
 * Défini prioritairement par la variable d'environnement `DB_PATH` (utilisée pour `:memory:` lors des tests),
 * sinon pointe par défaut vers `database/database.db`.
 * @constant {string}
 */
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../database/database.db');

// Création du répertoire parent si la base est persistée sur le disque
if (dbPath !== ':memory:') {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

/**
 * Instance active de la base de données SQLite.
 * Les clés étrangères (`foreign_keys`) sont activées systématiquement à l'ouverture.
 * @type {import('better-sqlite3').Database}
 */
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

console.log(`Connexion à SQLite réussie (${dbPath === ':memory:' ? 'in-memory' : dbPath}).`);

// Vérification de la présence de la table pivot Utilisateur pour détecter une base vierge
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

/**
 * Exporte l'instance connectée de `better-sqlite3` prête pour les requêtes synchrones.
 * @exports db
 */
module.exports = db;