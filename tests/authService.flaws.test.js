/**
 * Tests de sécurité et de non-régression du service d'authentification.
 */

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
  // Suppression dans cet ordre pour respecter les clés étrangères.
  db.exec('DELETE FROM Profil');
  db.exec('DELETE FROM Utilisateur');
});

afterAll(() => {
  db.close();
});

const motDePasseValide = 'Motdepasse1!';

describe('authService.js - validation des inscriptions', () => {
  test('refuse un mot de passe trop faible', async () => {
    await expect(
      authService.register(
        'motdepassefaible',
        'faible@test.com',
        '1',
        null
      )
    ).rejects.toThrow();
  });

  test('refuse un email mal formé', async () => {
    await expect(
      authService.register(
        'emailinvalide',
        'ceci-nest-pas-un-email',
        motDePasseValide,
        null
      )
    ).rejects.toThrow();
  });

  test('refuse une date de naissance invalide', async () => {
    await expect(
      authService.register(
        'dateinvalide',
        'dateinvalide@test.com',
        motDePasseValide,
        'pas-une-date'
      )
    ).rejects.toThrow();
  });
});

describe('authService.js - unicité des comptes', () => {
  test("l'unicité de l'email ignore la casse", async () => {
    await authService.register(
      'user1',
      'Chloe@Test.com',
      motDePasseValide,
      null
    );

    await expect(
      authService.register(
        'user2',
        'chloe@test.com',
        motDePasseValide,
        null
      )
    ).rejects.toThrow(/email/i);

    const result = db
      .prepare(`
        SELECT COUNT(*) AS nombre
        FROM Utilisateur
        WHERE LOWER(email) = LOWER(?)
      `)
      .get('chloe@test.com');

    expect(result.nombre).toBe(1);
  });

  test("l'unicité du pseudo ignore la casse", async () => {
    await authService.register(
      'Admin',
      'admin1@test.com',
      motDePasseValide,
      null
    );

    await expect(
      authService.register(
        'admin',
        'admin2@test.com',
        motDePasseValide,
        null
      )
    ).rejects.toThrow(/pseudo/i);

    const result = db
      .prepare(`
        SELECT COUNT(*) AS nombre
        FROM Utilisateur
        WHERE LOWER(pseudo) = LOWER(?)
      `)
      .get('admin');

    expect(result.nombre).toBe(1);
  });
});

describe(
  'authService.js - protection contre les oracles de connexion',
  () => {
    test(
      'ne révèle pas le statut suspendu si le mot de passe est incorrect',
      async () => {
        await authService.register(
          'suspendu',
          'suspendu@test.com',
          motDePasseValide,
          null
        );

        db.prepare(`
          UPDATE Utilisateur
          SET statut = 'suspendu'
          WHERE email = ?
        `).run('suspendu@test.com');

        /*
         * Chaque assertion est directement attachée à sa promesse.
         * Cela évite un rejet de promesse non géré par Jest.
         */
        await expect(
          authService.login(
            'suspendu@test.com',
            'mot-de-passe-totalement-faux'
          )
        ).rejects.toThrow('Email ou mot de passe incorrect');

        await expect(
          authService.login(
            'inconnu@test.com',
            'mot-de-passe-totalement-faux'
          )
        ).rejects.toThrow('Email ou mot de passe incorrect');
      }
    );

    test(
      'révèle le statut suspendu uniquement avec le bon mot de passe',
      async () => {
        await authService.register(
          'suspenduvalide',
          'suspenduvalide@test.com',
          motDePasseValide,
          null
        );

        db.prepare(`
          UPDATE Utilisateur
          SET statut = 'suspendu'
          WHERE email = ?
        `).run('suspenduvalide@test.com');

        await expect(
          authService.login(
            'suspenduvalide@test.com',
            motDePasseValide
          )
        ).rejects.toThrow('Ce compte n’est pas actif');
      }
    );
  }
);

describe(
  'authService.js - gestion sécurisée des erreurs SQL',
  () => {
    test(
      "n'expose pas une erreur SQL lors d'inscriptions concurrentes",
      async () => {
        const userA = {
          pseudo: 'race1',
          email: 'race@test.com',
          motDePasse: motDePasseValide
        };

        const userB = {
          pseudo: 'race2',
          email: 'race@test.com',
          motDePasse: motDePasseValide
        };

        const [resA, resB] = await Promise.all([
          request(app)
            .post('/api/auth/register')
            .send(userA),

          request(app)
            .post('/api/auth/register')
            .send(userB)
        ]);

        const results = [resA, resB];

        const successes = results.filter(
          (response) => response.status === 201
        );

        const failures = results.filter(
          (response) => response.status !== 201
        );

        /*
         * Une seule inscription doit réussir et l'autre doit produire
         * une réponse 409 Conflict.
         */
        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(1);
        expect(failures[0].status).toBe(409);

        /*
         * Le client reçoit un message générique.
         * Les détails internes de SQLite ne doivent pas être exposés.
         */
        expect(failures[0].body.error).toBe(
          'Cet email ou pseudo est déjà utilisé'
        );

        expect(failures[0].body.error).not.toMatch(
          /unique|constraint|sqlite|utilisateur\.email/i
        );

        const result = db
          .prepare(`
            SELECT COUNT(*) AS nombre
            FROM Utilisateur
            WHERE email = ?
          `)
          .get('race@test.com');

        expect(result.nombre).toBe(1);
      }
    );
  }
);

describe('authService.js - atomicité de l’inscription', () => {
  test(
    "annule la création de l'utilisateur si la création du profil échoue",
    async () => {
      const createProfileSpy = jest
        .spyOn(profileModel, 'createProfile')
        .mockImplementation(() => {
          throw new Error(
            'Panne simulée de la création du profil'
          );
        });

      try {
        await expect(
          authService.register(
            'orphelin',
            'orphelin@test.com',
            motDePasseValide,
            null
          )
        ).rejects.toThrow(
          'Panne simulée de la création du profil'
        );

        const user = db
          .prepare(`
            SELECT idUser
            FROM Utilisateur
            WHERE email = ?
          `)
          .get('orphelin@test.com');

        /*
         * Si la transaction fonctionne, l'utilisateur créé avant
         * l'échec du profil est automatiquement supprimé.
         */
        expect(user).toBeUndefined();
      } finally {
        createProfileSpy.mockRestore();
      }
    }
  );
});
