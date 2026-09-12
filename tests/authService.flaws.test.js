process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-de-test-uniquement';

const request = require('supertest');

const app = require('../src/app');
const db = require('../src/config/database');
const authService = require('../src/services/authService');
const profileModel = require('../src/models/profileModel');
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

const motDePasseValide = 'Motdepasse1!';

describe('authService.js - failles corrigées depuis la dernière salve de tests (régression)', () => {
  // Historique : ces trois tests documentaient l'absence totale de
  // validation. authService.register() appelle désormais validationUtils,
  // donc ces entrées sont maintenant refusées. On garde les tests pour
  // s'assurer que ça ne régresse pas silencieusement.

  test('register() rejette maintenant un mot de passe faible', async () => {
    await expect(
      authService.register('motdepassefaible', 'faible@test.com', '1', null)
    ).rejects.toThrow();
  });

  test("register() rejette maintenant un email mal formé", async () => {
    await expect(
      authService.register('emailinvalide', 'ceci-nest-pas-un-email', motDePasseValide, null)
    ).rejects.toThrow();
  });

  test('register() rejette maintenant une date de naissance invalide', async () => {
    await expect(
      authService.register('dateinvalide', 'dateinvalide@test.com', motDePasseValide, 'pas-une-date')
    ).rejects.toThrow();
  });

  test("l'unicité de l'email ignore désormais la casse (validateEmail met en minuscule)", async () => {
    await authService.register('user1', 'Chloe@Test.com', motDePasseValide, null);

    await expect(
      authService.register('user2', 'chloe@test.com', motDePasseValide, null)
    ).rejects.toThrow(/email/i);

    const count = db
      .prepare("SELECT COUNT(*) AS n FROM Utilisateur WHERE email = 'chloe@test.com'")
      .get().n;

    expect(count).toBe(1);
  });
});

describe('authService.js - failles toujours présentes (à corriger)', () => {

  test("l'unicité du pseudo ignore la casse : deux comptes créés pour le même pseudo visuel", async () => {
    await authService.register('Admin', 'admin1@test.com', motDePasseValide, null);

    const secondUser = await authService.register(
      'admin',
      'admin2@test.com',
      motDePasseValide,
      null
    );

    // Documente la faille : ceci NE DEVRAIT PAS réussir si l'unicité du
    // pseudo était insensible à la casse (risque d'usurpation visuelle :
    // "Admin" et "admin" cohabitent).
    expect(secondUser.idUser).toBeDefined();

    const count = db
      .prepare(
        "SELECT COUNT(*) AS n FROM Utilisateur WHERE pseudo IN ('Admin', 'admin')"
      )
      .get().n;

    expect(count).toBe(2);
  });

  test("login() révèle qu'un compte est suspendu avant même de vérifier le mot de passe (oracle de statut)", async () => {
    await authService.register('suspendu', 'suspendu@test.com', motDePasseValide, null);

    db.prepare(
      "UPDATE Utilisateur SET statut = 'suspendu' WHERE email = ?"
    ).run('suspendu@test.com');

    // Avec un mot de passe totalement faux, on obtient quand même la
    // confirmation que le compte existe ET qu'il est suspendu.
    await expect(
      authService.login('suspendu@test.com', 'mot-de-passe-totalement-faux')
    ).rejects.toThrow('Ce compte n’est pas actif');

    // Pour comparaison : un email inconnu renvoie un message différent,
    // ce qui permet à un attaquant de distinguer "existe et suspendu" de
    // "n'existe pas" sans jamais connaître le mot de passe.
    await expect(
      authService.login('inconnu@test.com', 'mot-de-passe-totalement-faux')
    ).rejects.toThrow('Email ou mot de passe incorrect');
  });

  // Ce test dépend du vrai temps de calcul de bcrypt (async) : il peut être
  // légèrement flaky sur une machine très chargée, mais il est reproductible
  // dans l'immense majorité des cas.
  test('inscriptions concurrentes avec le même email : erreur SQL brute exposée au client', async () => {
    const userA = { pseudo: 'race1', email: 'race@test.com', motDePasse: motDePasseValide };
    const userB = { pseudo: 'race2', email: 'race@test.com', motDePasse: motDePasseValide };

    const [resA, resB] = await Promise.all([
      request(app).post('/api/auth/register').send(userA),
      request(app).post('/api/auth/register').send(userB)
    ]);

    const results = [resA, resB];
    const successes = results.filter((r) => r.status === 201);
    const failures = results.filter((r) => r.status !== 201);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    // authController.js renvoie err.message brut au client (catch générique),
    // donc le message d'erreur SQLite ("UNIQUE constraint failed: ...") fuite
    // tel quel au lieu d'un message générique côté API.
    expect(failures[0].body.error).toMatch(/unique|constraint/i);
  });

  test("l'échec de création du Profil laisse un utilisateur orphelin sans transaction (register n'est pas atomique)", async () => {
    const createProfileSpy = jest
      .spyOn(profileModel, 'createProfile')
      .mockImplementation(() => {
        throw new Error('Panne simulée de la création du profil');
      });

    try {
      await expect(
        authService.register('orphelin', 'orphelin@test.com', motDePasseValide, null)
      ).rejects.toThrow('Panne simulée');

      // Documente la faille : le compte Utilisateur a bien été créé malgré
      // l'échec de la création du Profil juste après, car les deux INSERT
      // ne sont pas dans une même transaction. Le client voit une erreur
      // 400 "registration failed", mais l'email/pseudo sont désormais pris.
      const user = db
        .prepare('SELECT idUser FROM Utilisateur WHERE email = ?')
        .get('orphelin@test.com');

      expect(user).toBeDefined();
    } finally {
      createProfileSpy.mockRestore();
    }
  });

});
