process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-de-test-uniquement';

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const app = require('../src/app');
const db = require('../src/config/database');
const { seedSchema } = require('./testDb');
const postService = require('../src/services/postService');
const postModel = require('../src/models/postModel');
const VISIBILITE = require('../src/utils/visibilite');

const uploadDir = path.join(__dirname, '../uploads');

beforeAll(() => {
    seedSchema(db);
});

afterEach(() => {
    db.exec('DELETE FROM Media');
    db.exec('DELETE FROM Publication');
    db.exec('DELETE FROM Profil');
    db.exec('DELETE FROM Utilisateur');
});

afterAll(() => {
    db.close();
});

async function creerCompteEtConnecter(pseudo, email) {
    const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
            pseudo,
            email,
            motDePasse: 'Motdepasse1!',
            dateNaissance: '2000-01-01'
        });

    expect(registerRes.status).toBe(201);

    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
            email,
            motDePasse: 'Motdepasse1!'
        });

    expect(loginRes.status).toBe(200);

    return {
        token: loginRes.body.token,
        idUser: loginRes.body.user.idUser
    };
}

const fakeHtml = Buffer.from('<!DOCTYPE html><html><body><script>alert("XSS");</script></body></html>', 'utf8');
const fakeValidMp4 = Buffer.from('000000186674797069736f6d00000200', 'hex');
const fakeValidWebM = Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0x93, 0x42, 0x82]);
const fakeValidOgg = Buffer.from('OggS', 'ascii');

describe('Sécurité - authentification des publications', () => {
    test('refuse une publication sans authentification', async () => {
        const res = await request(app)
            .post('/api/publications/upload')
            .set('Accept', 'application/json')
            .attach('media', fakeHtml, { filename: 'attaque.mp4', contentType: 'video/mp4' });

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/token|authentifié|authentification/i);
    });

    test('refuse un token invalide', async () => {
        const res = await request(app)
            .post('/api/publications/upload')
            .set('Authorization', 'Bearer token-totalement-invalide')
            .set('Accept', 'application/json')
            .attach('media', fakeHtml, { filename: 'attaque.mp4', contentType: 'video/mp4' });

        expect(res.status).toBe(401);
    });
});

describe('Sécurité - fichier envoyé', () => {
    test('refuse une requête sans fichier', async () => {
        const { token } = await creerCompteEtConnecter('postnofile', 'postnofile@test.com');

        const res = await request(app)
            .post('/api/publications/upload')
            .set('Authorization', `Bearer ${token}`)
            .set('Accept', 'application/json')
            .field('contenuPub', 'Publication sans fichier');

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/fichier/i);
    });

    test('refuse un type MIME non autorisé', async () => {
        const { token } = await creerCompteEtConnecter('postmimetype', 'postmimetype@test.com');

        const res = await request(app)
            .post('/api/publications/upload')
            .set('Authorization', `Bearer ${token}`)
            .set('Accept', 'application/json')
            .attach('media', Buffer.from('texte', 'utf8'), { filename: 'fichier.txt', contentType: 'text/plain' });

        expect(res.status).toBe(400);
    });
});

describe('Sécurité critique - vérification réelle des vidéos', () => {
    test('REFUSE un fichier HTML contenant du JavaScript déclaré comme video/mp4', async () => {
        const { token } = await creerCompteEtConnecter('attaquehtml', 'attaquehtml@test.com');

        const res = await request(app)
            .post('/api/publications/upload')
            .set('Authorization', `Bearer ${token}`)
            .set('Accept', 'application/json')
            .attach('media', fakeHtml, { filename: 'attaque.mp4', contentType: 'video/mp4' })
            .field('contenuPub', 'Tentative de fichier malveillant')
            .field('visibilite', '1');

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/véritable vidéo|video|vidéo/i);
    });

    test('ACCEPTE un fichier dont le contenu possède une signature MP4', async () => {
        const { token, idUser } = await creerCompteEtConnecter('validemp4', 'validemp4@test.com');

        const res = await request(app)
            .post('/api/publications/upload')
            .set('Authorization', `Bearer ${token}`)
            .set('Accept', 'application/json')
            .attach('media', fakeValidMp4, { filename: 'video.mp4', contentType: 'video/mp4' })
            .field('contenuPub', 'Vraie signature MP4')
            .field('visibilite', '1');

        expect(res.status).toBe(201);
    });
});

