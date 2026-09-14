const db = require('../config/database');

function createComment(idUser, idPubli, contenuCom) {
  const query = `
    INSERT INTO Commentaire (idUser, idPubli, contenuCom, dateCommentaire)
    VALUES (?, ?, ?, datetime('now'))
  `;
  const info = db.prepare(query).run(idUser, idPubli, contenuCom);
  return { idComm: info.lastInsertRowid, idUser, idPubli, contenuCom };
}

function getCommentsByPostId(idPubli) {
  const query = `
    SELECT 
      c.idComm,
      c.idPubli,
      c.idUser,
      c.contenuCom,
      c.dateCommentaire,
      u.pseudo
    FROM Commentaire c
    JOIN Utilisateur u ON c.idUser = u.idUser
    WHERE c.idPubli = ?
    ORDER BY c.dateCommentaire ASC
  `;
  return db.prepare(query).all(idPubli);
}

// Seul l'auteur peut modifier son propre texte
function updateComment(idComm, idUser, contenuCom) {
  const query = `
    UPDATE Commentaire
    SET contenuCom = ?, dateModif = datetime('now')
    WHERE idComm = ? AND idUser = ?
  `;
  const info = db.prepare(query).run(contenuCom, idComm, idUser);
  return info.changes > 0;
}

// L'auteur du commentaire OU l'auteur du post peut supprimer
function deleteComment(idComm, idUser) {
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
  createComment,
  getCommentsByPostId,
  updateComment,
  deleteComment
};