const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const authMiddleware = require('./middlewares/authMiddleware');
const postRoutes = require('./routes/postRoutes');

const app = express();

// ===============================
// EJS
// ===============================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// ===============================
// Middlewares
// ===============================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Fichiers CSS / JS dans /public
app.use(express.static(path.join(__dirname, '../public')));

// ===============================
// Pages
// ===============================
app.get('/', (req, res) => {
    res.render('login');
});

app.get('/home', authMiddleware, (req, res) => {
    res.render('feed', { user: req.user });
});

// ===============================
// API / Routes
// ===============================
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/post', postRoutes);

// ===============================
// Images uploadées
// ===============================
app.use(
    '/uploads',
    express.static(path.join(__dirname, '../uploads'))
);

module.exports = app;