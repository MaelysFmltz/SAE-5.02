const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const authRoutes =
    require('./routes/authRoutes');

const authMiddleware =
    require('./middlewares/authMiddleware');

const postRoutes =
    require('./routes/postRoutes');

const profileRoutes =
    require('./routes/profileRoutes');

const profileService =
    require('./services/profileService');

const postService =
    require('./services/postService');


const app = express();


// ============================================================
// EJS
// ============================================================

app.set(
    'view engine',
    'ejs'
);

app.set(
    'views',
    path.join(__dirname, '../views')
);


// ============================================================
// MIDDLEWARES
// ============================================================

app.use(
    express.json()
);

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(
    cookieParser()
);

app.use(
    express.static(
        path.join(__dirname, '../public')
    )
);


// ============================================================
// LOGIN
// ============================================================

app.get('/', (req, res) => {

    res.render('login');

});


// ============================================================
// FEED
// ============================================================

app.get(
    '/home',
    authMiddleware,
    (req, res) => {

        try {

            const posts =
                postService.getAllImagePosts();


            return res.render(
                'feed',
                {
                    user: req.user,
                    posts
                }
            );

        } catch (err) {

            console.error(err);

            return res.status(500).send(
                'Erreur lors du chargement du Feed'
            );
        }
    }
);


// ============================================================
// MON PROFIL
// ============================================================

app.get(
    '/profile',
    authMiddleware,
    async (req, res) => {

        try {

            const profile =
                await profileService.getMyProfile(
                    req.user.idUser
                );


            const posts =
                postService.getUserImagePosts(
                    req.user.idUser
                );


            return res.render(
                'profile',
                {
                    profile,
                    posts,
                    isOwner: true
                }
            );

        } catch (err) {

            console.error(err);

            return res.redirect('/home');

        }
    }
);


// ============================================================
// PROFIL D'UN AUTRE UTILISATEUR
// ============================================================

app.get(
    '/profile/:pseudo',
    authMiddleware,
    async (req, res) => {

        try {

            const profile =
                await profileService.getPublicProfile(
                    req.params.pseudo
                );


            const posts =
                postService.getUserImagePosts(
                    profile.idUser
                );


            const isOwner =
                Number(profile.idUser) ===
                Number(req.user.idUser);


            return res.render(
                'profile',
                {
                    profile,
                    posts,
                    isOwner
                }
            );

        } catch (err) {

            console.error(err);

            return res.status(404).send(
                'Utilisateur introuvable'
            );
        }
    }
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


            return res.render(
                'editProfile',
                {
                    profile
                }
            );

        } catch (err) {

            return res.redirect(
                '/profile'
            );
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


            return res.redirect(
                '/profile'
            );

        } catch (err) {

            const profile =
                await profileService.getMyProfile(
                    req.user.idUser
                );


            return res.render(
                'editProfile',
                {
                    profile: {
                        ...profile,
                        ...req.body
                    },

                    error: err.message
                }
            );
        }
    }
);


// ============================================================
// UPLOADS
// ============================================================

app.use(
    '/uploads',
    express.static(
        path.join(__dirname, '../uploads')
    )
);


// ============================================================
// API
// ============================================================

app.use(
    '/api/auth',
    authRoutes
);

app.use(
    '/api/profile',
    profileRoutes
);

app.use(
    '/post',
    postRoutes
);


module.exports = app;