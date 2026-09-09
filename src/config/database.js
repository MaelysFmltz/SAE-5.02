import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Définition du chemin de stockage de la base SQLite
const dbDirPath = process.env.DB_DIR || path.resolve(__dirname, '../../data');
const dbFilePath = process.env.DB_PATH || path.join(dbDirPath, 'app.db');

// Création du dossier 'data' à la racine s'il n'existe pas encore
if (!fs.existsSync(dbDirPath)) {
  fs.mkdirSync(dbDirPath, { recursive: true });
}

// 2. Connexion à la base SQLite
const db = new Database(dbFilePath);

// 3. Configuration des pragmas critiques pour SQLite
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// 4. Initialisation du schéma si non présent
const sqlFilePath = path.resolve(__dirname, '../../database.sql');

if (fs.existsSync(sqlFilePath)) {
  const schema = fs.readFileSync(sqlFilePath, 'utf-8');
  db.exec(schema);
} else {
  // Stoppe l'application directement si le fichier SQL est introuvable
  throw new Error(`CRITIQUE: Fichier introuvable - ${sqlFilePath}`);
}

export default db;