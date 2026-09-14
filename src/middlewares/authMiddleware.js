const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    let token = null;

    /*
     * ============================================================
     * RECUPERATION DU TOKEN
     * ============================================================
     *
     * Le token est prioritairement récupéré depuis le cookie
     * HTTP-only "token".
     *
     * Le support du header Authorization est conservé pour
     * permettre l'utilisation éventuelle de l'API avec :
     *
     * Authorization: Bearer <JWT>
     */

    if (
        req.cookies &&
        typeof req.cookies.token === 'string' &&
        req.cookies.token.length > 0
    ) {
        token = req.cookies.token;
    } else if (
        typeof req.headers.authorization === 'string'
    ) {
        const authorization = req.headers.authorization.trim();

        const parts = authorization.split(/\s+/);

        if (
            parts.length === 2 &&
            parts[0].toLowerCase() === 'bearer' &&
            parts[1].length > 0
        ) {
            token = parts[1];
        }
    }

    /*
     * ============================================================
     * TOKEN ABSENT
     * ============================================================
     */

    if (!token) {
        return res.status(401).json({
            error: 'Token manquant'
        });
    }

    /*
     * ============================================================
     * VERIFICATION DU JWT
     * ============================================================
     */

    if (!process.env.JWT_SECRET) {
        console.error(
            'JWT_SECRET n’est pas configuré.'
        );

        return res.status(500).json({
            error: 'Configuration serveur invalide'
        });
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        /*
         * Le token doit obligatoirement contenir un idUser
         * valide afin de pouvoir identifier l'utilisateur.
         */

        const idUser = Number(
            decoded.idUser
        );

        if (
            !Number.isInteger(idUser) ||
            idUser <= 0
        ) {
            console.error(
                'JWT valide mais idUser invalide :',
                decoded
            );

            return res.status(401).json({
                error: 'Token utilisateur invalide'
            });
        }

        /*
         * Informations utilisateur disponibles
         * pour les contrôleurs suivants.
         */

        req.user = {
            idUser,
            pseudo: decoded.pseudo,
            role: decoded.role
        };

        next();

    } catch (error) {
        console.error(
            'Erreur vérification JWT :',
            error.message
        );

        /*
         * Le cookie est supprimé uniquement s'il existe.
         */

        if (
            req.cookies &&
            req.cookies.token
        ) {
            res.clearCookie(
                'token',
                {
                    httpOnly: true
                }
            );
        }

        return res.status(401).json({
            error: 'Token invalide ou expiré'
        });
    }
}

module.exports = authMiddleware;
