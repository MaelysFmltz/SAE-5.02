/**
 * Middleware autorisant l'accès aux administrateurs et au superadmin virtuel.
 */
function adminMiddleware(req, res, next) {
    const user = req.user;

    if (!user) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    const isSuperAdmin = 
        user.idUser === -999 || 
        user.role === 'superadmin' ||
        (process.env.SUPERADMIN_PSEUDO && user.pseudo === process.env.SUPERADMIN_PSEUDO);

    if (user.role === 'admin' || isSuperAdmin) {
        return next();
    }

    return res.status(403).json({
        error: 'Accès réservé aux administrateurs'
    });
}

module.exports = adminMiddleware;