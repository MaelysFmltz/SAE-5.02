const db = require('../config/database');

/**
 * Récupère tous les commentaires d'un post organisés sous forme d'arborescence (réponses imbriquées)
 */
function getCommentsByPostId(idPubli) {
  const query = `
    SELECT 
      c.idComm,
      c.idUser,
      c.idPubli,
      c.idParent,
      c.contenuCom,
      c.dateCommentaire,
      c.dateModif,
      u.pseudo
    FROM Commentaire c
    JOIN Utilisateur u ON c.idUser = u.idUser
    WHERE c.idPubli = ?
    ORDER BY c.dateCommentaire ASC
  `;
  const allComments = db.prepare(query).all(idPubli);

  // Construction de l'arbre récursif
  const commentMap = {};
  allComments.forEach(c => {
    c.replies = [];
    commentMap[c.idComm] = c;
  });

  const rootComments = [];
  allComments.forEach(c => {
    if (c.idParent && commentMap[c.idParent]) {
      commentMap[c.idParent].replies.push(c);
    } else {
      rootComments.push(c);
    }
  });

  return rootComments;
}

/**
 * Insère un nouveau commentaire ou une réponse (si idParent est fourni)
 */
function createComment(idUser, idPubli, contenuCom, idParent = null) {
  const query = `
    INSERT INTO Commentaire (idUser, idPubli, idParent, contenuCom, dateCommentaire)
    VALUES (?, ?, ?, ?, datetime('now'))
  `;
  const info = db.prepare(query).run(idUser, idPubli, idParent || null, contenuCom);
  return {
    idComm: info.lastInsertRowid,
    idUser,
    idPubli,
    idParent,
    contenuCom
  };
}

function updateComment(idComm, idUser, contenuCom) {
  const query = `
    UPDATE Commentaire
    SET contenuCom = ?, dateModif = datetime('now')
    WHERE idComm = ? AND idUser = ?
  `;
  const info = db.prepare(query).run(contenuCom, idComm, idUser);
  return info.changes > 0;
}

function deleteComment(idComm, idUser) {
  // Supprime le commentaire (et ses enfants si CASCADE est actif ou via suppression directe)
  const query = `
    DELETE FROM Commentaire
    WHERE idComm = ?
      AND (
        idUser = ? 
        OR idPubli IN (SELECT idPubli FROM Publication WHERE idUser = ?)
      )
  `;
  const info = db.prepare(query).run(idComm, idUser, idUser);
  return info.changes > 0;
}

module.exports = {
  getCommentsByPostId,
  createComment,
  updateComment,
  deleteComment
};