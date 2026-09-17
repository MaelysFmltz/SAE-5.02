process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-de-test-uniquement';

/**
 * Tests d'intégration pour la messagerie instantanée.
 * Couvre : création de conversation (directe + groupe), envoi de messages,
 * récupération de l'historique, marquage en lu, ajout de participants,
 * et contrôle d'accès (seuls les membres d'une conversation peuvent y agir).
 */

const request = require('supertest');

const app = require('../src/app');
const db = require('../src/config/database');
const { seedSchema } = require('./testDb');

beforeAll(() => {
  seedSchema(db);
});

afterEach(() => {
  db.exec('DELETE FROM Message');
  db.exec('DELETE FROM ConversationMembre');
  db.exec('DELETE FROM Conversation');
  db.exec('DELETE FROM Profil');
  db.exec('DELETE FROM Utilisateur');
});

afterAll(() => {
  db.close();
});

async function creerCompteEtConnecter(pseudo, email) {
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({
      pseudo,
      email,
      motDePasse: 'Motdepasse1!',
      dateNaissance: '2000-01-01'
    });

  expect(registerRes.status).toBe(201);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, motDePasse: 'Motdepasse1!' });

  expect(loginRes.status).toBe(200);

  return {
    token: loginRes.body.token,
    idUser: loginRes.body.user.idUser
  };
}

describe('Messagerie - conversations directes', () => {
  test('crée une conversation directe entre A et B', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');

    const res = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ idUserDestinataire: b.idUser });

    expect(res.status).toBe(201);
    expect(res.body.idConversation).toEqual(expect.any(Number));
  });

  test('réutilise la conversation existante au lieu d’en créer une nouvelle', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');

    const res1 = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ idUserDestinataire: b.idUser });

    const res2 = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ idUserDestinataire: a.idUser });

    expect(res2.status).toBe(201);
    expect(res2.body.idConversation).toBe(res1.body.idConversation);
  });

  test('refuse de démarrer une conversation avec un destinataire inexistant', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');

    const res = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ idUserDestinataire: 999999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/introuvable/i);
  });

  test('refuse de démarrer une conversation avec soi-même', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');

    const res = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ idUserDestinataire: a.idUser });

    expect(res.status).toBe(400);
  });

  test('refuse une requête sans authentification', async () => {
    const res = await request(app)
      .post('/api/conversations/direct')
      .send({ idUserDestinataire: 1 });

    expect(res.status).toBe(401);
  });
});

