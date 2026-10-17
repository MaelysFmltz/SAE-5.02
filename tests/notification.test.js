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
});

afterEach(() => {
  db.exec('DELETE FROM Notification');
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

  test('crée une notification de nouveau message', () => {
    notificationService.creerNotification(dave, alice, 'message', 5);

    expect(lignesNotification(dave)[0]).toMatchObject({
      type: 'message',
      idSource: 5
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

  test('autorise plusieurs messages de la même personne', () => {
    notificationService.creerNotification(dave, alice, 'message', 5);
    notificationService.creerNotification(dave, alice, 'message', 5);

    expect(lignesNotification(dave)).toHaveLength(2);
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

  test('groupe les messages d\'une conversation et en indique le nombre', async () => {
    notificationService.creerNotification(dave, alice, 'message', 5);
    notificationService.creerNotification(dave, alice, 'message', 5);
    notificationService.creerNotification(dave, alice, 'message', 5);

    const liste = await notificationService.getMyNotifications(dave);

    expect(liste).toHaveLength(1);
    expect(liste[0].texte).toBe('alice vous a envoyé 3 messages');
    expect(liste[0].lien).toBe('/messages/5');
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
    expect(res.body).toEqual({ count: 1 });
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
    expect(count.body).toEqual({ count: 0 });
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