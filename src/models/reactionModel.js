const db = require('../config/database');

// ============================================================
// 1. RÉACTIONS SUR LES PUBLICATIONS (Table LikeDislike)
// ============================================================

function getPostReactions(idPubli, currentUserId = null) {
  const counts = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN estLike = 1 THEN 1 ELSE 0 END), 0) AS likes,
      COALESCE(SUM(CASE WHEN estLike = 0 THEN 1 ELSE 0 END), 0) AS dislikes
    FROM LikeDislike
    WHERE idPubli = ?
  `).get(idPubli);

  let userReaction = null;
  if (currentUserId) {
    const row = db.prepare(`
      SELECT estLike FROM LikeDislike WHERE idPubli = ? AND idUser = ?
    `).get(idPubli, currentUserId);
    if (row) {
      userReaction = row.estLike === 1 ? 'LIKE' : 'DISLIKE';
    }
  }

  return {
    likes: counts ? counts.likes : 0,
    dislikes: counts ? counts.dislikes : 0,
    userReaction
  };
}

function toggleReaction(idUser, idPubli, type) {
  const estLikeValue = (type === 'LIKE') ? 1 : 0;
  
  const existing = db.prepare(`
    SELECT estLike FROM LikeDislike WHERE idUser = ? AND idPubli = ?
  `).get(idUser, idPubli);

  if (!existing) {
    db.prepare(`
      INSERT INTO LikeDislike (idUser, idPubli, estLike) VALUES (?, ?, ?)
    `).run(idUser, idPubli, estLikeValue);
  } else if (existing.estLike === estLikeValue) {
    db.prepare(`
      DELETE FROM LikeDislike WHERE idUser = ? AND idPubli = ?
    `).run(idUser, idPubli);
  } else {
    db.prepare(`
      UPDATE LikeDislike SET estLike = ? WHERE idUser = ? AND idPubli = ?
    `).run(estLikeValue, idUser, idPubli);
  }

  return getPostReactions(idPubli, idUser);
}

// ============================================================
// 2. RÉACTIONS SUR LES COMMENTAIRES (Table LikeCommentaire)
// ============================================================

function getCommentReactions(idComm, currentUserId = null) {
  const counts = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN estLike = 1 THEN 1 ELSE 0 END), 0) AS likes,
      COALESCE(SUM(CASE WHEN estLike = 0 THEN 1 ELSE 0 END), 0) AS dislikes
    FROM LikeCommentaire
    WHERE idComm = ?
  `).get(idComm);

  let userReaction = null;
  if (currentUserId) {
    const row = db.prepare(`
      SELECT estLike FROM LikeCommentaire WHERE idComm = ? AND idUser = ?
    `).get(idComm, currentUserId);
    if (row) {
      userReaction = row.estLike === 1 ? 'LIKE' : 'DISLIKE';
    }
  }

  return {
    likes: counts ? counts.likes : 0,
    dislikes: counts ? counts.dislikes : 0,
    userReaction
  };
}

function toggleCommentReaction(idUser, idComm, type) {
  const estLikeValue = (type === 'LIKE') ? 1 : 0;

  const existing = db.prepare(`
    SELECT estLike FROM LikeCommentaire WHERE idUser = ? AND idComm = ?
  `).get(idUser, idComm);

  if (!existing) {
    db.prepare(`
      INSERT INTO LikeCommentaire (idUser, idComm, estLike) VALUES (?, ?, ?)
    `).run(idUser, idComm, estLikeValue);
  } else if (existing.estLike === estLikeValue) {
    db.prepare(`
      DELETE FROM LikeCommentaire WHERE idUser = ? AND idComm = ?
    `).run(idUser, idComm);
  } else {
    db.prepare(`
      UPDATE LikeCommentaire SET estLike = ? WHERE idUser = ? AND idComm = ?
    `).run(estLikeValue, idUser, idComm);
  }

  return getCommentReactions(idComm, idUser);
}

module.exports = {
  getPostReactions,
  toggleReaction,
  getCommentReactions,
  toggleCommentReaction
};