describe('Messagerie - envoi et lecture des messages', () => {
  async function creerConversationDirecte(tokenA, idUserB) {
    const res = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ idUserDestinataire: idUserB });

    return res.body.idConversation;
  }

  test('A envoie un message et B le récupère dans l’historique', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const idConversation = await creerConversationDirecte(a.token, b.idUser);

    const envoiRes = await request(app)
      .post(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ contenu: 'Salut B !' });

    expect(envoiRes.status).toBe(201);
    expect(envoiRes.body.contenu).toBe('Salut B !');
    // Régression : la réponse doit inclure dateEnvoi pour que le front
    // puisse afficher l'heure sans recharger la page (sinon "Invalid Date").
    expect(envoiRes.body.dateEnvoi).toEqual(expect.any(String));
    expect(new Date(envoiRes.body.dateEnvoi).toString()).not.toBe('Invalid Date');

    const historiqueRes = await request(app)
      .get(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${b.token}`);

    expect(historiqueRes.status).toBe(200);
    expect(historiqueRes.body.some((m) => m.contenu === 'Salut B !')).toBe(true);
  });

  test('refuse l’envoi d’un message vide', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const idConversation = await creerConversationDirecte(a.token, b.idUser);

    const res = await request(app)
      .post(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ contenu: '   ' });

    expect(res.status).toBe(400);
  });

  test('refuse l’envoi d’un message composé uniquement de balises HTML vides', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const idConversation = await creerConversationDirecte(a.token, b.idUser);

    const res = await request(app)
      .post(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ contenu: '<b></b>' });

    expect(res.status).toBe(400);
  });

  test('nettoie les balises HTML d’un message sans le vider entièrement', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const idConversation = await creerConversationDirecte(a.token, b.idUser);

    const res = await request(app)
      .post(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ contenu: 'coucou <b>toi</b>' });

    expect(res.status).toBe(201);
    expect(res.body.contenu).toBe('coucou toi');
  });

  test('refuse l’envoi d’un message par un non-membre de la conversation', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');
    const idConversation = await creerConversationDirecte(a.token, b.idUser);

    const res = await request(app)
      .post(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${c.token}`)
      .send({ contenu: 'Je ne fais pas partie de cette conversation' });

    expect(res.status).toBe(403);
  });

  test('refuse la lecture de l’historique par un non-membre', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');
    const idConversation = await creerConversationDirecte(a.token, b.idUser);

    const res = await request(app)
      .get(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${c.token}`);

    expect(res.status).toBe(403);
  });

  test('marque une conversation comme lue', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const idConversation = await creerConversationDirecte(a.token, b.idUser);

    await request(app)
      .post(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ contenu: 'Salut B !' });

    const listeAvant = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${b.token}`);

    expect(listeAvant.body.find((c) => c.idConversation === idConversation).nonLu).toBeTruthy();

    const lectureRes = await request(app)
      .put(`/api/conversations/${idConversation}/read`)
      .set('Authorization', `Bearer ${b.token}`);

    expect(lectureRes.status).toBe(200);

    const listeApres = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${b.token}`);

    expect(listeApres.body.find((c) => c.idConversation === idConversation).nonLu).toBeFalsy();
  });

  test('affiche le pseudo de l’autre membre dans la liste des conversations directes', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const idConversation = await creerConversationDirecte(a.token, b.idUser);

    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${a.token}`);

    const conv = res.body.find((c) => c.idConversation === idConversation);
    expect(conv.autrePseudo).toBe('msguserb');
  });
});

