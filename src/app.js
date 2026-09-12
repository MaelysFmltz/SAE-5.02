const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const publicationRoutes = require('./routes/publicationRoutes');
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const authMiddleware = require('./middlewares/authMiddleware');

const app = express();

// 1. Moteur de templates EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// 2. Middlewares globaux
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// 3. Routes API
app.use('/api/auth', authRoutes);
app.use('/api/publications', postRoutes);
app.use('/api/publications', publicationRoutes);

// 4. Routes d'affichage des pages (Front)
app.get('/', (req, res) => {
  res.render('login');
});

app.get('/home', authMiddleware, (req, res) => {
  const postService = require('./services/postService');

  try {
    const publications = postService.getFeedForUser(req.user.idUser);

    res.render('feed', {
      user: req.user,
      publications
    });
  } catch (error) {
    res.status(500).send('Erreur lors du chargement du fil d’actualité');
  }
});

module.exports = app;