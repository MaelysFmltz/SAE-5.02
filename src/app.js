require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();

// Configuration
const logger = require('./config/logger');
const db = require('./config/database');

// Middlewares
const logMiddleware = require('./middlewares/logMiddleware');
const authMiddleware = require('./middlewares/authMiddleware');

// Routes
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const publicationRoutes = require('./routes/publicationRoutes');
const commentRoutes = require('./routes/commentRoutes');
const friendshipRoutes = require('./routes/friendshipRoutes');
const profileRoutes = require('./routes/profileRoutes');
const userRoutes = require('./routes/userRoutes');
const searchRoutes = require('./routes/searchRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');

// Contrôleurs
const commentController = require('./controllers/commentController');

// Services
const profileService = require('./services/profileService');
const conversationService = require('./services/conversationService');
const messageService = require('./services/messageService');
const postService = require('./services/postService');

// Modèles
const friendshipModel = require('./models/friendshipModel');

// Utilitaires
const { linkifyHashtags } = require('./utils/hashtagUtils');

/*
 * Permet de récupérer correctement l'adresse IP du client
 * lorsque l'application est placée derrière Nginx.
 */
app.set('trust proxy', 1);

// ============================================================
// CONFIGURATION D'EJS
// ============================================================

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// ============================================================
// MIDDLEWARES GLOBAUX
// ============================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  express.static(
    path.join(__dirname, '../public')
  )
);

/*
 * Enregistre chaque requête HTTP dans les fichiers de logs.
 *
 * Ce middleware doit être placé après la création de `app`
 * et avant la déclaration des routes.
 */
app.use(logMiddleware);

// ============================================================
// ROUTES D'AFFICHAGE
// ============================================================

app.get('/', (req, res) => {
  res.render('login');
});

app.get('/login', (req, res) => {
  res.render('login');
});

// ============================================================
// FIL D'ACTUALITÉ
// ============================================================

app.get('/home', authMiddleware, (req, res) => {
  try {
    const publications = postService.getFeedForUser(
      req.user.idUser
    );

    const suggestions = db.prepare(`
      SELECT
        u.idUser,
        u.pseudo,
        u.role,
        p.bio
      FROM Utilisateur u
      LEFT JOIN Profil p
        ON u.idUser = p.idUser
      WHERE u.idUser != ?
      LIMIT 10
    `).all(req.user.idUser);

    res.render('feed', {
      user: req.user,
      publications,
      suggestions,
      linkifyHashtags
    });
  } catch (err) {
    logger.error('Erreur GET /home', {
      message: err.message,
      stack: err.stack,
      idUser: req.user?.idUser || null
    });

    res.render('feed', {
      user: req.user,
      publications: [],
      suggestions: [],
      linkifyHashtags
    });
  }
});

// ============================================================
// MESSAGERIE
// ============================================================

// Affichage de la liste des conversations
app.get('/messages', authMiddleware, async (req, res) => {
  try {
    const conversations =
      await conversationService.getMyConversations(
        req.user.idUser
      );

    res.render('messages', {
      user: req.user,
      conversations: conversations || [],
      activeTab: 'messages'
    });
  } catch (err) {
    logger.error('Erreur GET /messages', {
      message: err.message,
      stack: err.stack,
      idUser: req.user?.idUser || null
    });

    res.render('messages', {
      user: req.user,
      conversations: [],
      activeTab: 'messages'
    });
  }
});

