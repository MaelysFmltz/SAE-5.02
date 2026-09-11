const express = require('express');
const reportRoutes = require('./routes/reportRoutes');

const authRoutes = require('./routes/authRoutes');

const app = express();

// Permet de recevoir du JSON
app.use(express.json());
app.use('/api/signalements', reportRoutes);

// Route de test
app.get('/', (req, res) => {
  res.json({
    message: 'API Instagram fonctionne'
  });
});

// Routes d'authentification
app.use('/api/auth', authRoutes);

module.exports = app;