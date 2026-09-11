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

// Déclaration des routes
app.use('/api/auth', authRoutes);
app.use('/api/comments', commentRoutes);

// L'export doit obligatoirement être tout à la fin
module.exports = app;