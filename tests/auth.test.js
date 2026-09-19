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

const validUser = {
  pseudo: 'chloe_test',
  email: 'chloe@test.com',
  motDePasse: 'Motdepasse1!',
  dateNaissance: '2000-01-01'
};

describe('POST /api/auth/register', () => {
  test('crée un utilisateur avec des données valides', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      pseudo: validUser.pseudo,
      email: validUser.email
    });
    expect(res.body.user.motDePasse).toBeUndefined();
  });

  test('refuse un enregistrement sans mot de passe', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ pseudo: 'sanspass', email: 'sanspass@test.com' });

    expect(res.status).toBe(400);
  });

  test('refuse un enregistrement sans email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ pseudo: 'sansemail', motDePasse: 'Motdepasse1!' });

    expect(res.status).toBe(400);
  });

  test('refuse un email déjà utilisé', async () => {
    await request(app).post('/api/auth/register').send(validUser);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, pseudo: 'autrepseudo' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  test('refuse un pseudo déjà utilisé', async () => {
    await request(app).post('/api/auth/register').send(validUser);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, email: 'autre@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pseudo/i);
  });

  // Régression : ce test documentait un écart (mot de passe faible accepté).
  // authService.register() appelle désormais validationUtils.validatePassword,
  // donc ce cas est maintenant rejeté. Voir authService.flaws.test.js pour
  // les écarts encore ouverts (unicité du pseudo, oracle de statut, etc).
  test('rejette maintenant un mot de passe faible', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, pseudo: 'motdepassefaible', email: 'faible@test.com', motDePasse: '1' });

    expect(res.status).toBe(400);
  });

  test('crée un profil vide en même temps que le compte', async () => {
    await request(app).post('/api/auth/register').send(validUser);

    const profil = db
      .prepare(
        `SELECT p.idProfil FROM Profil p
         JOIN Utilisateur u ON u.idUser = p.idUser
         WHERE u.email = ?`
      )
      .get(validUser.email);

    expect(profil).toBeDefined();
  });
});

describe('POST /api/auth/login', () => {
  const credentials = {
    pseudo: 'login_user',
    email: 'login@test.com',
    motDePasse: 'Motdepasse1!',
    dateNaissance: '1999-05-05'
  };

  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(credentials);
  });

  test('connecte un utilisateur avec les bons identifiants', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, motDePasse: credentials.motDePasse });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe(credentials.email);
    expect(res.body.user.motDePasse).toBeUndefined();
  });

  test('pose aussi le token dans un cookie httpOnly', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, motDePasse: credentials.motDePasse });

    const setCookie = res.headers['set-cookie'] || [];
    expect(setCookie.some((c) => c.startsWith('token=') && /HttpOnly/i.test(c))).toBe(true);
  });

  test('refuse une connexion avec un mauvais mot de passe', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, motDePasse: 'mauvaismdp' });

    expect(res.status).toBe(401);
  });

  test('refuse une connexion avec un email inconnu', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inconnu@test.com', motDePasse: credentials.motDePasse });

    expect(res.status).toBe(401);
  });

  test("refuse la connexion d'un compte suspendu", async () => {
    db.prepare(
      "UPDATE Utilisateur SET statut = 'suspendu' WHERE email = ?"
    ).run(credentials.email);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, motDePasse: credentials.motDePasse });

    expect(res.status).toBe(401);
  });

  test('met à jour la date de dernière connexion', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, motDePasse: credentials.motDePasse });

    const user = db
      .prepare('SELECT dateDerniereConnexion FROM Utilisateur WHERE email = ?')
      .get(credentials.email);

    expect(user.dateDerniereConnexion).not.toBeNull();
  });
});

describe('POST /api/auth/logout', () => {
  // logout redirige vers '/' pour un client qui accepte le HTML (navigation
  // classique) et ne renvoie du JSON que pour un client API explicite.
  test('répond en JSON avec succès pour un client API', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
  });

  test('redirige vers / pour une requête de type navigateur', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  test('efface le cookie token', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Accept', 'application/json');

    const setCookie = res.headers['set-cookie'] || [];
    expect(setCookie.some((c) => c.startsWith('token=;'))).toBe(true);
  });
});
