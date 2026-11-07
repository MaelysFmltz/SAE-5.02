/**
 * Réponse d'erreur homogène pour les contrôleurs :
 * - erreur « métier » (avec err.status, levée volontairement par un service) :
 *   son message est renvoyé tel quel ;
 * - erreur inattendue (SQL, bug…) : message générique, détail uniquement dans les logs serveur.
 */
function repondreErreur(res, err, contexte = 'Erreur serveur') {
  if (err && Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(`${contexte} :`, err);
  return res.status(500).json({ error: 'Une erreur interne est survenue.' });
}

module.exports = { repondreErreur };
