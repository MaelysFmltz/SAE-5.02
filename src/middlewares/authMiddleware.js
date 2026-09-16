const jwt = require('jsonwebtoken');

/**

* Détermine si la requête correspond à une page HTML.
*
* Les pages HTML peuvent être redirigées vers la page
* de connexion lorsqu'il n'y a pas de token.
*
* Les routes API doivent recevoir une réponse JSON 401.
  */
  function isHtmlRequest(req) {

  const originalUrl =
  (req.originalUrl || '').split('?')[0];

  /*

  * Toutes les routes contenant /api/ ou se terminant
  * par /api sont considérées comme des API.
  *
  * Exemples :
  *
  * /api/profile/me
  * /post/api
  * /post/api/user/5
  * /post/api/12
    */
    const isApi =
    originalUrl === '/api' ||
    originalUrl.startsWith('/api/') ||
    originalUrl.includes('/api/');

  if (isApi) {
  return false;
  }

  /*

  * Une requête GET vers une page normale
  * est considérée comme HTML.
    */
    return req.method === 'GET';
    }

/**

* Redirige une page HTML vers la connexion.
  */
  function redirectToLogin(res) {

  return res
  .status(302)
  .set('Location', '/')
  .end();
  }

/**

* Middleware d'authentification JWT.
*
* Le token est recherché :
*
* 1. dans le cookie httpOnly "token" ;
* 2. dans Authorization: Bearer <token>.
     */
     function authMiddleware(req, res, next) {

  let token = null;

  /*

  * =====================================================
  * 1. COOKIE
  * =====================================================
    */

  if (
  req.cookies &&
  req.cookies.token
  ) {

  
   token =
       req.cookies.token;
  

  }

  /*

  * =====================================================
  * 2. HEADER AUTHORIZATION
  * =====================================================
    */

  else if (
  req.headers.authorization
  ) {

  
   const authorization =
       req.headers.authorization.trim();

   const parts =
       authorization.split(/\s+/);


   if (
       parts.length === 2 &&
       parts[0].toLowerCase() === 'bearer' &&
       parts[1]
   ) {

       token =
           parts[1];
   }
  

  }

  /*

  * =====================================================
  * 3. TOKEN ABSENT
  * =====================================================
    */

  if (!token) {

  
   if (isHtmlRequest(req)) {

       return redirectToLogin(res);
   }

   return res.status(401).json({
       error: 'Token manquant'
   });
  

  }

  /*

  * =====================================================
  * 4. VALIDATION JWT
  * =====================================================
    */

  try {

  
   const secret =
       process.env.JWT_SECRET ||
       'secret_de_secours_temporaire';


   const decoded =
       jwt.verify(
           token,
           secret
       );


   /*
    * Le token doit contenir un identifiant
    * utilisateur valide.
    */
   if (
       !decoded ||
       !decoded.idUser
   ) {

       if (
           req.cookies &&
           req.cookies.token
       ) {

           res.clearCookie('token');
       }


       if (isHtmlRequest(req)) {

           return redirectToLogin(res);
       }


       return res.status(401).json({
           error: 'Token invalide'
       });
   }


   /*
    * Identité authentifiée.
    */
   req.user = decoded;


   return next();
  

  } catch (err) {

  
   console.error(
       'Erreur authentification :',
       err.message
   );


   /*
    * Suppression du cookie invalide ou expiré.
    */
   if (
       req.cookies &&
       req.cookies.token
   ) {

       res.clearCookie('token');
   }


   if (isHtmlRequest(req)) {

       return redirectToLogin(res);
   }


   return res.status(401).json({
       error: 'Token invalide ou expiré'
   });
  

  }
  }

module.exports = authMiddleware;
