const Database = require('better-sqlite3');
const userService = require('../src/services/userService');

describe('Gestion des utilisateurs', () => {
    let db;

    beforeEach(() => {
        db = new Database(':memory:');

        db.exec(`
            CREATE TABLE Utilisateur (
                idUser INTEGER PRIMARY KEY,
                pseudo TEXT NOT NULL,
                email TEXT NOT NULL,
                motDePasse TEXT NOT NULL,
                dateInscription DATETIME DEFAULT CURRENT_TIMESTAMP,
                dateNaissance DATE,
                statut TEXT CHECK(statut IN ('actif', 'suspendu', 'supprime')) DEFAULT 'actif',
                role TEXT CHECK(role IN ('user', 'moderator', 'admin')) DEFAULT 'user',
                dateDerniereConnexion DATETIME
            );

            INSERT INTO Utilisateur
                (idUser, pseudo, email, motDePasse, statut, role)
            VALUES
                (1, 'test_user', 'test@test.fr', 'hash', 'actif', 'user'),
                (2, 'test_admin', 'admin@test.fr', 'hash', 'actif', 'admin');
        `);
    });

    afterEach(() => {
        db.close();
    });

    test('récupérer les utilisateurs', () => {
        const utilisateurs = userService.obtenirUtilisateurs(db);

        expect(utilisateurs).toHaveLength(2);
        expect(utilisateurs[0].pseudo).toBe('test_user');
    });

    test('suspendre un utilisateur', () => {
        const resultat = userService.modifierStatut(
            db,
            1,
            'suspendu'
        );

        expect(resultat.succes).toBe(true);

        const utilisateur = db.prepare(`
            SELECT statut
            FROM Utilisateur
            WHERE idUser = 1
        `).get();

        expect(utilisateur.statut).toBe('suspendu');
    });

    test('réactiver un utilisateur', () => {
        db.prepare(`
            UPDATE Utilisateur
            SET statut = 'suspendu'
            WHERE idUser = 1
        `).run();

        const resultat = userService.modifierStatut(
            db,
            1,
            'actif'
        );

        expect(resultat.succes).toBe(true);

        const utilisateur = db.prepare(`
            SELECT statut
            FROM Utilisateur
            WHERE idUser = 1
        `).get();

        expect(utilisateur.statut).toBe('actif');
    });

    test('refuser un statut invalide', () => {
        const resultat = userService.modifierStatut(
            db,
            1,
            'invalide'
        );

        expect(resultat.succes).toBe(false);
        expect(resultat.erreur).toBe(
            'Statut utilisateur invalide'
        );
    });

    test('refuser un utilisateur inexistant', () => {
        const resultat = userService.modifierStatut(
            db,
            999,
            'suspendu'
        );

        expect(resultat.succes).toBe(false);
        expect(resultat.erreur).toBe(
            'Utilisateur introuvable'
        );
    });
});