describe('Messagerie - conversations de groupe', () => {
  test('crée une conversation de groupe avec plusieurs membres', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const res = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Le trio' });

    expect(res.status).toBe(201);

    const messagesRes = await request(app)
      .post(`/api/conversations/${res.body.idConversation}/messages`)
      .set('Authorization', `Bearer ${c.token}`)
      .send({ contenu: 'Coucou le groupe' });

    expect(messagesRes.status).toBe(201);
  });

  test('refuse un groupe avec moins de 2 autres membres', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');

    const res = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser], titreGroupe: 'Trop petit' });

    expect(res.status).toBe(400);
  });

  test('crée un groupe sans titre : le titre par défaut est "Nouveau groupe"', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser] });

    expect(createRes.status).toBe(201);

    const listeRes = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${a.token}`);

    const conv = listeRes.body.find((c2) => c2.idConversation === createRes.body.idConversation);
    expect(conv.titreGroupe).toBe('Nouveau groupe');
  });

  test('le créateur du groupe est identifié dans la liste des membres', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Groupe' });

    const res = await request(app)
      .get(`/api/conversations/${createRes.body.idConversation}/members`)
      .set('Authorization', `Bearer ${b.token}`);

    expect(res.status).toBe(200);
    const createur = res.body.membres.find((m) => m.idUser === a.idUser);
    const autre = res.body.membres.find((m) => m.idUser === b.idUser);
    expect(createur.estCreateur).toBeTruthy();
    expect(autre.estCreateur).toBeFalsy();
  });

  test('le créateur peut ajouter un participant à un groupe', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');
    const d = await creerCompteEtConnecter('msguserD', 'msguserD@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Groupe' });

    const idConversation = createRes.body.idConversation;

    const addRes = await request(app)
      .post(`/api/conversations/${idConversation}/members`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ idUsers: [d.idUser] });

    expect(addRes.status).toBe(200);
    expect(addRes.body.membres.some((m) => m.idUser === d.idUser)).toBe(true);

    const dEnvoiRes = await request(app)
      .post(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${d.token}`)
      .send({ contenu: 'Je viens d’être ajouté' });

    expect(dEnvoiRes.status).toBe(201);
  });

  test('refuse l’ajout d’un participant par un membre qui n’est pas le créateur', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');
    const d = await creerCompteEtConnecter('msguserD', 'msguserD@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Groupe' });

    const res = await request(app)
      .post(`/api/conversations/${createRes.body.idConversation}/members`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ idUsers: [d.idUser] });

    expect(res.status).toBe(403);
  });

  test('refuse l’ajout d’un participant par un non-membre du groupe', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');
    const intrus = await creerCompteEtConnecter('msguserIntrus', 'msgintrus@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Groupe' });

    const res = await request(app)
      .post(`/api/conversations/${createRes.body.idConversation}/members`)
      .set('Authorization', `Bearer ${intrus.token}`)
      .send({ idUsers: [intrus.idUser] });

    expect(res.status).toBe(403);
  });

  test('refuse l’ajout de participants à une conversation directe', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const directRes = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ idUserDestinataire: b.idUser });

    const res = await request(app)
      .post(`/api/conversations/${directRes.body.idConversation}/members`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ idUsers: [c.idUser] });

    expect(res.status).toBe(400);
  });

  test('refuse d’ajouter un utilisateur inexistant à un groupe', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Groupe' });

    const res = await request(app)
      .post(`/api/conversations/${createRes.body.idConversation}/members`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ idUsers: [999999] });

    expect(res.status).toBe(404);
  });

  test('le créateur peut retirer un participant du groupe', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Groupe' });

    const idConversation = createRes.body.idConversation;

    const removeRes = await request(app)
      .delete(`/api/conversations/${idConversation}/members/${c.idUser}`)
      .set('Authorization', `Bearer ${a.token}`);

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.membres.some((m) => m.idUser === c.idUser)).toBe(false);

    const cEnvoiRes = await request(app)
      .post(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${c.token}`)
      .send({ contenu: 'Je ne devrais plus pouvoir écrire ici' });

    expect(cEnvoiRes.status).toBe(403);
  });

  test('refuse le retrait d’un participant par un membre qui n’est pas le créateur', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Groupe' });

    const res = await request(app)
      .delete(`/api/conversations/${createRes.body.idConversation}/members/${c.idUser}`)
      .set('Authorization', `Bearer ${b.token}`);

    expect(res.status).toBe(403);
  });

  test('refuse que le créateur se retire lui-même du groupe', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Groupe' });

    const res = await request(app)
      .delete(`/api/conversations/${createRes.body.idConversation}/members/${a.idUser}`)
      .set('Authorization', `Bearer ${a.token}`);

    expect(res.status).toBe(400);
  });

  test('le créateur peut renommer le groupe', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Ancien nom' });

    const renameRes = await request(app)
      .put(`/api/conversations/${createRes.body.idConversation}`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ titreGroupe: 'Nouveau nom' });

    expect(renameRes.status).toBe(200);
    expect(renameRes.body.titreGroupe).toBe('Nouveau nom');

    const listeRes = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${b.token}`);

    const conv = listeRes.body.find((c2) => c2.idConversation === createRes.body.idConversation);
    expect(conv.titreGroupe).toBe('Nouveau nom');
  });

  test('refuse le renommage par un membre qui n’est pas le créateur', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Ancien nom' });

    const res = await request(app)
      .put(`/api/conversations/${createRes.body.idConversation}`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ titreGroupe: 'Piraté' });

    expect(res.status).toBe(403);
  });

  test('refuse le renommage d’une conversation directe', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');

    const directRes = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ idUserDestinataire: b.idUser });

    const res = await request(app)
      .put(`/api/conversations/${directRes.body.idConversation}`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ titreGroupe: 'Impossible' });

    expect(res.status).toBe(400);
  });
});