// Affichage d'une conversation spécifique
app.get(
  '/messages/:idConversation',
  authMiddleware,
  async (req, res) => {
    try {
      const idConversation = Number(
        req.params.idConversation
      );

      if (
        !Number.isInteger(idConversation) ||
        idConversation <= 0
      ) {
        return res.redirect('/messages');
      }

      const messages =
        await messageService.getMessages(
          idConversation,
          req.user.idUser
        );

      /*
       * L'ouverture de la conversation marque les messages
       * reçus comme lus.
       */
      await messageService.markAsRead(
        idConversation,
        req.user.idUser
      );

      const membres =
        await conversationService.getConversationMembers(
          idConversation,
          req.user.idUser
        );

      const conversations =
        await conversationService.getMyConversations(
          req.user.idUser
        );

      const conversation = conversations
        ? conversations.find(
          (item) =>
            item.idConversation === idConversation
        )
        : null;

      const estCreateurCourant = (
        membres || []
      ).some(
        (membre) =>
          membre.idUser === req.user.idUser &&
          Boolean(membre.estCreateur)
      );

      res.render('conversation', {
        idConversation,

        titreConversation: conversation
          ? (
            conversation.titreGroupe ||
            conversation.autrePseudo ||
            'Discussion'
          )
          : 'Discussion',

        estGroupe: Boolean(
          conversation &&
          conversation.titreGroupe
        ),

        estCreateurCourant,
        membres: membres || [],
        messages: messages || [],
        idUserCourant: req.user.idUser,
        user: req.user,
        activeTab: 'messages'
      });
    } catch (err) {
      logger.error(
        'Erreur GET /messages/:idConversation',
        {
          message: err.message,
          stack: err.stack,
          idUser: req.user?.idUser || null,
          idConversation:
            req.params.idConversation || null
        }
      );

      res.redirect('/messages');
    }
  }
);

// ============================================================
// PROFIL PERSONNEL
// ============================================================

app.get('/profile', authMiddleware, async (req, res) => {
  try {
    const profile =
      await profileService.getMyProfile(
        req.user.idUser
      );

    const stats = {
      nbAbonnes: friendshipModel.listerAbonnes(
        db,
        req.user.idUser
      ).length,

      nbAbonnements:
        friendshipModel.listerAbonnements(
          db,
          req.user.idUser
        ).length,

      nbAmis: friendshipModel.listerAmis(
        db,
        req.user.idUser
      ).length
    };

    res.render('profile', {
      profile,
      isOwner: true,
      estAbonne: false,
      sontAmis: false,
      stats,
      linkifyHashtags
    });
  } catch (err) {
    logger.error('Erreur GET /profile', {
      message: err.message,
      stack: err.stack,
      idUser: req.user?.idUser || null
    });

    res.status(500).send(
      'Erreur lors du chargement de votre profil.'
    );
  }
});

// ============================================================
// PARAMÈTRES
// ============================================================

