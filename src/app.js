require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const friendshipRoutes = require('./routes/friendshipRoutes');
const authMiddleware = require('./middlewares/authMiddleware');
const profileRoutes = require('./routes/profileRoutes');
const profileService = require('./services/profileService');
const friendshipModel = require('./models/friendshipModel');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const conversationService = require('./services/conversationService');
const messageService = require('./services/messageService');
const db = require('./config/database');

const postRoutes = require('./routes/postRoutes');
const postService = require('./services/postService');
const publicationRoutes = require('./routes/publicationRoutes');

const app = express();


// ============================================================
// EJS
// ============================================================

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));


// ============================================================
// MIDDLEWARES
// ============================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));


// ============================================================
// LOGIN
// ============================================================

app.get('/', (req, res) => {
  res.render('login');
});


// ============================================================
// FEED
// ============================================================

app.get('/home', authMiddleware, async (req, res) => {
  try {
    const posts = postService.getAllPosts(req.user.idUser);

    const suggestions = db.prepare(`
      SELECT u.idUser, u.pseudo, u.role, p.bio
      FROM Utilisateur u
      LEFT JOIN Profil p ON u.idUser = p.idUser
      WHERE u.idUser != ?
      LIMIT 10
    `).all(req.user.idUser);

    return res.render('feed', {
      user: req.user,
      posts,
      suggestions
    });
  } catch (err) {
    console.error('Erreur GET /home :', err);
    return res.render('feed', { user: req.user, posts: [], suggestions: [] });
  }
});

// ============================================================
// MESSAGERIE
// ============================================================

// Affichage de la liste des conversations
app.get('/messages', authMiddleware, async (req, res) => {
  try {
    const conversations = await conversationService.getMyConversations(req.user.idUser);
    res.render('messages', {
      user: req.user,
      conversations: conversations || [],
      activeTab: 'messages'
    });
  } catch (err) {
    console.error('Erreur GET /messages :', err);
    res.render('messages', {
      user: req.user,
      conversations: [],
      activeTab: 'messages'
    });
  }
});

// Affichage d'une discussion ouverte spécifique
app.get('/messages/:idConversation', authMiddleware, async (req, res) => {
  try {
    const idConversation = Number(req.params.idConversation);
    const messages = await messageService.getMessages(idConversation, req.user.idUser);

    // Récupération des informations de la conversation pour le titre
    const conversations = await conversationService.getMyConversations(req.user.idUser);
    const conv = conversations ? conversations.find(c => c.idConversation === idConversation) : null;

    res.render('conversation', {
      idConversation,
      titreConversation: conv ? (conv.titreGroupe || conv.autrePseudo || 'Discussion') : 'Discussion',
      messages: messages || [],
      idUserCourant: req.user.idUser,
      user: req.user,
      activeTab: 'messages'
    });
  } catch (err) {
    console.error('Erreur GET /messages/:idConversation :', err);
    res.redirect('/messages');
  }
});

// ============================================================
// MON PROFIL
// ============================================================

