const express = require('express');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const commentRoutes = require('./routes/commentRoutes');

const app = express();

// Configuration du moteur de rendu EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middlewares pour lire le JSON et les formulaires HTML
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fichiers statiques (CSS, images)
app.use(express.static(path.join(__dirname, '../public')));

// Route racine de test
app.get('/', (req, res) => {
  res.json({
    message: 'API Pixora fonctionne'
  });
});

// Route d'insertion des données de test (Utilisateur 1 et Publication 1)
app.get('/check-schema', (req, res) => {
  const db = require('./config/database');
  try {
    // 1. Insertion de l'utilisateur de test (idUser = 1)
    db.prepare(`
      INSERT OR IGNORE INTO Utilisateur (idUser, pseudo, email, motDePasse)
      VALUES (1, 'demo_user', 'demo@pixora.fr', 'secret123')
    `).run();

    // 2. Insertion de la publication de test (idPubli = 1)
    db.prepare(`
      INSERT OR IGNORE INTO Publication (idPubli, idUser, contenuPub, visibilite)
      VALUES (1, 1, 'Publication de test pour les commentaires', 1)
    `).run();

    res.send('Données de test insérées avec succès ! Vous pouvez tester les commentaires.');
  } catch (err) {
    res.status(500).send('Erreur insertion : ' + err.message);
  }
});

// Déclaration des routes
app.use('/api/auth', authRoutes);
app.use('/api/comments', commentRoutes);

// L'export doit obligatoirement être tout à la fin
module.exports = app;