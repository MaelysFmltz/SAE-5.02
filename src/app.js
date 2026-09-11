const express = require('express');
const path = require('path');
const reportRoutes = require('./routes/reportRoutes');
const postRoutes = require('./routes/postRoutes');
const adminRoutes = require('./routes/adminRoutes');

const authRoutes = require('./routes/authRoutes');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Permet de recevoir du JSON
app.use(express.json());
app.use('/api/signalements', reportRoutes);
app.use('/api/publications', postRoutes);
app.use('/api/admin', adminRoutes);

// Route de test
app.get('/', (req, res) => {
  res.json({
    message: 'API Instagram fonctionne'
  });
});

// Routes d'authentification
app.use('/api/auth', authRoutes);

module.exports = app;