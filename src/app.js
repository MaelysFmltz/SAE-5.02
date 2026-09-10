const express = require('express');
const path = require('path');

const authRoutes =
  require('./routes/authRoutes');

const postRoutes =
  require('./routes/postRoutes');


const app = express();


/*
 * ============================================================
 * EJS
 * ============================================================
 */

app.set(
  'view engine',
  'ejs'
);

app.set(
  'views',
  path.join(
    __dirname,
    '../views'
  )
);


/*
 * ============================================================
 * FICHIERS PUBLICS
 * ============================================================
 *
 * IMPORTANT :
 * On ne fait PAS :
 *
 * app.use('/uploads', express.static(...))
 *
 * Les vidéos ne doivent pas être directement accessibles
 * comme fichiers statiques.
 */

app.use(
  express.static(
    path.join(
      __dirname,
      '../public'
    )
  )
);


/*
 * ============================================================
 * BODY JSON
 * ============================================================
 */

app.use(
  express.json({
    limit: '100kb'
  })
);


/*
 * ============================================================
 * ROUTES
 * ============================================================
 */

app.use(
  '/api/auth',
  authRoutes
);

app.use(
  '/post',
  postRoutes
);


/*
 * ============================================================
 * ROUTE RACINE
 * ============================================================
 */

app.get(
  '/',
  (req, res) => {
    res.json({
      message:
        'API Instagram fonctionne'
    });
  }
);


module.exports = app;
