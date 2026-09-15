const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/authRoutes');
const commentRoutes = require('./routes/commentRoutes');

const app = express();

// Configuration du moteur de rendu EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Indispensable pour lire le cookie de connexion

// Fichiers statiques (CSS, images)
app.use(express.static(path.join(__dirname, '../public')));

// Page d'accueil : affiche directement la page de connexion
app.get('/', (req, res) => {
  res.render('login');
});

app.get('/login', (req, res) => {
  res.render('login');
});

// ROUTE /home (Fil d'actualité après login)
app.get('/home', (req, res) => {
  const token = req.cookies.token;

  if (!token) {
    return res.redirect('/login');
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET || 'pixora_secret_key');
    // On envoie 'user' pour que views/feed.ejs puisse afficher "Bonjour, <%= user.pseudo %>"
    res.render('feed', { user });
  } catch (err) {
    res.clearCookie('token');
    return res.redirect('/login');
  }
});

// Déclaration des routes API
app.use('/api/auth', authRoutes);
app.use('/api/comments', commentRoutes);

// L'export doit obligatoirement être tout à la fin
module.exports = app;