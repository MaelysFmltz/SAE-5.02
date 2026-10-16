const hashtagService = require('../services/hashtagService');
const hashtagModel = require('../models/hashtagModel');
const { linkifyHashtags } = require('../utils/hashtagUtils');
const db = require('../config/database');

/**
 * Rendu de la page de recherche (/search)
 */
function afficherPageRecherche(req, res) {
  try {
    const query = (req.query.q || '').trim();
    const currentUserId = req.user.idUser;
    const tendances = hashtagService.obtenirTendances(db, 10);

    let resultats = { utilisateurs: [], hashtags: [], publications: [] };
    if (query) {
      resultats = hashtagService.rechercherTout(db, query, currentUserId);
    }

    res.render('search', {
      user: req.user,
      query,
      tendances,
      resultats,
      linkifyHashtags
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
    const currentUserId = req.user.idUser;

    if (!query) {
      return res.json({ utilisateurs: [], hashtags: [], publications: [] });
    }

    const resultats = hashtagService.rechercherTout(db, query, currentUserId);
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
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const tendances = hashtagService.obtenirTendances(db, limit);
    res.json(tendances);
  } catch (err) {
    console.error('Erreur apiTendances :', err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des tendances.' });
  }
}

/**
 * Suggestions de hashtags existants/populaires pendant la saisie
 * (création de publication, commentaires). Renvoie une liste vide
 * tant qu'aucun préfixe utile n'est fourni.
 */
function apiSuggestionsHashtags(req, res) {
  try {
    const prefix = (req.query.prefix || '').trim();

    if (!prefix) {
      return res.json([]);
    }

    const suggestions = hashtagModel.searchHashtags(db, prefix, 8);
    res.json(suggestions);
  } catch (err) {
    console.error('Erreur apiSuggestionsHashtags :', err);
    res.status(500).json({ error: 'Erreur serveur lors de la suggestion de hashtags.' });
  }
}

module.exports = {
  afficherPageRecherche,
  apiRecherche,
  apiTendances,
  apiSuggestionsHashtags
};