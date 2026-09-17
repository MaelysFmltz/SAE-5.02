const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// Imports des routes et services
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const publicationRoutes = require('./routes/publicationRoutes');
const commentRoutes = require('./routes/commentRoutes');
const friendshipRoutes = require('./routes/friendshipRoutes');
const profileRoutes = require('./routes/profileRoutes');
const commentController = require('./controllers/commentController');
const authMiddleware = require('./middlewares/authMiddleware');
const searchRoutes = require('./routes/searchRoutes');
const profileService = require('./services/profileService');
const friendshipModel = require('./models/friendshipModel');
const postService = require('./services/postService');
const db = require('./config/database');

const app = express();

// 1. Moteur de templates EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// 2. Middlewares globaux
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// 3. Routes d'affichage des pages (Front)

app.get('/', (req, res) => {
  res.render('login');
});

// Fil d'actualité
app.get('/login', (req, res) => {
  res.render('login');
});

// ROUTE /home (Fil d'actualité avec suggestions)
app.get('/home', authMiddleware, (req, res) => {
  try {
    const publications = postService.getFeedForUser(req.user.idUser);

    const suggestions = db.prepare(`
      SELECT u.idUser, u.pseudo, u.role, p.bio
      FROM Utilisateur u
      LEFT JOIN Profil p ON u.idUser = p.idUser
      WHERE u.idUser != ?
      LIMIT 10
    `).all(req.user.idUser);

    res.render('feed', {
      user: req.user,
      publications,
      suggestions
    });
  } catch (err) {
    console.error('Erreur GET /home :', err);

    res.render('feed', {
      user: req.user,
      publications: [],
      suggestions: []
    });
  }
});

// Affichage de son propre profil
app.get('/profile', authMiddleware, async (req, res) => {
  try {
    const profile = await profileService.getMyProfile(req.user.idUser);

    const stats = {
      nbAbonnes: friendshipModel.listerAbonnes(db, req.user.idUser).length,
      nbAbonnements: friendshipModel.listerAbonnements(db, req.user.idUser).length,
      nbAmis: friendshipModel.listerAmis(db, req.user.idUser).length
    };

    res.render('profile', {
      profile,
      isOwner: true,
      estAbonne: false,
      sontAmis: false,
      stats
    });
  } catch (err) {
    console.error('Erreur GET /profile :', err);
    res.status(500).send('Erreur lors du chargement de votre profil.');
  }
});

app.get('/publication/create', authMiddleware, (req, res) => {
    res.render('publication-create');
});

app.get('/publication/:idPubli', authMiddleware, commentController.renderPostPage);

// Modification de profil
app.get('/profile/edit', authMiddleware, async (req, res) => {
  try {
    const profile = await profileService.getMyProfile(req.user.idUser);
    res.render('editProfile', { profile });
  } catch (err) {
    console.error('Erreur GET /profile/edit :', err);
    res.redirect('/profile');
  }
});

app.post('/profile/edit', authMiddleware, async (req, res) => {
  try {
    const { prenom, nom, bio } = req.body;

    await profileService.updateMyProfile(
      req.user.idUser,
      { prenom, nom, bio }
    );

    res.redirect('/profile');
  } catch (err) {
    console.error('Erreur POST /profile/edit :', err);

    const profile = await profileService.getMyProfile(req.user.idUser);

    res.render('editProfile', {
      profile: { ...profile, ...req.body },
      error: err.message
    });
  }
});

// Affichage du profil public d'un autre utilisateur
app.get('/profile/:pseudo', authMiddleware, async (req, res) => {
  try {
    const targetProfile = await profileService.getPublicProfile(
      req.params.pseudo
    );

    const isOwner = req.user.idUser === targetProfile.idUser;

    let estAbonne = false;
    let sontAmis = false;

    if (!isOwner) {
      const dejaAbonne = db.prepare(`
        SELECT 1
        FROM Abonnement
        WHERE idUserAbonne = ?
        AND idUserSuivi = ?
      `).get(
        req.user.idUser,
        targetProfile.idUser
      );

      estAbonne = !!dejaAbonne;

      sontAmis = friendshipModel.sontAmis(
        db,
        req.user.idUser,
        targetProfile.idUser
      );
    }

    const stats = {
      nbAbonnes: friendshipModel.listerAbonnes(
        db,
        targetProfile.idUser
      ).length,

      nbAbonnements: friendshipModel.listerAbonnements(
        db,
        targetProfile.idUser
      ).length,

      nbAmis: friendshipModel.listerAmis(
        db,
        targetProfile.idUser
      ).length
    };

    res.render('profile', {
      profile: targetProfile,
      isOwner,
      estAbonne,
      sontAmis,
      stats
    });
  } catch (err) {
    console.error(
      `Erreur GET /profile/${req.params.pseudo} :`,
      err.message
    );

    res.redirect('/home');
  }
});

// Page et API de recherche & hashtags
app.use('/search', searchRoutes);

// 4. Routes API (Back)

app.use('/api/auth', authRoutes);
app.use('/api/publications', postRoutes);
app.use('/api/publications', publicationRoutes);
app.use('/api/friendships', friendshipRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/comments', commentRoutes);

module.exports = app;