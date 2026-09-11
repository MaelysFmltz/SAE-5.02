const express = require('express');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
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

// Routes d'authentification
app.use('/api/auth', authRoutes);

module.exports = app;