// Affichage de son propre profil
app.get('/profile', authMiddleware, async (req, res) => {
  try {
    const profile = await profileService.getMyProfile(req.user.idUser);

    const posts = postService.getUserPosts(req.user.idUser, req.user.idUser);

    const stats = {
      nbAbonnes: friendshipModel.listerAbonnes(db, req.user.idUser).length,
      nbAbonnements: friendshipModel.listerAbonnements(db, req.user.idUser).length,
      nbAmis: friendshipModel.listerAmis(db, req.user.idUser).length
    };

    res.render('profile', {
      profile,
      posts,
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

// Modification de profil (DOIT être avant /profile/:pseudo pour éviter le conflit de route)
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
    await profileService.updateMyProfile(req.user.idUser, { prenom, nom, bio });
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


// ============================================================
// PROFIL D'UN AUTRE UTILISATEUR
// ============================================================

app.get('/profile/:pseudo', authMiddleware, async (req, res) => {
  try {
    const targetProfile = await profileService.getPublicProfile(req.params.pseudo);
    const isOwner = req.user.idUser === targetProfile.idUser;

    let estAbonne = false;
    let sontAmis = false;

    if (!isOwner) {
      const dejaAbonne = db.prepare(`
        SELECT 1 FROM Abonnement WHERE idUserAbonne = ? AND idUserSuivi = ?
      `).get(req.user.idUser, targetProfile.idUser);
      estAbonne = !!dejaAbonne;

      sontAmis = friendshipModel.sontAmis(db, req.user.idUser, targetProfile.idUser);
    }

    const posts = postService.getUserPosts(targetProfile.idUser, req.user.idUser);

    const stats = {
      nbAbonnes: friendshipModel.listerAbonnes(db, targetProfile.idUser).length,
      nbAbonnements: friendshipModel.listerAbonnements(db, targetProfile.idUser).length,
      nbAmis: friendshipModel.listerAmis(db, targetProfile.idUser).length
    };

    res.render('profile', {
      profile: targetProfile,
      posts,
      isOwner,
      estAbonne,
      sontAmis,
      stats
    });
  } catch (err) {
    console.error(`Erreur GET /profile/${req.params.pseudo} :`, err.message);
    res.redirect('/home');
  }
});


// ============================================================
// MÉDIAS UPLOADÉS
// ============================================================

/*
 * IMPORTANT :
 *
 * On ne laisse plus express.static() déterminer
 * automatiquement le Content-Type des fichiers utilisateurs.
 *
 * Le fichier doit avoir été enregistré avec une extension
 * contrôlée par le serveur (.jpg, .png, .webp, .mp4, .webm,
 * .ogg ou .mov).
 *
 * X-Content-Type-Options: nosniff empêche également le navigateur
 * d'essayer de deviner un autre type MIME.
 */

app.get(
    '/uploads/:filename',
    async (req, res) => {

        try {

            const filename =
                req.params.filename;


            /*
             * Protection contre les chemins comme :
             *
             * ../fichier.html
             *
             * ou toute tentative de traversée.
             */
            if (
                filename !== path.basename(filename)
            ) {

                return res.status(400).send(
                    'Nom de fichier invalide.'
                );

            }


            /*
             * Extensions autorisées.
             */
            const contentTypes = {

                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp',

                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.ogg': 'video/ogg',
                '.mov': 'video/quicktime'

            };


            const extension =
                path.extname(
                    filename
                ).toLowerCase();


            const contentType =
                contentTypes[extension];


            /*
             * Une extension inconnue ne doit jamais
             * être servie comme HTML, SVG, PHP, etc.
             */
            if (!contentType) {

                return res.status(404).send(
                    'Fichier non trouvé.'
                );

            }


            const filePath =
                path.join(
                    __dirname,
                    '../uploads',
                    filename
                );


            /*
             * Vérification que le fichier existe.
             */
            try {

                await fs.access(
                    filePath
                );

            } catch {

                return res.status(404).send(
                    'Fichier non trouvé.'
                );

            }


            /*
             * Empêche le navigateur de renifler
             * un autre type MIME.
             */
            res.set(
                'X-Content-Type-Options',
                'nosniff'
            );


            /*
             * Le navigateur peut afficher les images
             * et vidéos normalement.
             */
            res.type(
                contentType
            );


            return res.sendFile(
                path.resolve(filePath)
            );

        }

        catch (error) {

            console.error(
                'Erreur accès média :',
                error
            );

            return res.status(500).send(
                'Erreur lors de la récupération du fichier.'
            );

        }

    }
);


// ============================================================
// ROUTES API (Back)
// ============================================================

app.use('/api/auth', authRoutes);
app.use('/api/friendships', friendshipRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/conversations', messageRoutes);
app.use('/post', postRoutes);
app.use('/api/publications', publicationRoutes);


module.exports = app;
