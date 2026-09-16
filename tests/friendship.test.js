const Database = require('better-sqlite3');

const {
    sontAmis,
    suivre,
    neplusSuivre,
    listerAmis,
    listerAbonnements,
    listerAbonnes
} = require('../src/services/friendshipService');

describe("Gestion des amitiés (abonnements réciproques)", () => {

    let db;

    beforeEach(() => {
        db = new Database(':memory:');

        db.exec(`
            CREATE TABLE Utilisateur (
                idUser INTEGER PRIMARY KEY,
                pseudo TEXT NOT NULL
            );

            CREATE TABLE Abonnement (
                idUserAbonne INTEGER NOT NULL,
                idUserSuivi INTEGER NOT NULL,
                PRIMARY KEY (idUserAbonne, idUserSuivi)
            );

            INSERT INTO Utilisateur (idUser, pseudo)
            VALUES (1, 'alice'), (2, 'bob'), (3, 'chloe'), (4, 'david');

            INSERT INTO Abonnement (idUserAbonne, idUserSuivi)
            VALUES (1, 2), (2, 1), (1, 3);
        `);
    });

    afterEach(() => {
        db.close();
    });

    describe('suivre', () => {

        test('crée un nouvel abonnement', () => {
            expect(suivre(db, 3, 2)).toBe(true);

            const ligne = db.prepare(`
                SELECT * FROM Abonnement
                WHERE idUserAbonne = 3 AND idUserSuivi = 2
            `).get();

            expect(ligne).toBeDefined();
        });

        test('refuse de se suivre soi-même', () => {
            expect(suivre(db, 1, 1)).toBe(false);
        });

        test("refuse de suivre un utilisateur qui n'existe pas", () => {
            expect(suivre(db, 1, 999)).toBe(false);
        });

        test('est idempotent : suivre deux fois ne casse rien', () => {
            expect(suivre(db, 1, 2)).toBe(true);
            expect(suivre(db, 1, 2)).toBe(true);

            const nombre = db.prepare(`
                SELECT COUNT(*) AS n FROM Abonnement
                WHERE idUserAbonne = 1 AND idUserSuivi = 2
            `).get();

            expect(nombre.n).toBe(1);
        });

        test('suivre en retour rend les deux comptes amis', () => {
            expect(sontAmis(db, 1, 3)).toBe(false);

            suivre(db, 3, 1);

            expect(sontAmis(db, 1, 3)).toBe(true);
        });

    });

    describe('neplusSuivre', () => {

        test('supprime un abonnement existant', () => {
            expect(neplusSuivre(db, 1, 2)).toBe(true);

            const ligne = db.prepare(`
                SELECT * FROM Abonnement
                WHERE idUserAbonne = 1 AND idUserSuivi = 2
            `).get();

            expect(ligne).toBeUndefined();
        });

        test("renvoie false si l'abonnement n'existait pas", () => {
            expect(neplusSuivre(db, 3, 1)).toBe(false);
        });

        test('se désabonner casse une amitié réciproque', () => {
            expect(sontAmis(db, 1, 2)).toBe(true);

            neplusSuivre(db, 1, 2);

            expect(sontAmis(db, 1, 2)).toBe(false);
        });

    });

    describe('sontAmis', () => {

        test('abonnement réciproque = amis', () => {
            expect(sontAmis(db, 1, 2)).toBe(true);
            expect(sontAmis(db, 2, 1)).toBe(true);
        });

        test('abonnement à sens unique = pas amis', () => {
            expect(sontAmis(db, 1, 3)).toBe(false);
            expect(sontAmis(db, 3, 1)).toBe(false);
        });

        test('aucun abonnement = pas amis', () => {
            expect(sontAmis(db, 2, 3)).toBe(false);
        });

    });

    describe('listerAmis', () => {

        test('ne renvoie que les abonnements réciproques', () => {
            const amis = listerAmis(db, 1);

            expect(amis).toEqual([
                { idUser: 2, pseudo: 'bob' }
            ]);
        });

        test("renvoie une liste vide si aucun ami", () => {
            expect(listerAmis(db, 3)).toEqual([]);
        });

    });

    describe('listerAbonnements', () => {

        test('renvoie tous les comptes suivis, réciproques ou non', () => {
            const abonnements = listerAbonnements(db, 1);

            expect(abonnements).toEqual(
                expect.arrayContaining([
                    { idUser: 2, pseudo: 'bob' },
                    { idUser: 3, pseudo: 'chloe' }
                ])
            );
            expect(abonnements).toHaveLength(2);
        });

    });

    describe('listerAbonnes', () => {

        test('renvoie tous les comptes qui suivent cet utilisateur', () => {
            const abonnes = listerAbonnes(db, 2);

            expect(abonnes).toEqual([
                { idUser: 1, pseudo: 'alice' }
            ]);
        });

        test("renvoie une liste vide si aucun abonné", () => {
            expect(listerAbonnes(db, 4)).toEqual([]);
        });

    });

});