app.get('/settings', authMiddleware, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT
        idUser,
        pseudo,
        email,
        dateNaissance,
        role
      FROM Utilisateur
      WHERE idUser = ?
    `).get(req.user.idUser);

    if (!user) {
      return res.redirect('/login');
    }

    res.render('settings', {
      user,
      title: 'Paramètres'
    });
  } catch (err) {
    logger.error('Erreur GET /settings', {
      message: err.message,
      stack: err.stack,
      idUser: req.user?.idUser || null
    });

    res.redirect('/profile');
  }
});

// ============================================================
// PUBLICATIONS
// ============================================================

app.get(
  '/publication/create',
  authMiddleware,
  (req, res) => {
    res.render('posts', {
      user: req.user
    });
  }
);

app.get(
  '/publication/:idPubli',
  authMiddleware,
  commentController.renderPostPage
);

// ============================================================
// MODIFICATION DU PROFIL
// ============================================================

app.get(
  '/profile/edit',
  authMiddleware,
  async (req, res) => {
    try {
      const profile =
        await profileService.getMyProfile(
          req.user.idUser
        );

      res.render('editProfile', {
        profile
      });
    } catch (err) {
      logger.error('Erreur GET /profile/edit', {
        message: err.message,
        stack: err.stack,
        idUser: req.user?.idUser || null
      });

      res.redirect('/profile');
    }
  }
);

app.post(
  '/profile/edit',
  authMiddleware,
  async (req, res) => {
    try {
      const {
        prenom,
        nom,
        bio
      } = req.body;

      await profileService.updateMyProfile(
        req.user.idUser,
        {
          prenom,
          nom,
          bio
        }
      );

      res.redirect('/profile');
    } catch (err) {
      logger.error('Erreur POST /profile/edit', {
        message: err.message,
        stack: err.stack,
        idUser: req.user?.idUser || null
      });

      let profile = {};

      try {
        profile =
          await profileService.getMyProfile(
            req.user.idUser
          );
      } catch (profileError) {
        logger.error(
          'Erreur pendant la récupération du profil',
          {
            message: profileError.message,
            stack: profileError.stack,
            idUser: req.user?.idUser || null
          }
        );
      }

      res.status(400).render('editProfile', {
        profile: {
          ...profile,
          ...req.body
        },
        error: err.message
      });
    }
  }
);

// ============================================================
// PROFIL PUBLIC
// ============================================================

app.get(
  '/profile/:pseudo',
  authMiddleware,
  async (req, res) => {
    try {
      const targetProfile =
        await profileService.getPublicProfile(
          req.params.pseudo,
          req.user.idUser
        );

      const isOwner =
        req.user.idUser === targetProfile.idUser;

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

        estAbonne = Boolean(dejaAbonne);

        sontAmis = friendshipModel.sontAmis(
          db,
          req.user.idUser,
          targetProfile.idUser
        );
      }

      const stats = {
        nbAbonnes:
          friendshipModel.listerAbonnes(
            db,
            targetProfile.idUser
          ).length,

        nbAbonnements:
          friendshipModel.listerAbonnements(
            db,
            targetProfile.idUser
          ).length,

        nbAmis:
          friendshipModel.listerAmis(
            db,
            targetProfile.idUser
          ).length
      };

      res.render('profile', {
        profile: targetProfile,
        isOwner,
        estAbonne,
        sontAmis,
        stats,
        linkifyHashtags
      });
    } catch (err) {
      logger.error(
        'Erreur GET /profile/:pseudo',
        {
          message: err.message,
          stack: err.stack,
          pseudo: req.params.pseudo,
          idUser: req.user?.idUser || null
        }
      );

      res.redirect('/home');
    }
  }
);

// ============================================================
// RECHERCHE ET HASHTAGS
// ============================================================

app.use('/search', searchRoutes);

// ============================================================
// MÉDIAS ENVOYÉS PAR LES UTILISATEURS
// ============================================================

/*
 * Les fichiers sont servis avec un type MIME défini par
 * le serveur. Cela empêche l'envoi de fichiers HTML, SVG,
 * PHP ou d'autres formats non autorisés.
 */

app.get('/uploads/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;

    /*
     * Protection contre les tentatives de traversée de
     * répertoires comme "../fichier".
     */
    if (filename !== path.basename(filename)) {
      logger.warn(
        'Tentative de chemin de fichier invalide',
        {
          filename,
          ip: req.ip
        }
      );

      return res.status(400).send(
        'Nom de fichier invalide.'
      );
    }

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
      path.extname(filename).toLowerCase();

    const contentType =
      contentTypes[extension];

    if (!contentType) {
      logger.warn(
        'Tentative d’accès à une extension interdite',
        {
          filename,
          extension,
          ip: req.ip
        }
      );

      return res.status(404).send(
        'Fichier non trouvé.'
      );
    }

    const filePath = path.join(
      __dirname,
      '../uploads',
      filename
    );

    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).send(
        'Fichier non trouvé.'
      );
    }

    res.set(
      'X-Content-Type-Options',
      'nosniff'
    );

    res.type(contentType);

    return res.sendFile(
      path.resolve(filePath)
    );
  } catch (err) {
    logger.error(
      'Erreur pendant l’accès à un média',
      {
        message: err.message,
        stack: err.stack,
        filename: req.params.filename,
        ip: req.ip
      }
    );

    return res.status(500).send(
      'Erreur lors de la récupération du fichier.'
    );
  }
});

// ============================================================
// ROUTES API
// ============================================================

app.use('/api/auth', authRoutes);
app.use('/api/publications', postRoutes);
app.use('/api/publications', publicationRoutes);
app.use('/api/friendships', friendshipRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/user', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/conversations', messageRoutes);

// ============================================================
// ROUTE NON TROUVÉE
// ============================================================

app.use((req, res) => {
  logger.warn('Route non trouvée', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    idUser: req.user?.idUser || null
  });

  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({
      error: 'Route non trouvée'
    });
  }

  return res.status(404).send(
    'Page non trouvée.'
  );
});

// ============================================================
// GESTIONNAIRE GLOBAL DES ERREURS
// ============================================================

app.use((err, req, res, next) => {
  logger.error('Erreur serveur', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    idUser: req.user?.idUser || null
  });

  if (res.headersSent) {
    return next(err);
  }

  return res.status(
    err.status || err.statusCode || 500
  ).json({
    error: 'Une erreur interne est survenue.'
  });
});

module.exports = app;