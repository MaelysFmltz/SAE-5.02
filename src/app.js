const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const authMiddleware = require('./middlewares/authMiddleware');
const postRoutes = require('./routes/postRoutes');

const app = express();

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// ==========================================
// FICHIERS STATIQUES
// ==========================================

app.use(
    '/uploads',
    express.static(
        path.join(__dirname, '../uploads')
    )
);


app.use(
    '/public',
    express.static(
        path.join(__dirname, 'public')
    )
);

// ==========================================
// EJS
// ==========================================

app.set('view engine', 'ejs');

app.set(
    'views',
    path.join(__dirname, '../views')
);

// ==========================================
// ROUTES
// ==========================================

app.use('/auth', authRoutes);

app.use('/post', postRoutes);


// ==========================================
// GESTION DES ERREURS
// ==========================================

app.get('/', (req, res) => {
    res.json({
        message: 'API Instagram fonctionne'
    });
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
