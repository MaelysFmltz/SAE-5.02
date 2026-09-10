const express = require('express');

const authRoutes = require('./routes/authRoutes');
const publicationRoutes = require('./routes/publicationRoutes');

const app = express();

// Permet de recevoir du JSON
app.use(express.json());

// Route de test
app.get('/', (req, res) => {
  res.json({
    message: 'API Instagram fonctionne'
  });
});

// Routes d'authentification
app.use('/api/auth', authRoutes);

// Routes de publications
app.use('/api/publications', publicationRoutes);

module.exports = app;