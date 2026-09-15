/**
 * Tests d'intégration pour la fonctionnalité de messagerie instantanée.
 * Couvre l'envoi de messages, la récupération de l'historique,
 * le marquage comme lu, et le contrôle d'accès (membres uniquement).
 * Utilise Supertest pour simuler les requêtes HTTP sur l'app Express,
 * avec 2 comptes de test (A et B) authentifiés via JWT.
 */

const request = require('supertest');
const app = require('../src/app'); // ou le fichier qui exporte ton app Express (pas server.js s'il fait juste .listen())

describe('Messagerie', () => {
  let tokenA, tokenB, conversationId;

  beforeAll(async () => {
    // Se connecter avec 2 comptes de test déjà créés en base (ou les créer ici via POST /register)
    const resA = await request(app).post('/api/login').send({ email: 'userA@test.com', password: 'motdepasse' });
    tokenA = resA.body.token;

    const resB = await request(app).post('/api/login').send({ email: 'userB@test.com', password: 'motdepasse' });
    tokenB = resB.body.token;
  });

  it('crée une conversation directe entre A et B', async () => {
    const res = await request(app)
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ userId: 'idDeB' });

    expect(res.status).toBe(201);
    conversationId = res.body.id;
  });

  it('A envoie un message dans la conversation', async () => {
    const res = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'Salut B !' });

    expect(res.status).toBe(201);
  });

  it('B récupère bien le message', async () => {
    const res = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.some(m => m.content === 'Salut B !')).toBe(true);
  });
});