const dbInstance = require('../config/database');

/**
 * Bloque un utilisateur cible et supprime immédiatement toute relation sociale réciproque.
 */
function bloquerUtilisateur(idUserBloqueur, idUserBloque, db = dbInstance) {
  if (!Number.isInteger(idUserBloque) || idUserBloque <= 0) {
    return { succes: false, erreur: 'Identifiant utilisateur invalide.' };
  }

  if (Number(idUserBloqueur) === Number(idUserBloque)) {
    return { succes: false, erreur: 'Vous ne pouvez pas vous bloquer vous-même.' };
  }

  const cible = db.prepare('SELECT idUser FROM Utilisateur WHERE idUser = ?').get(idUserBloque);
  if (!cible) {
    return { succes: false, erreur: 'Utilisateur introuvable.' };
  }

  const dejaBloque = db.prepare(
    'SELECT 1 FROM Blocage WHERE idUserBloqueur = ? AND idUserBloque = ?'
  ).get(idUserBloqueur, idUserBloque);

  if (dejaBloque) {
    return { succes: true, message: 'Utilisateur déjà bloqué.' };
  }

  const transaction = db.transaction(() => {
    // 1. Enregistrement du blocage
    db.prepare(
      'INSERT INTO Blocage (idUserBloqueur, idUserBloque) VALUES (?, ?)'
    ).run(idUserBloqueur, idUserBloque);

    // 2. Rupture réciproque des abonnements et relations d’amis
    db.prepare(`
      DELETE FROM Abonnement 
      WHERE (idUserAbonne = ? AND idUserSuivi = ?) 
         OR (idUserAbonne = ? AND idUserSuivi = ?)
    `).run(idUserBloqueur, idUserBloque, idUserBloque, idUserBloqueur);
  });

  transaction();

  return { succes: true };
}

/**
 * Retire le blocage d'un utilisateur cible.
 */
function debloquerUtilisateur(idUserBloqueur, idUserBloque, db = dbInstance) {
  if (!Number.isInteger(idUserBloque) || idUserBloque <= 0) {
    return { succes: false, erreur: 'Identifiant utilisateur invalide.' };
  }

  db.prepare(
    'DELETE FROM Blocage WHERE idUserBloqueur = ? AND idUserBloque = ?'
  ).run(idUserBloqueur, idUserBloque);

  return { succes: true };
}

/**
 * Liste l'ensemble des comptes bloqués par un utilisateur (avec date).
 */
function listerBloques(idUserBloqueur, db = dbInstance) {
  return db.prepare(`
    SELECT u.idUser, u.pseudo, b.dateBlocage
    FROM Blocage b
    JOIN Utilisateur u ON b.idUserBloque = u.idUser
    WHERE b.idUserBloqueur = ?
    ORDER BY b.dateBlocage DESC
  `).all(idUserBloqueur);
}

/**
 * Vérifie l'état de blocage bilatéral entre deux comptes.
 */
function estBloque(idUserA, idUserB, db = dbInstance) {
  if (!idUserA || !idUserB) {
    return { jeLuiBloque: false, ilMeBloque: false };
  }

  const jeLuiBloque = !!db.prepare(
    'SELECT 1 FROM Blocage WHERE idUserBloqueur = ? AND idUserBloque = ?'
  ).get(idUserA, idUserB);

  const ilMeBloque = !!db.prepare(
    'SELECT 1 FROM Blocage WHERE idUserBloqueur = ? AND idUserBloque = ?'
  ).get(idUserB, idUserA);

  return { jeLuiBloque, ilMeBloque };
}

module.exports = {
  bloquerUtilisateur,
  debloquerUtilisateur,
  listerBloques,
  estBloque
};