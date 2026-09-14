process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-de-test-uniquement';

const request = require('supertest');

const app = require('../src/app');
const db = require('../src/config/database');
const { seedSchema } = require('./testDb');

beforeAll(() => {
  seedSchema(db);
});

afterEach(() => {
  db.exec('DELETE FROM Utilisateur');
  db.exec('DELETE FROM Profil');
});

afterAll(() => {
  db.close();
});

async function creerCompteEtConnecter(pseudo, email) {
  await request(app).post('/api/auth/register').send({
    pseudo,
    email,
    motDePasse: 'Motdepasse1!',
    dateNaissance: '2000-01-01'
  });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, motDePasse: 'Motdepasse1!' });

  return { token: res.body.token, idUser: res.body.user.idUser };
}

describe('GET /api/profile/me', () => {

  test('était injoignable avant le montage de la route (régression : bug corrigé)', async () => {
    // authMiddleware exige un Accept explicite pour obtenir du JSON plutôt
    // qu'une redirection HTML sur les routes non authentifiées ; ici on
    // vérifie juste que la route EXISTE (pas de 404), peu importe le code.
    const res = await request(app).get('/api/profile/me');

    expect(res.status).not.toBe(404);
  });

  test('renvoie 401 sans authentification', async () => {
    const res = await request(app)
      .get('/api/profile/me')
      .set('Accept', 'application/json');

    expect(res.status).toBe(401);
  });

  test("renvoie le profil complet de l'utilisateur connecté, sans le mot de passe", async () => {
    const { token } = await creerCompteEtConnecter('chloeprofil', 'chloeprofil@test.com');

    const res = await request(app)
      .get('/api/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.pseudo).toBe('chloeprofil');
    expect(res.body.email).toBe('chloeprofil@test.com');
    expect(res.body.motDePasse).toBeUndefined();
  });

  test('un profil vide est bien créé automatiquement à l’inscription', async () => {
    const { token } = await creerCompteEtConnecter('nouveauprofil', 'nouveauprofil@test.com');

    const res = await request(app)
      .get('/api/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.idProfil).toBeDefined();
    expect(res.body.nom).toBeNull();
    expect(res.body.prenom).toBeNull();
    expect(res.body.bio).toBeNull();
  });

});

describe('PUT /api/profile/me', () => {

  test('met à jour nom / prénom / bio', async () => {
    const { token } = await creerCompteEtConnecter('editprofil', 'editprofil@test.com');

    const res = await request(app)
      .put('/api/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json')
      .send({ nom: 'Dupont', prenom: 'Alice', bio: 'Salut !' });

    expect(res.status).toBe(200);
    expect(res.body.nom).toBe('Dupont');
    expect(res.body.prenom).toBe('Alice');
    expect(res.body.bio).toBe('Salut !');
  });

  test('refuse une bio de plus de 300 caractères', async () => {
    const { token } = await creerCompteEtConnecter('biolongue', 'biolongue@test.com');

    const res = await request(app)
      .put('/api/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json')
      .send({ bio: 'a'.repeat(301) });

    expect(res.status).toBe(400);
  });

  test('refuse une modification sans authentification', async () => {
    const res = await request(app)
      .put('/api/profile/me')
      .set('Accept', 'application/json')
      .send({ nom: 'Personne' });

    expect(res.status).toBe(401);
  });

  test("ne permet pas de modifier le profil d'un autre utilisateur (idUser vient du token, pas du body)", async () => {
    const alice = await creerCompteEtConnecter('aliceprofil', 'aliceprofil@test.com');
    const bob = await creerCompteEtConnecter('bobprofil', 'bobprofil@test.com');

    await request(app)
      .put('/api/profile/me')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('Accept', 'application/json')
      .send({ idUser: bob.idUser, nom: 'Piraté' });

    const profilBob = await request(app)
      .get('/api/profile/me')
      .set('Authorization', `Bearer ${bob.token}`)
      .set('Accept', 'application/json');

    expect(profilBob.body.nom).toBeNull();
  });

  // Faille présente : nom/prenom/bio ne passent pas par sanitizeText (à la
  // différence du pseudo dans validationUtils), donc du HTML brut est stocké
  // et renvoyé tel quel par l'API. Reste latent tant qu'aucune vue ne
  // l'affiche sans échappement (views/profile.ejs est vide pour l'instant),
  // mais toute future vue ou script front qui insère bio en innerHTML serait
  // vulnérable au XSS stocké.
  test("stocke du HTML/script brut dans la bio sans le nettoyer (XSS stocké latent)", async () => {
    const { token } = await creerCompteEtConnecter('xssuser', 'xssuser@test.com');
    const payload = '<script>alert(1)</script>';

    const res = await request(app)
      .put('/api/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json')
      .send({ bio: payload });

    expect(res.status).toBe(200);
    expect(res.body.bio).toBe(payload);
  });

});

describe('GET /api/profile/:pseudo', () => {

  test("renvoie le profil public sans email ni statut", async () => {
    const { token } = await creerCompteEtConnecter('publicuser', 'publicuser@test.com');

    await request(app)
      .put('/api/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json')
      .send({ bio: 'Bio publique' });

    const res = await request(app)
      .get('/api/profile/publicuser')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.pseudo).toBe('publicuser');
    expect(res.body.bio).toBe('Bio publique');
    expect(res.body.email).toBeUndefined();
    expect(res.body.statut).toBeUndefined();
    expect(res.body.motDePasse).toBeUndefined();
  });

  test('renvoie 404 pour un pseudo inexistant', async () => {
    const { token } = await creerCompteEtConnecter('chercheur', 'chercheur@test.com');

    const res = await request(app)
      .get('/api/profile/pseudo_qui_nexiste_pas')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json');

    expect(res.status).toBe(404);
  });

  test("l'ordre des routes est correct : /me n'est pas intercepté par /:pseudo", async () => {
    const { token } = await creerCompteEtConnecter('routetest', 'routetest@test.com');

    const res = await request(app)
      .get('/api/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.pseudo).toBe('routetest');
  });

  test('exige une authentification même pour consulter un profil public (toutes les routes sont sous authMiddleware)', async () => {
    await creerCompteEtConnecter('protege', 'protege@test.com');

    const res = await request(app)
      .get('/api/profile/protege')
      .set('Accept', 'application/json');

    expect(res.status).toBe(401);
  });

});
