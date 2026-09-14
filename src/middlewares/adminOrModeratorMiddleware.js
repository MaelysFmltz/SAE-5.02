function adminOrModeratorMiddleware(req, res, next) {
    if (
        !req.user ||
        !['admin', 'moderator'].includes(req.user.role)
    ) {
        return res.status(403).json({
            error: 'Accès réservé aux administrateurs et modérateurs'
        });
    }

    next();
}

module.exports = adminOrModeratorMiddleware;
