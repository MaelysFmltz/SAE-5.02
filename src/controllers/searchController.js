const hashtagService = require('../services/hashtagService');
const { linkifyHashtags } = require('../utils/hashtagUtils');
const db = require('../config/database');

/**
 * Rendu de la page de recherche (/search)
 */
function afficherPageRecherche(req, res) {
  try {
    const query = (req.query.q || '').trim();
    const tendances = hashtagService.obtenirTendances(db, 10);

    let resultats = { utilisateurs: [], hashtags: [], publications: [] };
    if (query) {
      resultats = hashtagService.rechercherTout(db, query);
    }

    res.render('search', {
      user: req.user,
      query,
      tendances,
      resultats,
      linkifyHashtags // Permet d'injecter les balises <a> sécurisées sur les #tags
    });
  } catch (err) {
    console.error('Erreur afficherPageRecherche :', err);
    res.status(500).render('error', { message: 'Erreur lors du chargement de la recherche.' });
  }
}

/**
 * API pour la recherche en temps réel (/search/api?q=...)
 */
function apiRecherche(req, res) {
  try {
    const query = (req.query.q || '').trim();
    if (!query) {
      return res.json({ utilisateurs: [], hashtags: [], publications: [] });
    }

    const resultats = hashtagService.rechercherTout(db, query);
    res.json(resultats);
  } catch (err) {
    console.error('Erreur apiRecherche :', err);
    res.status(500).json({ error: 'Erreur serveur lors de la recherche.' });
  }
}

/**
 * API pour récupérer uniquement les tendances (/search/tendances)
 */
function apiTendances(req, res) {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const tendances = hashtagService.obtenirTendances(db, limit);
    res.json(tendances);
  } catch (err) {
    console.error('Erreur apiTendances :', err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des tendances.' });
  }
}

module.exports = {
  afficherPageRecherche,
  apiRecherche,
  apiTendances
};