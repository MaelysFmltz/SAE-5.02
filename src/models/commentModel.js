const db = require('../config/database');
const reactionModel = require('./reactionModel');


// ============================================================
// RÉCUPÉRER LES COMMENTAIRES D'UNE PUBLICATION
// avec leurs réponses et leurs réactions
// ============================================================

function getCommentsByPostId(idPubli, currentUserId = null) {

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

    JOIN Utilisateur u
      ON c.idUser = u.idUser

    WHERE c.idPubli = ?

    ORDER BY c.dateCommentaire ASC
  `;

  const allComments = db
    .prepare(query)
    .all(idPubli);


  /*
   * Création d'une map :
   *
   * idComm -> commentaire
   */

  const commentMap = {};


  allComments.forEach(comment => {

    comment.replies = [];

    comment.reactions =
      reactionModel.getCommentReactions(
        comment.idComm,
        currentUserId
      );

    commentMap[comment.idComm] = comment;
  });


  /*
   * Construction de l'arbre.
   */

  const rootComments = [];


  allComments.forEach(comment => {

    /*
     * Commentaire enfant
     */

    if (
      comment.idParent !== null &&
      comment.idParent !== undefined &&
      commentMap[comment.idParent]
    ) {

      commentMap[
        comment.idParent
      ].replies.push(comment);

    }

    /*
     * Commentaire parent
     */

    else {

      rootComments.push(comment);
    }

  });


  return rootComments;
}


// ============================================================
// CRÉER UN COMMENTAIRE OU UNE RÉPONSE
// ============================================================

function createComment(
  idUser,
  idPubli,
  contenuCom,
  idParent = null
) {

  /*
   * Si c'est une réponse, on vérifie que le commentaire parent
   * appartient bien à la même publication.
   */

  if (idParent !== null) {

    const parent = db
      .prepare(`
        SELECT idComm, idPubli
        FROM Commentaire
        WHERE idComm = ?
      `)
      .get(idParent);


    if (!parent) {
      throw new Error(
        'Commentaire parent introuvable.'
      );
    }


    if (Number(parent.idPubli) !== Number(idPubli)) {

      throw new Error(
        'Le commentaire parent appartient à une autre publication.'
      );
    }

  }


  const query = `
    INSERT INTO Commentaire
    (
      idUser,
      idPubli,
      idParent,
      contenuCom,
      dateCommentaire
    )
    VALUES (?, ?, ?, ?, datetime('now'))
  `;


  const info = db
    .prepare(query)
    .run(
      idUser,
      idPubli,
      idParent,
      contenuCom
    );


  return {
    idComm: Number(info.lastInsertRowid),

    idUser,

    idPubli,

    idParent,

    contenuCom
  };
}

// ============================================================
// RÉCUPÉRER UN COMMENTAIRE PAR SON ID
// ============================================================

function getCommentById(idComm) {

  return db
    .prepare(`
      SELECT
        idComm,
        idUser,
        idPubli,
        idParent,
        contenuCom,
        dateCommentaire,
        dateModif
      FROM Commentaire
      WHERE idComm = ?
    `)
    .get(idComm);
}


// ============================================================
// MODIFIER UN COMMENTAIRE
// ============================================================

function updateComment(
  idComm,
  idUser,
  contenuCom
) {

  const query = `
    UPDATE Commentaire

    SET
      contenuCom = ?,
      dateModif = datetime('now')

    WHERE idComm = ?
      AND idUser = ?
  `;


  const info = db
    .prepare(query)
    .run(
      contenuCom,
      idComm,
      idUser
    );


  return info.changes > 0;
}


// ============================================================
// SUPPRIMER UN COMMENTAIRE
// ============================================================

function deleteComment(
  idComm,
  idUser
) {

  const query = `
    DELETE FROM Commentaire

    WHERE idComm = ?

      AND (
        idUser = ?

        OR idPubli IN (
          SELECT idPubli
          FROM Publication
          WHERE idUser = ?
        )
      )
  `;


  const info = db
    .prepare(query)
    .run(
      idComm,
      idUser,
      idUser
    );


  return info.changes > 0;
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  getCommentsByPostId,

  getCommentById,

  createComment,

  updateComment,

  deleteComment

};