/**
 * Middleware de vérification des privilèges du Super Administrateur.
 * Vérifie si l'utilisateur connecté correspond aux identifiants stricts définis dans le .env.
 */
function superAdminMiddleware(req, res, next) {
  try {
    // req.user est injecté par ton authMiddleware en amont
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }

    const superPseudo = process.env.SUPERADMIN_PSEUDO;
    const superEmail = process.env.SUPERADMIN_EMAIL;

    // Vérification de sécurité stricte par rapport au .env
    const isSuperAdmin = 
      (superPseudo && user.pseudo === superPseudo) || 
      (superEmail && user.email === superEmail);

    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Accès strictement réservé au Super Administrateur.' });
    }

    next();
  } catch (error) {
    console.error('Erreur superAdminMiddleware :', error);
    return res.status(500).json({ error: 'Erreur serveur lors de la vérification des privilèges.' });
  }
}

module.exports = superAdminMiddleware;