describe('Messagerie - suppression de conversations et de groupes', () => {
  test('n’importe quel membre peut supprimer une conversation directe pour de bon', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');

    const directRes = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ idUserDestinataire: b.idUser });

    const idConversation = directRes.body.idConversation;

    const deleteRes = await request(app)
      .delete(`/api/conversations/${idConversation}`)
      .set('Authorization', `Bearer ${b.token}`);

    expect(deleteRes.status).toBe(200);

    // La conversation n'existe plus, pour aucun des deux membres
    const listeA = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${a.token}`);
    const listeB = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${b.token}`);

    expect(listeA.body.some((c) => c.idConversation === idConversation)).toBe(false);
    expect(listeB.body.some((c) => c.idConversation === idConversation)).toBe(false);
  });

  test('refuse de supprimer une conversation dont on n’est pas membre', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const directRes = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ idUserDestinataire: b.idUser });

    const res = await request(app)
      .delete(`/api/conversations/${directRes.body.idConversation}`)
      .set('Authorization', `Bearer ${c.token}`);

    expect(res.status).toBe(403);
  });

  test('le chef peut supprimer le groupe pour tout le monde', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Groupe' });

    const idConversation = createRes.body.idConversation;

    const deleteRes = await request(app)
      .delete(`/api/conversations/${idConversation}`)
      .set('Authorization', `Bearer ${a.token}`);

    expect(deleteRes.status).toBe(200);

    const listeB = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${b.token}`);

    expect(listeB.body.some((c2) => c2.idConversation === idConversation)).toBe(false);
  });

  test('refuse la suppression du groupe par un membre qui n’est pas le créateur', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Groupe' });

    const res = await request(app)
      .delete(`/api/conversations/${createRes.body.idConversation}`)
      .set('Authorization', `Bearer ${b.token}`);

    expect(res.status).toBe(403);
  });

  test('un membre non-chef peut quitter le groupe, qui continue d’exister pour les autres', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Groupe' });

    const idConversation = createRes.body.idConversation;

    const leaveRes = await request(app)
      .post(`/api/conversations/${idConversation}/leave`)
      .set('Authorization', `Bearer ${c.token}`);

    expect(leaveRes.status).toBe(200);

    const cEnvoiRes = await request(app)
      .post(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${c.token}`)
      .send({ contenu: 'Je suis parti' });

    expect(cEnvoiRes.status).toBe(403);

    // Le groupe continue d'exister pour les autres membres
    const listeB = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${b.token}`);

    expect(listeB.body.some((c2) => c2.idConversation === idConversation)).toBe(true);
  });

  test('refuse que le chef quitte le groupe (il doit le supprimer)', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Groupe' });

    const res = await request(app)
      .post(`/api/conversations/${createRes.body.idConversation}/leave`)
      .set('Authorization', `Bearer ${a.token}`);

    expect(res.status).toBe(400);
  });

  test('refuse de quitter une conversation directe (il faut la supprimer)', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');

    const directRes = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ idUserDestinataire: b.idUser });

    const res = await request(app)
      .post(`/api/conversations/${directRes.body.idConversation}/leave`)
      .set('Authorization', `Bearer ${a.token}`);

    expect(res.status).toBe(400);
  });
});

describe('Messagerie - modification et suppression de messages', () => {
  async function creerConversationDirecte(tokenA, idUserB) {
    const res = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ idUserDestinataire: idUserB });

    return res.body.idConversation;
  }

  test('l’auteur peut modifier son propre message', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const idConversation = await creerConversationDirecte(a.token, b.idUser);

    const envoiRes = await request(app)
      .post(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ contenu: 'Message original' });

    const editRes = await request(app)
      .put(`/api/conversations/${idConversation}/messages/${envoiRes.body.idMessage}`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ contenu: 'Message corrigé' });

    expect(editRes.status).toBe(200);
    expect(editRes.body.contenu).toBe('Message corrigé');
    expect(editRes.body.dateModification).toEqual(expect.any(String));
  });

  test('refuse de modifier le message de quelqu’un d’autre', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const idConversation = await creerConversationDirecte(a.token, b.idUser);

    const envoiRes = await request(app)
      .post(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ contenu: 'Message original' });

    const editRes = await request(app)
      .put(`/api/conversations/${idConversation}/messages/${envoiRes.body.idMessage}`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ contenu: 'Je pirate ce message' });

    expect(editRes.status).toBe(403);
  });

  test('l’auteur peut supprimer son propre message, qui laisse une trace', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const idConversation = await creerConversationDirecte(a.token, b.idUser);

    const envoiRes = await request(app)
      .post(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ contenu: 'À supprimer' });

    const deleteRes = await request(app)
      .delete(`/api/conversations/${idConversation}/messages/${envoiRes.body.idMessage}`)
      .set('Authorization', `Bearer ${a.token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.supprime).toBeTruthy();

    const historiqueRes = await request(app)
      .get(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${b.token}`);

    const message = historiqueRes.body.find((m) => m.idMessage === envoiRes.body.idMessage);
    expect(message.supprime).toBeTruthy();
  });

  test('refuse de supprimer le message de quelqu’un d’autre dans une conversation directe', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const idConversation = await creerConversationDirecte(a.token, b.idUser);

    const envoiRes = await request(app)
      .post(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ contenu: 'Message de A' });

    const deleteRes = await request(app)
      .delete(`/api/conversations/${idConversation}/messages/${envoiRes.body.idMessage}`)
      .set('Authorization', `Bearer ${b.token}`);

    expect(deleteRes.status).toBe(403);
  });

  test('le chef du groupe peut supprimer le message d’un autre membre (modération)', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Groupe' });

    const idConversation = createRes.body.idConversation;

    const envoiRes = await request(app)
      .post(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${c.token}`)
      .send({ contenu: 'Message de C' });

    const deleteRes = await request(app)
      .delete(`/api/conversations/${idConversation}/messages/${envoiRes.body.idMessage}`)
      .set('Authorization', `Bearer ${a.token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.supprime).toBeTruthy();
  });

  test('refuse qu’un membre non-chef supprime le message d’un autre dans un groupe', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const c = await creerCompteEtConnecter('msguserC', 'msguserC@test.com');

    const createRes = await request(app)
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ membres: [b.idUser, c.idUser], titreGroupe: 'Groupe' });

    const idConversation = createRes.body.idConversation;

    const envoiRes = await request(app)
      .post(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${c.token}`)
      .send({ contenu: 'Message de C' });

    const deleteRes = await request(app)
      .delete(`/api/conversations/${idConversation}/messages/${envoiRes.body.idMessage}`)
      .set('Authorization', `Bearer ${b.token}`);

    expect(deleteRes.status).toBe(403);
  });

  test('refuse de modifier un message déjà supprimé', async () => {
    const a = await creerCompteEtConnecter('msguserA', 'msguserA@test.com');
    const b = await creerCompteEtConnecter('msguserB', 'msguserB@test.com');
    const idConversation = await creerConversationDirecte(a.token, b.idUser);

    const envoiRes = await request(app)
      .post(`/api/conversations/${idConversation}/messages`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ contenu: 'À supprimer' });

    await request(app)
      .delete(`/api/conversations/${idConversation}/messages/${envoiRes.body.idMessage}`)
      .set('Authorization', `Bearer ${a.token}`);

    const editRes = await request(app)
      .put(`/api/conversations/${idConversation}/messages/${envoiRes.body.idMessage}`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ contenu: 'Trop tard' });

    expect(editRes.status).toBe(400);
  });
});
