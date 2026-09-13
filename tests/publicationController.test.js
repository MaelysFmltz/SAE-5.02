const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/config/database', () => {
    const Database = require('better-sqlite3');
    return new Database(':memory:');
});

const db = require('../src/config/database');
const app = require('../src/app');

describe('Tests HTTP des publications', () => {

    beforeEach(() => {
        db.exec(`
            DROP TABLE IF EXISTS Publication;
            DROP TABLE IF EXISTS Utilisateur;
            DROP TABLE IF EXISTS Abonnement;

            CREATE TABLE Utilisateur (
                idUser INTEGER PRIMARY KEY
            );

            CREATE TABLE Publication (
                idPubli INTEGER PRIMARY KEY,
                idUser INTEGER NOT NULL,
                contenuPub TEXT,
                visibilite INTEGER NOT NULL,
                datePubli TEXT,
                dateModif TEXT
            );

            CREATE TABLE Abonnement (
                idUserAbonne INTEGER NOT NULL,
                idUserSuivi INTEGER NOT NULL,
                PRIMARY KEY (idUserAbonne, idUserSuivi)
            );

            INSERT INTO Utilisateur (idUser)
            VALUES (1), (2), (3);

            INSERT INTO Publication (
                idPubli,
                idUser,
                contenuPub,
                visibilite,
                datePubli,
                dateModif
            )
            VALUES
                (1, 1, 'Publication publique', 1, '2026-01-01', '2026-01-01'),
                (2, 1, 'Publication privée', 0, '2026-01-02', '2026-01-02');
        `);
    });

    function tokenPour(idUser) {
        return jwt.sign(
            { idUser },
            process.env.JWT_SECRET || 'test-secret'
        );
    }

    test('GET /api/publications/:idPubli retourne une publication', async () => {
        const token = tokenPour(1);

        const response = await request(app)
            .get('/api/publications/1')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.idPubli).toBe(1);
        expect(response.body.visibilite).toBe(1);
    });

    test('GET /api/publications/:idPubli refuse l accès à une publication inexistante', async () => {
        const token = tokenPour(1);

        const response = await request(app)
            .get('/api/publications/999')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe(
            'Vous n’avez pas accès à cette publication'
        );
    });

    test('PATCH /api/publications/:idPubli/visibilite permet à l auteur de modifier la visibilité', async () => {
        const token = tokenPour(1);

        const response = await request(app)
            .patch('/api/publications/1/visibilite')
            .set('Authorization', `Bearer ${token}`)
            .send({ visibilite: 0 });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Visibilité modifiée');

        const publication = db.prepare(`
            SELECT visibilite
            FROM Publication
            WHERE idPubli = ?
        `).get(1);

        expect(publication.visibilite).toBe(0);
    });

    test('PATCH retourne 403 si l utilisateur n est pas propriétaire', async () => {
        const token = tokenPour(2);

        const response = await request(app)
            .patch('/api/publications/1/visibilite')
            .set('Authorization', `Bearer ${token}`)
            .send({ visibilite: 0 });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe(
            'Vous ne pouvez pas modifier cette publication'
        );
    });

    test('PATCH retourne 400 si la visibilité est invalide', async () => {
        const token = tokenPour(1);

        const response = await request(app)
            .patch('/api/publications/1/visibilite')
            .set('Authorization', `Bearer ${token}`)
            .send({ visibilite: 5 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Visibilité invalide');
    });

    test('PATCH retourne 404 si la publication existe pas', async () => {
        const token = tokenPour(1);

        const response = await request(app)
            .patch('/api/publications/999/visibilite')
            .set('Authorization', `Bearer ${token}`)
            .send({ visibilite: 0 });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Publication introuvable');
    });

    test('PATCH retourne 401 sans token', async () => {
        const response = await request(app)
            .patch('/api/publications/1/visibilite')
            .send({ visibilite: 0 });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Token manquant');
    });

});