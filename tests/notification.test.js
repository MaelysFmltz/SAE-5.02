/**
 * Tests de la fonctionnalité de notifications.
 * Couvre : la création (types, doublons, auto-notification), le regroupement
 * par événement, le comptage et le marquage en lu, l'API HTTP, et le
 * déclenchement depuis friendshipService.suivre.
 * La base est en mémoire (comme auth.test.js) : elle repart de zéro à chaque test.
 */
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-de-test-uniquement';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const db = require('../src/config/database');
const { seedSchema } = require('./testDb');
const notificationService = require('../src/services/notificationService');
const friendshipService = require('../src/services/friendshipService');
const messageService = require('../src/services/messageService');

let alice, bob, carla, dave;

/**
 * Insère directement un utilisateur en base (plus simple que de passer par
 * l'inscription, qui hache un mot de passe et valide les champs)
 */
function creerUtilisateur(pseudo) {
  const info = db.prepare(
    'INSERT INTO Utilisateur (pseudo, email, motDePasse) VALUES (?, ?, ?)'
  ).run(pseudo, `${pseudo}@test.com`, 'hash-bidon');
  return Number(info.lastInsertRowid);
}

/**
 * Fabrique un token valide pour authMiddleware (même secret que l'app)
 */
function tokenPour(idUser, pseudo) {
  return jwt.sign({ idUser, pseudo, role: 'user' }, process.env.JWT_SECRET, {
    expiresIn: '1h'
  });
}

function lignesNotification(idUser) {
  return db.prepare('SELECT * FROM Notification WHERE idUser = ?').all(idUser);
}

beforeAll(() => {
  seedSchema(db);
});

beforeEach(() => {
  alice = creerUtilisateur('alice');
  bob = creerUtilisateur('bob');
  carla = creerUtilisateur('carla');
  dave = creerUtilisateur('dave');
  // Publications 10 et 11 réelles : les notifications vers une publication supprimée sont ignorées
  db.prepare("INSERT INTO Publication (idPubli, idUser, contenuPub) VALUES (10, ?, 'p10'), (11, ?, 'p11')").run(dave, dave);
});

afterEach(() => {
  db.exec('DELETE FROM Notification');
  db.exec('DELETE FROM Conversation');
  db.exec('DELETE FROM Utilisateur');
});

afterAll(() => {
  db.close();
});

describe('Création des notifications', () => {
  test('crée une notification de nouvel abonné', () => {
    const id = notificationService.creerNotification(dave, alice, 'nouvel_abonne');

    expect(id).toBeTruthy();
    const lignes = lignesNotification(dave);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({
      idUser: dave,
      idActeur: alice,
      type: 'nouvel_abonne',
      idSource: null,
      lu: 0
    });
  });

  test('crée une notification de like', () => {
    notificationService.creerNotification(dave, alice, 'like', 10);

    const lignes = lignesNotification(dave);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ type: 'like', idSource: 10, idActeur: alice });
  });

  test('crée une notification de commentaire', () => {
    notificationService.creerNotification(dave, alice, 'commentaire', 10);

    expect(lignesNotification(dave)[0]).toMatchObject({
      type: 'commentaire',
      idSource: 10
    });
  });

  test('ne notifie pas quelqu\'un de ses propres actions', () => {
    const id = notificationService.creerNotification(alice, alice, 'like', 10);

    expect(id).toBeNull();
    expect(lignesNotification(alice)).toHaveLength(0);
  });

  test('ne crée pas de doublon pour un même like de la même personne', () => {
    notificationService.creerNotification(dave, alice, 'like', 10);
    const second = notificationService.creerNotification(dave, alice, 'like', 10);

    expect(second).toBeNull();
    expect(lignesNotification(dave)).toHaveLength(1);
  });

  test('un type inconnu ne plante pas et ne crée rien', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const id = notificationService.creerNotification(dave, alice, 'type_bidon', 1);

    expect(id).toBeNull();
    expect(lignesNotification(dave)).toHaveLength(0);
    spy.mockRestore();
  });

  test('un destinataire inexistant ne plante pas (une notification ratée ne casse rien)', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const id = notificationService.creerNotification(99999, alice, 'like', 1);

    expect(id).toBeNull();
    spy.mockRestore();
  });
});

