
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-de-test-uniquement';

const request = require('supertest');
const fs = require('fs');
const path = require('path');

const app = require('../src/app');
const db = require('../src/config/database');
const { seedSchema } = require('./testDb');


/*
 * ============================================================
 * Configuration des tests
 * ============================================================
 */

const uploadDir =
    path.join(__dirname, '../uploads');


/*
 * ============================================================
 * Initialisation de la base
 * ============================================================
 */

beforeAll(() => {
    seedSchema(db);
});


afterEach(() => {

    /*
     * Suppression des données créées par les tests.
     */
    db.exec('DELETE FROM Media');
    db.exec('DELETE FROM Publication');
    db.exec('DELETE FROM Profil');
    db.exec('DELETE FROM Utilisateur');


    /*
     * Suppression des fichiers créés dans uploads/.
     *
     * On ne supprime que les fichiers qui ont été créés
     * pendant les tests.
     */
});


afterAll(() => {
    db.close();
});


/*
 * ============================================================
 * Création d'un compte de test + connexion
 * ============================================================
 */

async function creerCompteEtConnecter(
    pseudo,
    email
) {

    const registerRes =
        await request(app)
            .post('/api/auth/register')
            .send({
                pseudo,
                email,
                motDePasse: 'Motdepasse1!',
                dateNaissance: '2000-01-01'
            });


    expect(registerRes.status).toBe(201);


    const loginRes =
        await request(app)
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


/*
 * ============================================================
 * Fichiers de test
 * ============================================================
 */

/*
 * HTML contenant du JavaScript.
 *
 * C'est exactement le genre de fichier qu'un attaquant
 * pourrait essayer d'envoyer en prétendant qu'il s'agit
 * d'une vidéo MP4.
 */
const fakeHtml =
    Buffer.from(
        `<!DOCTYPE html>
<html>
<head>
    <title>Test XSS</title>
</head>
<body>
    <script>
        alert("XSS");
    </script>
</body>
</html>`,
        'utf8'
    );


/*
 * Faux MP4 minimal contenant la signature "ftyp".
 *
 * Il sert à tester le contrôle de signature du conteneur.
 */
const fakeValidMp4 =
    Buffer.from(
        '000000186674797069736f6d00000200',
        'hex'
    );


/*
 * Faux WebM minimal avec signature EBML.
 */
const fakeValidWebM =
    Buffer.from([
        0x1A,
        0x45,
        0xDF,
        0xA3,
        0x93,
        0x42,
        0x82
    ]);


/*
 * Faux OGG minimal.
 */
const fakeValidOgg =
    Buffer.from(
        'OggS',
        'ascii'
    );


/*
 * ============================================================
 * Tests d'authentification
 * ============================================================
 */

describe('Sécurité - authentification des publications', () => {

    test(
        'refuse une publication sans authentification',
        async () => {

            const res =
                await request(app)
                    .post('/post/upload')
                    .set('Accept', 'application/json')
                    .attach(
                        'media',
                        fakeHtml,
                        {
                            filename: 'attaque.mp4',
                            contentType: 'video/mp4'
                        }
                    );


            expect(res.status).toBe(401);

            expect(res.body.error).toMatch(
                /token|authentifié|authentification/i
            );
        }
    );


    test(
        'refuse un token invalide',
        async () => {

            const res =
                await request(app)
                    .post('/post/upload')
                    .set(
                        'Authorization',
                        'Bearer token-totalement-invalide'
                    )
                    .set('Accept', 'application/json')
                    .attach(
                        'media',
                        fakeHtml,
                        {
                            filename: 'attaque.mp4',
                            contentType: 'video/mp4'
                        }
                    );


            expect(res.status).toBe(401);
        }
    );
});


/*
 * ============================================================
 * Tests du champ fichier
 * ============================================================
 */

describe('Sécurité - fichier envoyé', () => {

    test(
        'refuse une requête sans fichier',
        async () => {

            const {
                token
            } =
                await creerCompteEtConnecter(
                    'postnofile',
                    'postnofile@test.com'
                );


            const res =
                await request(app)
                    .post('/post/upload')
                    .set(
                        'Authorization',
                        `Bearer ${token}`
                    )
                    .set(
                        'Accept',
                        'application/json'
                    )
                    .field(
                        'contenuPub',
                        'Publication sans fichier'
                    );


            expect(res.status).toBe(400);

            expect(res.body.error).toMatch(
                /fichier/i
            );
        }
    );


    test(
        'refuse un type MIME non autorisé',
        async () => {

            const {
                token
            } =
                await creerCompteEtConnecter(
                    'postmimetype',
                    'postmimetype@test.com'
                );


            const res =
                await request(app)
                    .post('/post/upload')
                    .set(
                        'Authorization',
                        `Bearer ${token}`
                    )
                    .set(
                        'Accept',
                        'application/json'
                    )
                    .attach(
                        'media',
                        Buffer.from(
                            'fichier texte quelconque',
                            'utf8'
                        ),
                        {
                            filename: 'fichier.txt',
                            contentType: 'text/plain'
                        }
                    );


            expect(res.status).toBe(400);
        }
    );
});


/*
 * ============================================================
 * FAILLE CRITIQUE :
 * HTML / JavaScript déguisé en MP4
 * ============================================================
 */

describe(
    'Sécurité critique - vérification réelle des vidéos',
    () => {

        test(
            'REFUSE un fichier HTML contenant du JavaScript déclaré comme video/mp4',
            async () => {

                const {
                    token
                } =
                    await creerCompteEtConnecter(
                        'attaquehtml',
                        'attaquehtml@test.com'
                    );


                /*
                 * Supertest envoie volontairement :
                 *
                 * filename    = attaque.mp4
                 * contentType = video/mp4
                 *
                 * alors que le contenu réel est du HTML/JavaScript.
                 */
                const res =
                    await request(app)
                        .post('/post/upload')
                        .set(
                            'Authorization',
                            `Bearer ${token}`
                        )
                        .set(
                            'Accept',
                            'application/json'
                        )
                        .attach(
                            'media',
                            fakeHtml,
                            {
                                filename: 'attaque.mp4',
                                contentType: 'video/mp4'
                            }
                        )
                        .field(
                            'contenuPub',
                            'Tentative de fichier malveillant'
                        )
                        .field(
                            'visibilite',
                            '1'
                        );


                /*
                 * Le serveur DOIT refuser.
                 */
                expect(res.status).toBe(400);


                expect(
                    res.body.error
                ).toMatch(
                    /véritable vidéo|video|vidéo/i
                );


                /*
                 * Vérification supplémentaire :
                 *
                 * aucune publication ne doit avoir été créée.
                 */
                const publication =
                    db.prepare(`
                        SELECT *
                        FROM Publication
                        WHERE contenuPub = ?
                    `).get(
                        'Tentative de fichier malveillant'
                    );


                expect(publication).toBeUndefined();
            }
        );


        test(
            'REFUSE un fichier texte déclaré comme video/mp4',
            async () => {

                const {
                    token
                } =
                    await creerCompteEtConnecter(
                        'fakemp4',
                        'fakemp4@test.com'
                    );


                const fakeVideo =
                    Buffer.from(
                        'ceci est simplement du texte',
                        'utf8'
                    );


                const res =
                    await request(app)
                        .post('/post/upload')
                        .set(
                            'Authorization',
                            `Bearer ${token}`
                        )
                        .set(
                            'Accept',
                            'application/json'
                        )
                        .attach(
                            'media',
                            fakeVideo,
                            {
                                filename: 'faux.mp4',
                                contentType: 'video/mp4'
                            }
                        );


                expect(res.status).toBe(400);


                const publication =
                    db.prepare(`
                        SELECT *
                        FROM Publication p
                        JOIN Media m
                            ON m.idPubli = p.idPubli
                        WHERE m.nomMedia LIKE ?
                    `).get(
                        '%faux.mp4'
                    );


                expect(publication).toBeUndefined();
            }
        );


        test(
            'ACCEPTE un fichier dont le contenu possède une signature MP4',
            async () => {

                const {
                    token,
                    idUser
                } =
                    await creerCompteEtConnecter(
                        'validemp4',
                        'validemp4@test.com'
                    );


                const res =
                    await request(app)
                        .post('/post/upload')
                        .set(
                            'Authorization',
                            `Bearer ${token}`
                        )
                        .set(
                            'Accept',
                            'application/json'
                        )
                        .attach(
                            'media',
                            fakeValidMp4,
                            {
                                filename: 'video.mp4',
                                contentType: 'video/mp4'
                            }
                        )
                        .field(
                            'contenuPub',
                            'Vraie signature MP4'
                        )
                        .field(
                            'visibilite',
                            '1'
                        );


                /*
                 * Le controller reconnaît la signature "ftyp".
                 */
                expect(res.status).toBe(201);


                const publication =
                    db.prepare(`
                        SELECT
                            p.*,
                            m.*
                        FROM Publication p
                        JOIN Media m
                            ON m.idPubli = p.idPubli
                        WHERE p.idUser = ?
                          AND p.contenuPub = ?
                    `).get(
                        idUser,
                        'Vraie signature MP4'
                    );


                expect(publication).toBeDefined();
                expect(publication.typeMedia).toBe('video');
            }
        );


        test(
            'REFUSE un HTML déclaré comme video/webm',
            async () => {

                const {
                    token
                } =
                    await creerCompteEtConnecter(
                        'attaquewebm',
                        'attaquewebm@test.com'
                    );


                const res =
                    await request(app)
                        .post('/post/upload')
                        .set(
                            'Authorization',
                            `Bearer ${token}`
                        )
                        .set(
                            'Accept',
                            'application/json'
                        )
                        .attach(
                            'media',
                            fakeHtml,
                            {
                                filename: 'attaque.webm',
                                contentType: 'video/webm'
                            }
                        );


                expect(res.status).toBe(400);


                const publications =
                    db.prepare(`
                        SELECT *
                        FROM Publication p
                        JOIN Media m
                            ON m.idPubli = p.idPubli
                        WHERE m.typeMedia = 'video'
                    `).all();


                expect(publications).toHaveLength(0);
            }
        );


        test(
            'REFUSE un HTML déclaré comme video/ogg',
            async () => {

                const {
                    token
                } =
                    await creerCompteEtConnecter(
                        'attaqueogg',
                        'attaqueogg@test.com'
                    );


                const res =
                    await request(app)
                        .post('/post/upload')
                        .set(
                            'Authorization',
                            `Bearer ${token}`
                        )
                        .set(
                            'Accept',
                            'application/json'
                        )
                        .attach(
                            'media',
                            fakeHtml,
                            {
                                filename: 'attaque.ogg',
                                contentType: 'video/ogg'
                            }
                        );


                expect(res.status).toBe(400);
            }
        );


        test(
            'ACCEPTE une signature WebM valide',
            async () => {

                const {
                    token
                } =
                    await creerCompteEtConnecter(
                        'validwebm',
                        'validwebm@test.com'
                    );


                const res =
                    await request(app)
                        .post('/post/upload')
                        .set(
                            'Authorization',
                            `Bearer ${token}`
                        )
                        .set(
                            'Accept',
                            'application/json'
                        )
                        .attach(
                            'media',
                            fakeValidWebM,
                            {
                                filename: 'video.webm',
                                contentType: 'video/webm'
                            }
                        );


                expect(res.status).toBe(201);
            }
        );


        test(
            'ACCEPTE une signature OGG valide',
            async () => {

                const {
                    token
                } =
                    await creerCompteEtConnecter(
                        'validogg',
                        'validogg@test.com'
                    );


                const res =
                    await request(app)
                        .post('/post/upload')
                        .set(
                            'Authorization',
                            `Bearer ${token}`
                        )
                        .set(
                            'Accept',
                            'application/json'
                        )
                        .attach(
                            'media',
                            fakeValidOgg,
                            {
                                filename: 'audio.ogg',
                                contentType: 'video/ogg'
                            }
                        );


                expect(res.status).toBe(201);
            }
        );
    }
);


/*
 * ============================================================
 * Tests de sécurité des images
 * ============================================================
 */

describe('Sécurité - vérification réelle des images', () => {

    test(
        'REFUSE un HTML déclaré comme image/jpeg',
        async () => {

            const {
                token
            } =
                await creerCompteEtConnecter(
                    'attaquejpeg',
                    'attaquejpeg@test.com'
                );


            const res =
                await request(app)
                    .post('/post/upload')
                    .set(
                        'Authorization',
                        `Bearer ${token}`
                    )
                    .set(
                        'Accept',
                        'application/json'
                    )
                    .attach(
                        'media',
                        fakeHtml,
                        {
                            filename: 'attaque.jpg',
                            contentType: 'image/jpeg'
                        }
                    );


            expect(res.status).toBe(400);


            expect(res.body.error).toMatch(
                /JPEG|jpeg/i
            );
        }
    );


    test(
        'REFUSE un HTML déclaré comme image/png',
        async () => {

            const {
                token
            } =
                await creerCompteEtConnecter(
                    'attaquepng',
                    'attaquepng@test.com'
                );


            const res =
                await request(app)
                    .post('/post/upload')
                    .set(
                        'Authorization',
                        `Bearer ${token}`
                    )
                    .set(
                        'Accept',
                        'application/json'
                    )
                    .attach(
                        'media',
                        fakeHtml,
                        {
                            filename: 'attaque.png',
                            contentType: 'image/png'
                        }
                    );


            expect(res.status).toBe(400);
        }
    );


    test(
        'REFUSE un HTML déclaré comme image/webp',
        async () => {

            const {
                token
            } =
                await creerCompteEtConnecter(
                    'attaquewebp',
                    'attaquewebp@test.com'
                );


            const res =
                await request(app)
                    .post('/post/upload')
                    .set(
                        'Authorization',
                        `Bearer ${token}`
                    )
                    .set(
                        'Accept',
                        'application/json'
                    )
                    .attach(
                        'media',
                        fakeHtml,
                        {
                            filename: 'attaque.webp',
                            contentType: 'image/webp'
                        }
                    );


            expect(res.status).toBe(400);
        }
    );
});


/*
 * ============================================================
 * Tests de visibilité
 * ============================================================
 */

describe('Sécurité - visibilité', () => {

    test(
        'refuse une valeur de visibilité invalide',
        async () => {

            const {
                token
            } =
                await creerCompteEtConnecter(
                    'visibilite',
                    'visibilite@test.com'
                );


            const res =
                await request(app)
                    .post('/post/upload')
                    .set(
                        'Authorization',
                        `Bearer ${token}`
                    )
                    .set(
                        'Accept',
                        'application/json'
                    )
                    .attach(
                        'media',
                        fakeValidMp4,
                        {
                            filename: 'video.mp4',
                            contentType: 'video/mp4'
                        }
                    )
                    .field(
                        'contenuPub',
                        'Visibilité invalide'
                    )
                    .field(
                        'visibilite',
                        '999'
                    );


            expect(res.status).toBe(400);


            const publication =
                db.prepare(`
                    SELECT *
                    FROM Publication
                    WHERE contenuPub = ?
                `).get(
                    'Visibilité invalide'
                );


            expect(publication).toBeUndefined();
        }
    );
});


/*
 * ============================================================
 * Sécurité : idUser
 * ============================================================
 */

describe(
    'Sécurité - identification de l’utilisateur',
    () => {

        test(
            'utilise l’utilisateur du JWT et ignore un idUser envoyé dans le formulaire',
            async () => {

                const {
                    token,
                    idUser
                } =
                    await creerCompteEtConnecter(
                        'jwtuser',
                        'jwtuser@test.com'
                    );


                const res =
                    await request(app)
                        .post('/post/upload')
                        .set(
                            'Authorization',
                            `Bearer ${token}`
                        )
                        .set(
                            'Accept',
                            'application/json'
                        )
                        .attach(
                            'media',
                            fakeValidMp4,
                            {
                                filename: 'video.mp4',
                                contentType: 'video/mp4'
                            }
                        )
                        .field(
                            'idUser',
                            '999999'
                        )
                        .field(
                            'contenuPub',
                            'Test JWT utilisateur'
                        )
                        .field(
                            'visibilite',
                            '1'
                        );


                expect(res.status).toBe(201);


                const publication =
                    db.prepare(`
                        SELECT *
                        FROM Publication
                        WHERE contenuPub = ?
                    `).get(
                        'Test JWT utilisateur'
                    );


                expect(publication).toBeDefined();


                /*
                 * L'id doit être celui du JWT,
                 * et pas celui envoyé par le client.
                 */
                expect(
                    Number(publication.idUser)
                ).toBe(
                    Number(idUser)
                );


                expect(
                    Number(publication.idUser)
                ).not.toBe(999999);
            }
        );
    }
);


/*
 * ============================================================
 * Vérification des fichiers réellement supprimés
 * ============================================================
 */

describe(
    'Sécurité - suppression des fichiers rejetés',
    () => {

        test(
            'supprime le fichier HTML rejeté après tentative MP4',
            async () => {

                const {
                    token
                } =
                    await creerCompteEtConnecter(
                        'suppression',
                        'suppression@test.com'
                    );


                const fichiersAvant =
                    fs.readdirSync(
                        uploadDir
                    );


                const res =
                    await request(app)
                        .post('/post/upload')
                        .set(
                            'Authorization',
                            `Bearer ${token}`
                        )
                        .set(
                            'Accept',
                            'application/json'
                        )
                        .attach(
                            'media',
                            fakeHtml,
                            {
                                filename: 'malware.mp4',
                                contentType: 'video/mp4'
                            }
                        );


                expect(res.status).toBe(400);


                const fichiersApres =
                    fs.readdirSync(
                        uploadDir
                    );


                /*
                 * Le nombre de fichiers ne doit pas augmenter
                 * après le rejet.
                 */
                expect(
                    fichiersApres.length
                ).toBe(
                    fichiersAvant.length
                );
            }
        );
    }
);

const Database = require('better-sqlite3');

const {
    sontAmis,
    peutVoirPublication,
    modifierVisibilite
} = require('../src/services/postService');

const VISIBILITE = require('../src/utils/visibilite');

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

    test('Une publication publique possède la visibilité 1', () => {
        expect(VISIBILITE.PUBLIC).toBe(1);
    });

    test('Une publication privée/amis possède la visibilité 0', () => {
        expect(VISIBILITE.PRIVE_AMIS).toBe(0);
    });

});

