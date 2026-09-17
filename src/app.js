const express = require('express');
const path = require('path');
const fs = require('fs/promises');
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

const publicationRoutes =
    require('./routes/publicationRoutes');

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
    async (req, res) => {

        try {

            const posts =
                postService.getAllPosts(
                    req.user.idUser
                );

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
                postService.getUserPosts(
                    req.user.idUser,
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

            console.error(
                'Erreur chargement profil :',
                err
            );

            return res
                .status(302)
                .set('Location', '/home')
                .end();
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
                postService.getUserPosts(
                    profile.idUser,
                    req.user.idUser
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

            console.error(
                'Erreur chargement profil utilisateur :',
                err
            );

            return res
                .status(302)
                .set('Location', '/home')
                .end();
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
                    nom,
                    prenom,
                    bio
                }
            );

            return res.redirect(
                '/profile'
            );

        } catch (err) {

            console.error(
                'Erreur modification profil :',
                err
            );

            return res.redirect(
                '/profile/edit'
            );
        }
    }
);


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
// ROUTES
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

app.use(
    '/api/publications',
    publicationRoutes
);


module.exports = app;