describe('Regroupement par événement', () => {
  test('groupe les likes d\'une même publication en une seule ligne', async () => {
    notificationService.creerNotification(dave, alice, 'like', 10);
    notificationService.creerNotification(dave, bob, 'like', 10);
    notificationService.creerNotification(dave, carla, 'like', 10);

    const liste = await notificationService.getMyNotifications(dave);

    expect(liste).toHaveLength(1);
    expect(liste[0].nombre).toBe(3);
    expect(liste[0].nbActeurs).toBe(3);
    expect(liste[0].texte).toBe('carla et 2 autres ont aimé votre publication');
  });

  test('sépare les likes de deux publications différentes', async () => {
    notificationService.creerNotification(dave, alice, 'like', 10);
    notificationService.creerNotification(dave, alice, 'like', 11);

    const liste = await notificationService.getMyNotifications(dave);

    expect(liste).toHaveLength(2);
  });

  test('utilise le singulier quand une seule personne agit', async () => {
    notificationService.creerNotification(dave, alice, 'like', 10);

    const liste = await notificationService.getMyNotifications(dave);

    expect(liste[0].texte).toBe('alice a aimé votre publication');
  });

  test('une même personne qui commente 3 fois compte pour 1 seul acteur', async () => {
    notificationService.creerNotification(dave, alice, 'commentaire', 10);
    notificationService.creerNotification(dave, alice, 'commentaire', 10);
    notificationService.creerNotification(dave, alice, 'commentaire', 10);

    const liste = await notificationService.getMyNotifications(dave);

    expect(liste).toHaveLength(1);
    expect(liste[0].nombre).toBe(3);
    expect(liste[0].nbActeurs).toBe(1);
    expect(liste[0].texte).toBe('alice a commenté votre publication');
  });

  test('construit les bons liens', async () => {
    notificationService.creerNotification(dave, alice, 'nouvel_abonne');
    notificationService.creerNotification(dave, bob, 'like', 10);

    const liste = await notificationService.getMyNotifications(dave);
    const parType = Object.fromEntries(liste.map((n) => [n.type, n.lien]));

    expect(parType.nouvel_abonne).toBe('/profile/alice');
    expect(parType.like).toBe('/publication/10');
  });

  test('ne renvoie que les notifications de l\'utilisateur demandé', async () => {
    notificationService.creerNotification(dave, alice, 'like', 10);
    notificationService.creerNotification(bob, alice, 'like', 10);

    const liste = await notificationService.getMyNotifications(dave);

    expect(liste).toHaveLength(1);
  });
});

describe('Lecture et marquage en lu', () => {
  beforeEach(() => {
    notificationService.creerNotification(dave, alice, 'like', 10);
    notificationService.creerNotification(dave, bob, 'like', 10);
    notificationService.creerNotification(dave, carla, 'nouvel_abonne');
  });

  test('compte les groupes non lus (pas les notifications une par une)', async () => {
    expect(await notificationService.countUnread(dave)).toBe(2);
  });

  test('marque un groupe comme lu sans toucher aux autres', async () => {
    await notificationService.markAsRead(dave, 'like', 10);

    expect(await notificationService.countUnread(dave)).toBe(1);
  });

  test('marque tout comme lu', async () => {
    await notificationService.markAllAsRead(dave);

    expect(await notificationService.countUnread(dave)).toBe(0);
  });

  test('refuse un type de notification invalide', async () => {
    await expect(
      notificationService.markAsRead(dave, 'type_bidon', 10)
    ).rejects.toThrow('Type de notification invalide');
  });

  test('refuse un identifiant de source invalide', async () => {
    await expect(
      notificationService.markAsRead(dave, 'like', 'abc')
    ).rejects.toThrow('Identifiant de source invalide');
  });
});

describe('API /api/notifications', () => {
  test('refuse l\'accès sans token', async () => {
    const res = await request(app).get('/api/notifications');

    expect(res.status).toBe(401);
  });

  test('renvoie les notifications de l\'utilisateur connecté', async () => {
    notificationService.creerNotification(dave, alice, 'like', 10);

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenPour(dave, 'dave')}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].texte).toBe('alice a aimé votre publication');
  });

  test('un utilisateur ne voit pas les notifications d\'un autre', async () => {
    notificationService.creerNotification(dave, alice, 'like', 10);

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenPour(bob, 'bob')}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('renvoie le nombre de notifications non lues', async () => {
    notificationService.creerNotification(dave, alice, 'like', 10);

    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenPour(dave, 'dave')}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 1, messages: 0 });
  });

  test('PUT /read marque tout comme lu', async () => {
    notificationService.creerNotification(dave, alice, 'like', 10);
    const token = tokenPour(dave, 'dave');

    const put = await request(app)
      .put('/api/notifications/read')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(put.status).toBe(200);

    const count = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);
    expect(count.body).toEqual({ count: 0, messages: 0 });
  });

  test('PUT /read refuse un type invalide', async () => {
    const res = await request(app)
      .put('/api/notifications/read')
      .set('Authorization', `Bearer ${tokenPour(dave, 'dave')}`)
      .send({ type: 'type_bidon' });

    expect(res.status).toBe(400);
  });
});

