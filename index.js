import express from 'express';

import db from './src/config/database.js'; 

const app = express();
const PORT = process.env.PORT || 3000;


app.get('/', (req, res) => {
  res.send('API Node.js lancée et Base de données connectée');
});

app.listen(PORT, () => {
  console.log(`Serveur en écoute sur http://localhost:${PORT}`);
  console.log('Base de données initialisée et prête.');
});