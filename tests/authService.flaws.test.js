process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-de-test-uniquement';

const request = require('supertest');

const app = require('../src/app');
const db = require('../src/config/database');
const authService = require('../src/services/authService');
const { seedSchema } = require('./testDb');

beforeAll(() => {
  seedSchema(db);
});

afterEach(() => {
  db.exec('DELETE FROM Utilisateur');
});

afterAll(() => {
  db.close();
});

describe('authService.js - comportements à vérifier par exécution réelle', () => {
  test("register() n'applique aucune règle de complexité sur le mot de passe", async () => {
    const user = await authService.register(
      'motdepassefaible',
      'faible@test.com',
      '1',
      null
    );

    expect(user.idUser).toBeDefined();
  });

  test("register() n'applique aucune validation de format sur l'email", async () => {
    const user = await authService.register(
      'emailinvalide',
      'ceci-nest-pas-un-email',
      'motdepasse',
      null
    );

    expect(user.idUser).toBeDefined();
  });

  test("register() n'applique aucune validation sur la date de naissance", async () => {
    const user = await authService.register(
      'dateinvalide',
      'dateinvalide@test.com',
      'motdepasse',
      'pas-une-date'
    );

    expect(user.idUser).toBeDefined();
  });

  test("l'unicité de l'email ignore la casse : deux comptes créés pour la même adresse", async () => {
    await authService.register('user1', 'Chloe@Test.com', 'motdepasse', null);

    const secondUser = await authService.register(
      'user2',
      'chloe@test.com',
      'motdepasse',
      null
    );

    expect(secondUser.idUser).toBeDefined();

    const count = db
      .prepare(
        "SELECT COUNT(*) AS n FROM Utilisateur WHERE email IN ('Chloe@Test.com', 'chloe@test.com')"
      )
      .get().n;

    expect(count).toBe(2);
  });

  test("l'unicité du pseudo ignore la casse : risque d'usurpation visuelle", async () => {
    await authService.register('Admin', 'admin1@test.com', 'motdepasse', null);

    const secondUser = await authService.register(
      'admin',
      'admin2@test.com',
      'motdepasse',
      null
    );

    expect(secondUser.idUser).toBeDefined();
  });

  test("login() révèle qu'un compte est suspendu même avec un mauvais mot de passe", async () => {
    await authService.register('suspendu', 'suspendu@test.com', 'motdepasse', null);

    db.prepare(
      "UPDATE Utilisateur SET statut = 'suspendu' WHERE email = ?"
    ).run('suspendu@test.com');

    await expect(
      authService.login('suspendu@test.com', 'mot-de-passe-totalement-faux')
    ).rejects.toThrow('Ce compte n’est pas actif');

    // Pour comparaison : un email inconnu renvoie un message différent,
    // ce qui permet de distinguer "existe et suspendu" de "n'existe pas"
    // sans connaître le mot de passe.
    await expect(
      authService.login('inconnu@test.com', 'mot-de-passe-totalement-faux')
    ).rejects.toThrow('Email ou mot de passe incorrect');
  });

  // Ce test dépend du vrai temps de calcul de bcrypt (async) : il peut être
  // légèrement flaky sur une machine très chargée, mais il est reproductible
  // dans l'immense majorité des cas.
  test('inscriptions concurrentes avec le même email : erreur SQL brute exposée au client', async () => {
    const userA = { pseudo: 'race1', email: 'race@test.com', motDePasse: 'motdepasse' };
    const userB = { pseudo: 'race2', email: 'race@test.com', motDePasse: 'motdepasse' };

    const [resA, resB] = await Promise.all([
      request(app).post('/api/auth/register').send(userA),
      request(app).post('/api/auth/register').send(userB)
    ]);

    const results = [resA, resB];
    const successes = results.filter((r) => r.status === 201);
    const failures = results.filter((r) => r.status !== 201);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    expect(failures[0].body.error).toMatch(/unique|constraint/i);
  });
});
