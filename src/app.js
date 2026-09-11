const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const authMiddleware = require('./middlewares/authMiddleware');
const profileRoutes = require('./routes/profileRoutes');
const profileService = require('./services/profileService');

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

app.get('/home', authMiddleware, (req, res) => {
  res.render('feed', { user: req.user });
});

// Affichage page de profil
app.get('/profile', authMiddleware, async (req, res) => {
  try {
    const profile = await profileService.getMyProfile(req.user.idUser);
    res.render('profile', { profile, isOwner: true });
  } catch (err) {
    res.redirect('/home');
  }
});
// Affichage du formulaire de modification
app.get('/profile/edit', authMiddleware, async (req, res) => {
  try {
    const profile = await profileService.getMyProfile(req.user.idUser);
    res.render('editProfile', { profile });
  } catch (err) {
    res.redirect('/profile');
  }
});


app.post('/profile/edit', authMiddleware, async (req, res) => {
  try {
    const { prenom, nom, bio } = req.body;
    await profileService.updateMyProfile(req.user.idUser, { prenom, nom, bio });
    res.redirect('/profile');
  } catch (err) {
    const profile = await profileService.getMyProfile(req.user.idUser);
    res.render('editProfile', { 
      profile: { ...profile, ...req.body }, 
      error: err.message 
    });
  }
});

// 4. Routes API (Back)
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);

module.exports = app;