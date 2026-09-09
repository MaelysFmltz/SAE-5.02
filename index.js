import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './src/config/database.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(express.static(path.resolve(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Serveur en écoute sur http://localhost:${PORT}`);
  console.log('Base de données initialisée et prête.');
});