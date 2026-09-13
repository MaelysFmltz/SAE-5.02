const Database = require('better-sqlite3');

const postService = require('../src/services/postService');

describe('postService', () => {
    let db;

    beforeEach(() => {
        db = new Database(':memory:');

        db.exec(`
            CREATE TABLE Utilisateur (
                idUser INTEGER PRIMARY KEY,
                pseudo TEXT,
                email TEXT
            );

            CREATE TABLE Publication (
                idPubli INTEGER PRIMARY KEY,
                idUser INTEGER NOT NULL,
                contenuPub TEXT,
                visibilite INTEGER NOT NULL,
                idPubliPartagee INTEGER
            );

            INSERT INTO Utilisateur (idUser, pseudo, email)
            VALUES
                (1, 'alice', 'alice@test.fr'),
                (2, 'bob', 'bob@test.fr');

            INSERT INTO Publication (
                idPubli,
                idUser,
                contenuPub,
                visibilite,
                idPubliPartagee
            )
            VALUES
                (1, 1, 'Publication de Alice', 1, NULL),
                (2, 2, 'Publication de Bob', 0, NULL);
        `);
    });

    afterEach(() => {
        db.close();
    });

    describe('obtenirAuteurOriginal', () => {

        test('retourne l auteur original d une publication', () => {
            const auteur = postService.obtenirAuteurOriginal(db, 1);

            expect(auteur).toBe(1);
        });

        test('retourne null si l identifiant est invalide', () => {
            expect(
                postService.obtenirAuteurOriginal(db, 0)
            ).toBeNull();

            expect(
                postService.obtenirAuteurOriginal(db, -1)
            ).toBeNull();

            expect(
                postService.obtenirAuteurOriginal(db, '1')
            ).toBeNull();
        });
    });

    describe('supprimerPublication', () => {

        test('supprime une publication existante', () => {
            const resultat = postService.supprimerPublication(db, 1);

            expect(resultat).toEqual({
                succes: true
            });

            const publication = db.prepare(`
                SELECT idPubli
                FROM Publication
                WHERE idPubli = ?
            `).get(1);

            expect(publication).toBeUndefined();
        });

        test('retourne une erreur si la publication est introuvable', () => {
            const resultat = postService.supprimerPublication(db, 999);

            expect(resultat).toEqual({
                succes: false,
                erreur: 'Publication introuvable'
            });
        });

        test('retourne une erreur si l identifiant est invalide', () => {
            expect(
                postService.supprimerPublication(db, 0)
            ).toEqual({
                succes: false,
                erreur: 'Identifiant de publication invalide'
            });

            expect(
                postService.supprimerPublication(db, -1)
            ).toEqual({
                succes: false,
                erreur: 'Identifiant de publication invalide'
            });

            expect(
                postService.supprimerPublication(db, '1')
            ).toEqual({
                succes: false,
                erreur: 'Identifiant de publication invalide'
            });
        });

        test('ne supprime pas les autres publications', () => {
            postService.supprimerPublication(db, 1);

            const publication = db.prepare(`
                SELECT idPubli
                FROM Publication
                WHERE idPubli = ?
            `).get(2);

            expect(publication).toBeDefined();
        });
    });
});