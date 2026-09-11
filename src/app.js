const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const authMiddleware = require('./middlewares/authMiddleware');
const postRoutes = require('./routes/postRoutes');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, '../public')));

// Page de connexion
app.get('/', (req, res) => {
    res.render('login');
});

// Page accessible uniquement après authentification
app.get('/home', authMiddleware, (req, res) => {
    res.render('feed', {
        user: req.user
    });
});

// Authentification
app.use('/api/auth', authRoutes);

// Publication
app.use('/post', authMiddleware, postRoutes);

module.exports = app;
