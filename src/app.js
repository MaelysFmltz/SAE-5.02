const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const authMiddleware = require('./middlewares/authMiddleware');
const profileRoutes = require('./routes/profileRoutes');
const postRoutes = require('./routes/postRoutes');

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


app.use('/auth', authRoutes);
app.use('/post', postRoutes);

// ==========================================
// FICHIERS STATIQUES
// ==========================================

app.use(
    '/uploads',
    express.static(
        path.join(__dirname, '../uploads')
    )
);

app.set('view engine', 'ejs');

app.set(
    'views',
    path.join(__dirname, '../views')
);

app.get('/', (req, res) => {
    res.json({
        message: 'API Instagram fonctionne'
    });
});



module.exports = app;