process.env.DB_PATH = ':memory:';

const db = require('../src/config/database');
const postService = require('../src/services/postService');
const postModel = require('../src/models/postModel');

beforeAll(() => {
    db.exec(`
        INSERT INTO Utilisateur
        (idUser, pseudo, email, motDePasse)
        VALUES
        (1, 'user1', 'user1@test.fr', 'password'),
        (2, 'user2', 'user2@test.fr', 'password'),
        (3, 'user3', 'user3@test.fr', 'password');

        INSERT INTO Publication
        (idPubli, idUser, contenuPub, visibilite, idPubliPartagee, typePublication)
        VALUES
        (1, 1, 'Publication publique', 1, NULL, 'original'),
        (2, 2, NULL, 1, 1, 'repost');

    `);
});

afterEach(() => {
    db.exec(`
        DELETE FROM Publication
        WHERE idPubli > 2;

        DELETE FROM Abonnement;
    `);
});

afterAll(() => {
    db.close();
});

describe('Partage de publications', () => {

    test('créer un repost d’une publication publique', () => {
        const publication = postService.createRepost(
            2,
            1,
            1
        );

        expect(publication).toBeDefined();
        expect(publication.idUser).toBe(2);
        expect(publication.idPubliPartagee).toBe(1);
        expect(publication.typePublication).toBe('repost');
        expect(publication.visibilite).toBe(1);
    });

    test('ne pas divulguer l’identifiant d’une publication privée dans le feed', () => {
        const publicationPrivee = postModel.createPublication(
            1,
            'Publication privée',
            0
        );

        db.prepare(`
            INSERT INTO Abonnement
            (idUserAbonne, idUserSuivi)
            VALUES
            (1, 2),
            (2, 1)
        `).run();

        const repost = postService.createRepost(
            2,
            publicationPrivee.idPubli,
            1
        );

        const feed = postService.getFeedForUser(3);

        const repostDansFeed = feed.find(
            publication => publication.idPubli === repost.idPubli
        );

        expect(repostDansFeed).toBeDefined();

        expect(repostDansFeed.idPubliPartagee).toBeNull();
        expect(repostDansFeed.originalIdPubli).toBeNull();
        expect(repostDansFeed.originalIdUser).toBeNull();
        expect(repostDansFeed.originalContenuPub).toBeNull();
        expect(repostDansFeed.auteurOriginalPseudo).toBeNull();
    });



    test('refuser le repost d’une publication inexistante', () => {
        expect(() => {
            postService.createRepost(
                2,
                999999,
                1
            );
        }).toThrow('Publication originale introuvable');
    });

    test('refuser une visibilité invalide lors d’un repost', () => {
        expect(() => {
            postService.createRepost(
                2,
                1,
                5
            );
        }).toThrow('Visibilité invalide');
    });

    test('une publication publique est accessible à un utilisateur', () => {
        const accessible = postService.peutVoirPublication(
            db,
            1,
            2
        );

        expect(accessible).toBe(true);
    });

    test('une publication privée est accessible à son auteur', () => {
        const publication = postModel.createPublication(
            1,
            'Publication privée de test',
            0
        );

        expect(
            postService.peutVoirPublication(
                db,
                publication.idPubli,
                1
            )
        ).toBe(true);
    });

    test('récupérer une publication avec son original', () => {
        const publication = postService.getPublication(2);

        expect(publication).toBeDefined();
        expect(publication.idPubli).toBe(2);
        expect(publication.originalIdPubli).toBe(1);
    });

    test('récupérer la chaîne des remixes', () => {
        const chain = postService.getRemixChainForUser(
            2,
            2
        );

        expect(chain.length).toBeGreaterThan(0);
        expect(chain[0].idPubli).toBe(2);
        expect(chain[0].idPubliPartagee).toBe(1);
    });

    test('une chaîne de remixes remonte jusqu’à la publication originale', () => {
        const chain = postService.getRemixChainForUser(
            2,
            2
        );

        const dernierePublication =
            chain[chain.length - 1];

        expect(dernierePublication.idPubli).toBe(1);
        expect(dernierePublication.typePublication)
            .toBe('original');
    });

    test('détecter une boucle dans une chaîne de remixes', () => {
        const publication1 =
            postModel.createPublication(
                1,
                'Publication boucle 1',
                1
            );

        const publication2 =
            postModel.createRepost(
                1,
                publication1.idPubli,
                1
            );

        db.prepare(`
            UPDATE Publication
            SET idPubliPartagee = ?
            WHERE idPubli = ?
        `).run(
            publication2.idPubli,
            publication1.idPubli
        );

        expect(() => {
            postModel.findRemixChain(
                publication1.idPubli
            );
        }).toThrow('boucle détectée');
    });

    test('refuser l’accès à une publication privée par un autre utilisateur', () => {
        const publication =
            postModel.createPublication(
                1,
                'Publication privée pour test',
                0
            );

        expect(() => {
            postService.getRemixChainForUser(
                publication.idPubli,
                2
            );
        }).toThrow('accès');
    });

    test('ne pas divulguer l’original privé lors de la récupération d’un repost', () => {
        const publicationPrivee = postModel.createPublication(
            1,
            'Contenu privé de Alice',
            0
        );

        db.prepare(`
            INSERT INTO Abonnement
            (idUserAbonne, idUserSuivi)
            VALUES
            (1, 2),
            (2, 1)
        `).run();

        const repost = postService.createRepost(
            2,
            publicationPrivee.idPubli,
            1
        );

        const publication = postService.getPublicationForUser(
            repost.idPubli,
            3
        );

        expect(publication).toBeDefined();
        expect(publication.idPubli).toBe(repost.idPubli);

        expect(publication.idPubliPartagee).toBeNull();
        expect(publication.originalIdPubli).toBeNull();
        expect(publication.originalIdUser).toBeNull();
        expect(publication.originalContenuPub).toBeNull();
        expect(publication.originalVisibilite).toBeNull();
        expect(publication.auteurOriginalPseudo).toBeNull();
    });

});