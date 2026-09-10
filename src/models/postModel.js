const db = require('../config/database');


/*
 * ============================================================
 * PUBLICATION
 * ============================================================
 */

function createPublication(
  idUser,
  contenuPub
) {
  const statement = db.prepare(`
    INSERT INTO Publication (
      idUser,
      contenuPub
    )
    VALUES (?, ?)
  `);

  const result = statement.run(
    idUser,
    contenuPub
  );

  return Number(result.lastInsertRowid);
}


/*
 * ============================================================
 * MÉDIA
 * ============================================================
 */

function createVideoMedia(
  idPubli,
  nomMedia,
  duree
) {
  const statement = db.prepare(`
    INSERT INTO Media (
      idPubli,
      nomMedia,
      typeMedia,
      duree
    )
    VALUES (?, ?, 'video', ?)
  `);

  const result = statement.run(
    idPubli,
    nomMedia,
    duree
  );

  return Number(result.lastInsertRowid);
}


/*
 * ============================================================
 * SUPPRESSION
 * ============================================================
 */

function deletePublication(idPubli) {
  db.prepare(`
    DELETE FROM Publication
    WHERE idPubli = ?
  `).run(idPubli);
}


module.exports = {
  createPublication,
  createVideoMedia,
  deletePublication
};