describe('Déclenchement depuis friendshipService.suivre', () => {
  test('suivre quelqu\'un crée une notification pour la personne suivie', () => {
    friendshipService.suivre(db, alice, dave);

    const lignes = lignesNotification(dave);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ type: 'nouvel_abonne', idActeur: alice });
  });

  test('suivre deux fois ne crée qu\'une seule notification', () => {
    friendshipService.suivre(db, alice, dave);
    friendshipService.suivre(db, alice, dave);

    expect(lignesNotification(dave)).toHaveLength(1);
  });

  test('se réabonner après s\'être désabonné ne recrée pas de notification', () => {
    friendshipService.suivre(db, alice, dave);
    friendshipService.neplusSuivre(db, alice, dave);
    friendshipService.suivre(db, alice, dave);

    expect(lignesNotification(dave)).toHaveLength(1);
  });

  test('ne notifie personne si on tente de se suivre soi-même', () => {
    friendshipService.suivre(db, alice, alice);

    expect(lignesNotification(alice)).toHaveLength(0);
  });
});

describe('notifierLike et notifierCommentaire', () => {
  function creerPublication(idUser) {
    const info = db.prepare(
      'INSERT INTO Publication (idUser, contenuPub) VALUES (?, ?)'
    ).run(idUser, 'une publication');
    return Number(info.lastInsertRowid);
  }

  function creerCommentaire(idUser, idPubli, idParent = null) {
    const info = db.prepare(
      'INSERT INTO Commentaire (idUser, idPubli, idParent, contenuCom) VALUES (?, ?, ?, ?)'
    ).run(idUser, idPubli, idParent, 'un commentaire');
    return Number(info.lastInsertRowid);
  }

  function creerReaction(idUser, idPubli, estLike) {
    db.prepare(
      'INSERT INTO LikeDislike (idUser, idPubli, estLike) VALUES (?, ?, ?)'
    ).run(idUser, idPubli, estLike);
  }

  function creerReactionCommentaire(idUser, idComm, estLike) {
    db.prepare(
      'INSERT INTO LikeCommentaire (idUser, idComm, estLike) VALUES (?, ?, ?)'
    ).run(idUser, idComm, estLike);
  }

  test('un like notifie l\'auteur de la publication', () => {
    const idPubli = creerPublication(dave);
    creerReaction(alice, idPubli, 1);

    notificationService.notifierLike(idPubli, alice);

    expect(lignesNotification(dave)[0]).toMatchObject({
      type: 'like',
      idActeur: alice,
      idSource: idPubli
    });
  });

  test('un dislike ne notifie personne', () => {
    const idPubli = creerPublication(dave);
    creerReaction(alice, idPubli, 0);

    notificationService.notifierLike(idPubli, alice);

    expect(lignesNotification(dave)).toHaveLength(0);
  });

  test('un like retiré (plus aucune réaction) ne notifie personne', () => {
    const idPubli = creerPublication(dave);

    notificationService.notifierLike(idPubli, alice);

    expect(lignesNotification(dave)).toHaveLength(0);
  });

  test('un like de commentaire notifie l\'auteur du commentaire', async () => {
    const idPubli = creerPublication(dave);
    const idComm = creerCommentaire(bob, idPubli);
    creerReactionCommentaire(alice, idComm, 1);

    notificationService.notifierLikeCommentaire(idComm, alice);

    expect(lignesNotification(bob)[0]).toMatchObject({
      type: 'like_commentaire',
      idActeur: alice,
      idSource: idPubli
    });
    expect(lignesNotification(dave)).toHaveLength(0);

    const liste = await notificationService.getMyNotifications(bob);
    expect(liste[0].texte).toBe('alice a aimé votre commentaire');
    expect(liste[0].lien).toBe(`/publication/${idPubli}`);
  });

  test('un dislike ou un like retiré sur un commentaire ne notifie personne', () => {
    const idPubli = creerPublication(dave);
    const idComm = creerCommentaire(bob, idPubli);

    notificationService.notifierLikeCommentaire(idComm, alice);
    creerReactionCommentaire(carla, idComm, 0);
    notificationService.notifierLikeCommentaire(idComm, carla);

    expect(lignesNotification(bob)).toHaveLength(0);
  });

  test('liker son propre commentaire ne notifie personne', () => {
    const idPubli = creerPublication(dave);
    const idComm = creerCommentaire(bob, idPubli);
    creerReactionCommentaire(bob, idComm, 1);

    notificationService.notifierLikeCommentaire(idComm, bob);

    expect(lignesNotification(bob)).toHaveLength(0);
  });

  test('un commentaire notifie l\'auteur de la publication', () => {
    const idPubli = creerPublication(dave);

    notificationService.notifierCommentaire(idPubli, alice);

    expect(lignesNotification(dave)[0]).toMatchObject({
      type: 'commentaire',
      idSource: idPubli
    });
  });

  test('une réponse notifie l\'auteur du commentaire parent, pas celui de la publication', () => {
    const idPubli = creerPublication(dave);
    const idParent = creerCommentaire(bob, idPubli);

    notificationService.notifierCommentaire(idPubli, alice, idParent);

    expect(lignesNotification(bob)[0]).toMatchObject({
      type: 'reponse_commentaire',
      idActeur: alice,
      idSource: idPubli
    });
    expect(lignesNotification(dave)).toHaveLength(0);
  });

  test('commenter sa propre publication ne notifie personne', () => {
    const idPubli = creerPublication(dave);

    notificationService.notifierCommentaire(idPubli, dave);

    expect(lignesNotification(dave)).toHaveLength(0);
  });

  test('une publication inexistante ne plante pas', () => {
    expect(() => notificationService.notifierLike(99999, alice)).not.toThrow();
  });
});

