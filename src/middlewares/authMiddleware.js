const jwt = require('jsonwebtoken');

function isHtmlRequest(req) {
    /*
     * Les pages de notre application sont des requêtes GET.
     * Les API utilisent généralement GET/POST/PUT/etc. mais
     * on ne veut pas les rediriger vers le login.
     */
    if (req.method === 'GET') {
        return true;
    }

    return false;
}


function redirectToLogin(res) {
    return res
        .status(302)
        .set('Location', '/')
        .end();
}


function authMiddleware(req, res, next) {

    let token = null;


    /*
     * ==========================================
     * 1. COOKIE
     * ==========================================
     */

    if (
        req.cookies &&
        req.cookies.token
    ) {
        token = req.cookies.token;
    }


    /*
     * ==========================================
     * 2. HEADER AUTHORIZATION
     * ==========================================
     */

    else if (
        req.headers.authorization
    ) {

        const parts =
            req.headers.authorization.split(' ');

        if (
            parts.length === 2 &&
            parts[0] === 'Bearer'
        ) {
            token = parts[1];
        }
    }


    /*
     * ==========================================
     * 3. TOKEN ABSENT
     * ==========================================
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
     * ==========================================
     * 4. VALIDATION JWT
     * ==========================================
     */

    try {

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET ||
                'secret_de_secours_temporaire'
            );


        /*
         * Le token doit contenir un utilisateur.
         */
        if (
            !decoded ||
            !decoded.idUser
        ) {

            if (req.cookies && req.cookies.token) {
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
         * On ajoute l'utilisateur à req.
         */
        req.user = decoded;

        next();

    } catch (err) {

        console.error(
            'Erreur authentification :',
            err.message
        );


        /*
         * Suppression du cookie invalide.
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