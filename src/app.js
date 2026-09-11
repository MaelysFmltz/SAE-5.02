const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const friendshipRoutes = require('./routes/friendshipRoutes');
const authMiddleware = require('./middlewares/authMiddleware');

const app = express();

// 1. Moteur de templates EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// 2. Middlewares globaux
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Pour décoder les formulaires HTML
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public'))); // Fichiers CSS / JS

// 3. Routes d'affichage des pages (Front)
app.get('/', (req, res) => {
  res.render('login');
});

app.get('/home', authMiddleware, (req, res) => {
  res.render('feed', { user: req.user });
});

// 4. Routes API (Back)
app.use('/api/auth', authRoutes);
app.use('/api/friendships', friendshipRoutes);

module.exports = app;