describe('Messages non lus (pastille Messagerie)', () => {
  function creerConversation(idUsers, dateRejoint = null) {
    const info = db.prepare('INSERT INTO Conversation (titreGroupe) VALUES (NULL)').run();
    const idConversation = Number(info.lastInsertRowid);
    idUsers.forEach((idUser) => {
      if (dateRejoint) {
        db.prepare(
          'INSERT INTO ConversationMembre (idConversation, idUser, dateRejoint) VALUES (?, ?, ?)'
        ).run(idConversation, idUser, dateRejoint);
      } else {
        db.prepare(
          'INSERT INTO ConversationMembre (idConversation, idUser) VALUES (?, ?)'
        ).run(idConversation, idUser);
      }
    });
    return idConversation;
  }

  function envoyerMessage(idConversation, idUser) {
    db.prepare(
      'INSERT INTO Message (idConversation, idUser, contenu) VALUES (?, ?, ?)'
    ).run(idConversation, idUser, 'salut');
  }

  test('compte les conversations avec des messages non lus reçus', async () => {
    const conv1 = creerConversation([alice, dave]);
    const conv2 = creerConversation([bob, dave]);
    envoyerMessage(conv1, alice);
    envoyerMessage(conv1, alice);
    envoyerMessage(conv2, bob);

    expect(await notificationService.countUnreadMessages(dave)).toBe(2);
  });

  test('ne compte pas ses propres messages', async () => {
    const conv = creerConversation([alice, dave]);
    envoyerMessage(conv, alice);

    expect(await notificationService.countUnreadMessages(alice)).toBe(0);
  });

  test('ne compte plus une conversation une fois ouverte', async () => {
    const conv = creerConversation([alice, dave]);
    envoyerMessage(conv, alice);

    await messageService.markAsRead(conv, dave);

    expect(await notificationService.countUnreadMessages(dave)).toBe(0);
  });

  test('un nouveau message après lecture redonne une pastille', async () => {
    const conv = creerConversation([alice, dave]);
    envoyerMessage(conv, alice);
    await messageService.markAsRead(conv, dave);

    envoyerMessage(conv, alice);

    expect(await notificationService.countUnreadMessages(dave)).toBe(1);
  });

  test('dans un groupe, lire la conversation ne la marque lue que pour soi', async () => {
    const conv = creerConversation([alice, bob, carla]);
    envoyerMessage(conv, alice);

    await messageService.markAsRead(conv, bob);

    expect(await notificationService.countUnreadMessages(bob)).toBe(0);
    expect(await notificationService.countUnreadMessages(carla)).toBe(1);
  });

  test('un membre arrivé après l\'envoi ne voit pas les anciens messages comme non lus', async () => {
    const conv = creerConversation([alice, dave], '2999-01-01 00:00:00');
    envoyerMessage(conv, alice);

    expect(await notificationService.countUnreadMessages(dave)).toBe(0);
  });

  test('ne compte pas les conversations dont on n\'est pas membre', async () => {
    const conv = creerConversation([alice, dave]);
    envoyerMessage(conv, alice);

    expect(await notificationService.countUnreadMessages(carla)).toBe(0);
  });

  test('l\'API renvoie aussi le nombre de conversations non lues', async () => {
    const conv = creerConversation([alice, dave]);
    envoyerMessage(conv, alice);

    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenPour(dave, 'dave')}`);

    expect(res.body).toEqual({ count: 0, messages: 1 });
  });
});

describe('Sécurité : blocages, visibilité et publications supprimées', () => {
  function bloquer(idBloqueur, idBloque) {
    db.prepare('INSERT INTO Blocage (idUserBloqueur, idUserBloque) VALUES (?, ?)').run(idBloqueur, idBloque);
  }

  function creerCommentaire(idUser, idPubli) {
    const info = db.prepare(
      'INSERT INTO Commentaire (idUser, idPubli, contenuCom) VALUES (?, ?, ?)'
    ).run(idUser, idPubli, 'un commentaire');
    return Number(info.lastInsertRowid);
  }

  afterEach(() => {
    db.exec('DELETE FROM Blocage');
  });

  test('aucune notification entre deux utilisateurs bloqués (dans les deux sens)', () => {
    bloquer(dave, alice);

    expect(notificationService.creerNotification(dave, alice, 'like', 10)).toBeNull();
    expect(notificationService.creerNotification(alice, dave, 'nouvel_abonne')).toBeNull();
    expect(lignesNotification(dave)).toHaveLength(0);
    expect(lignesNotification(alice)).toHaveLength(0);
  });

  test('un utilisateur bloqué ne peut pas suivre celui qui l\'a bloqué', () => {
    bloquer(dave, alice);

    expect(friendshipService.suivre(db, alice, dave)).toBe(false);
    expect(lignesNotification(dave)).toHaveLength(0);
  });

  test('API : un utilisateur bloqué ne peut pas répondre au commentaire de celui qui l\'a bloqué', async () => {
    const idComm = creerCommentaire(bob, 10);
    bloquer(bob, alice);

    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${tokenPour(alice, 'alice')}`)
      .set('Accept', 'application/json')
      .send({ idPubli: 10, idParent: idComm, contenuCom: 'coucou' });

    expect(res.status).toBe(403);
    expect(lignesNotification(bob)).toHaveLength(0);
  });

  test('API : un utilisateur bloqué ne peut pas liker le commentaire de celui qui l\'a bloqué', async () => {
    const idComm = creerCommentaire(bob, 10);
    bloquer(bob, alice);

    const res = await request(app)
      .post(`/api/comments/${idComm}/react`)
      .set('Authorization', `Bearer ${tokenPour(alice, 'alice')}`)
      .send({ type: 'LIKE' });

    expect(res.status).toBe(403);
    expect(lignesNotification(bob)).toHaveLength(0);
  });

  test('API : impossible de liker ou commenter une publication privée sans être ami', async () => {
    db.prepare('UPDATE Publication SET visibilite = 0 WHERE idPubli = 10').run();
    const token = tokenPour(alice, 'alice');

    const like = await request(app)
      .post('/api/comments/react')
      .set('Authorization', `Bearer ${token}`)
      .send({ idPubli: 10, type: 'LIKE' });
    const commentaire = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json')
      .send({ idPubli: 10, contenuCom: 'je ne devrais pas voir ça' });

    expect(like.status).toBe(404);
    expect(commentaire.status).toBe(404);
    expect(lignesNotification(dave)).toHaveLength(0);
  });

  test('API : liker une publication inexistante renvoie 404 (et non 500)', async () => {
    const res = await request(app)
      .post('/api/comments/react')
      .set('Authorization', `Bearer ${tokenPour(alice, 'alice')}`)
      .send({ idPubli: 99999, type: 'LIKE' });

    expect(res.status).toBe(404);
  });

  test('les notifications d\'une publication supprimée ne sont plus affichées ni comptées', async () => {
    notificationService.creerNotification(dave, alice, 'like', 10);
    notificationService.creerNotification(dave, bob, 'like', 11);
    db.prepare('DELETE FROM Publication WHERE idPubli = 10').run();

    const liste = await notificationService.getMyNotifications(dave);
    expect(liste).toHaveLength(1);
    expect(liste[0].idSource).toBe(11);
    expect(await notificationService.countUnread(dave)).toBe(1);
  });

  test('API : une erreur interne ne renvoie pas le détail SQL au client', async () => {
    const espion = jest.spyOn(notificationService, 'getMyNotifications').mockRejectedValue(new Error('no such column: n.idActeur'));
    const console_ = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenPour(dave, 'dave')}`);

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/idActeur|column/);
    espion.mockRestore();
    console_.mockRestore();
  });
});