describe('Cas limites complémentaires (amitié et visibilité)', () => {

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
                (1, 1, 0);

            INSERT INTO Abonnement (idUserAbonne, idUserSuivi)
            VALUES
                (1, 2);
        `);
    });

    afterEach(() => {
        db.close();
    });

    test("Un abonnement à sens unique (1 suit 2) ne suffit pas à être amis", () => {
        expect(sontAmis(db, 1, 2)).toBe(false);
        expect(sontAmis(db, 2, 1)).toBe(false);
    });

    test("sontAmis est symétrique lorsque l'abonnement est réciproque", () => {
        db.prepare(`
            INSERT INTO Abonnement (idUserAbonne, idUserSuivi)
            VALUES (2, 1)
        `).run();

        expect(sontAmis(db, 1, 2)).toBe(true);
        expect(sontAmis(db, 2, 1)).toBe(true);
    });

    test("Un visiteur non authentifié peut voir une publication publique", () => {
        db.prepare(`
            UPDATE Publication SET visibilite = 1 WHERE idPubli = 1
        `).run();

        expect(peutVoirPublication(db, 1, undefined)).toBe(true);
    });

    test("Un visiteur non authentifié ne peut pas voir une publication privée", () => {
        expect(peutVoirPublication(db, 1, undefined)).toBe(false);
    });

    test("modifierVisibilite sur une publication inexistante renvoie false", () => {
        expect(modifierVisibilite(db, 999, 1, 1)).toBe(false);
    });

    test("modifierVisibilite refuse une visibilité envoyée sous forme de chaîne ('1')", () => {
        expect(modifierVisibilite(db, 1, 1, '1')).toBe(false);

        const publication = db.prepare(`
            SELECT visibilite FROM Publication WHERE idPubli = ?
        `).get(1);

        expect(publication.visibilite).toBe(0);
    });

});
