import Database from 'better-sqlite3';
import { sontAmis, peutVoirPublication, modifierVisibilite } from './permissions.js';

describe('Vérification des permissions des publications', () => {

    let db;

    beforeEach(() => {
        db = new Database(':memory:');

        db.exec(`
            CREATE TABLE Utilisateur (
                idUser INTEGER PRIMARY KEY
            );

            CREATE TABLE Publication (
                idPubli INTEGER PRIMARY KEY,
                idUser INTEGER NOT NULL,
                visibilite INTEGER NOT NULL
            );

            CREATE TABLE Abonnement (
                idUserAbonne INTEGER NOT NULL,
                idUserSuivi INTEGER NOT NULL,
                PRIMARY KEY (idUserAbonne, idUserSuivi)
            );

            INSERT INTO Utilisateur (idUser) VALUES (1), (2), (3);

            INSERT INTO Publication (idPubli, idUser, visibilite)
            VALUES
                (1, 1, 1),
                (2, 1, 0);

            INSERT INTO Abonnement (idUserAbonne, idUserSuivi)
            VALUES
                (2, 1),
                (1, 2);
        `);
    });

    afterEach(() => {
        db.close();
    });

    test('Une publication publique est visible par tout le monde', () => {
        expect(peutVoirPublication(db, 1, 3)).toBe(true);
    });

    test("L'auteur peut voir sa publication privée", () => {
        expect(peutVoirPublication(db, 2, 1)).toBe(true);
    });

    test("Un ami peut voir une publication privée", () => {
        expect(peutVoirPublication(db, 2, 2)).toBe(true);
    });

    test("Une personne qui n'est pas amie ne peut pas voir une publication privée", () => {
        expect(peutVoirPublication(db, 2, 3)).toBe(false);
    });

    test("Une publication inexistante n'est pas accessible", () => {
        expect(peutVoirPublication(db, 999, 3)).toBe(false);
    });


        test("L'auteur peut rendre sa publication privée", () => {
        expect(modifierVisibilite(db, 1, 1, 0)).toBe(true);

        const publication = db.prepare(`
            SELECT visibilite
            FROM Publication
            WHERE idPubli = ?
        `).get(1);

        expect(publication.visibilite).toBe(0);
    });

    test("L'auteur peut rendre sa publication publique", () => {
        expect(modifierVisibilite(db, 2, 1, 1)).toBe(true);

        const publication = db.prepare(`
            SELECT visibilite
            FROM Publication
            WHERE idPubli = ?
        `).get(2);

        expect(publication.visibilite).toBe(1);
    });

    test("Un autre utilisateur ne peut pas modifier la publication", () => {
        expect(modifierVisibilite(db, 2, 2, 1)).toBe(false);

        const publication = db.prepare(`
            SELECT visibilite
            FROM Publication
            WHERE idPubli = ?
        `).get(2);

        expect(publication.visibilite).toBe(0);
    });

    test("Une visibilité différente de 0 ou 1 est refusée", () => {
        expect(modifierVisibilite(db, 1, 1, 5)).toBe(false);
    });

});