describe('Gestion des suppressions et auteurs originaux (Modération)', () => {
    let testDb;

    beforeEach(() => {
        testDb = new Database(':memory:');
        testDb.exec(`
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
            VALUES (1, 'alice', 'alice@test.fr'), (2, 'bob', 'bob@test.fr');

            INSERT INTO Publication (idPubli, idUser, contenuPub, visibilite, idPubliPartagee)
            VALUES
                (1, 1, 'Publication de Alice', 1, NULL),
                (2, 2, 'Publication de Bob', 0, NULL);
        `);
    });

    afterEach(() => {
        testDb.close();
    });

    test('retourne l auteur original d une publication', () => {
        const auteur = postService.obtenirAuteurOriginal(testDb, 1);
        expect(auteur).toBe(1);
    });

    test('retourne null si l identifiant est invalide pour auteur original', () => {
        expect(postService.obtenirAuteurOriginal(testDb, 0)).toBeNull();
        expect(postService.obtenirAuteurOriginal(testDb, -1)).toBeNull();
        expect(postService.obtenirAuteurOriginal(testDb, '1')).toBeNull();
    });

    test('supprime une publication existante via postService.supprimerPublication', () => {
        const resultat = postService.supprimerPublication(testDb, 1);
        expect(resultat).toEqual({ succes: true });

        const publication = testDb.prepare(`
            SELECT idPubli FROM Publication WHERE idPubli = ?
        `).get(1);

        expect(publication).toBeUndefined();
    });

    test('retourne une erreur si la publication à supprimer est introuvable', () => {
        const resultat = postService.supprimerPublication(testDb, 999);
        expect(resultat).toEqual({
            succes: false,
            erreur: 'Publication introuvable'
        });
    });
});

describe('Vérification des permissions des publications et visibilité', () => {
    let testDb;

    beforeEach(() => {
        testDb = new Database(':memory:');
        testDb.exec(`
            CREATE TABLE Utilisateur (idUser INTEGER PRIMARY KEY);
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
            INSERT INTO Publication (idPubli, idUser, visibilite) VALUES (1, 1, 1), (2, 1, 0);
            INSERT INTO Abonnement (idUserAbonne, idUserSuivi) VALUES (2, 1), (1, 2);
        `);
    });

    afterEach(() => {
        testDb.close();
    });

    test('Une publication publique est visible par tout le monde', () => {
        expect(postService.peutVoirPublication(testDb, 1, 3)).toBe(true);
    });

    test("L'auteur peut voir sa publication privée", () => {
        expect(postService.peutVoirPublication(testDb, 2, 1)).toBe(true);
    });

    test('Un ami peut voir une publication privée', () => {
        expect(postService.peutVoirPublication(testDb, 2, 2)).toBe(true);
    });

    test("Une personne non amie ne peut pas voir une publication privée", () => {
        expect(postService.peutVoirPublication(testDb, 2, 3)).toBe(false);
    });

    test("L'auteur peut modifier la visibilité", () => {
        expect(postService.modifierVisibilite(testDb, 1, 1, 0)).toBe(true);
        const publication = testDb.prepare('SELECT visibilite FROM Publication WHERE idPubli = ?').get(1);
        expect(publication.visibilite).toBe(0);
    });

    test('Une publication publique possède la visibilité 1', () => {
        expect(VISIBILITE.PUBLIC).toBe(1);
    });

    test('Une publication privée/amis possède la visibilité 0', () => {
        expect(VISIBILITE.PRIVE_AMIS).toBe(0);
    });
});