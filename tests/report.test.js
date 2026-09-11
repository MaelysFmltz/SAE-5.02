const Database = require('better-sqlite3');

const {
    creerSignalement,
    obtenirSignalement,
    obtenirSignalements
} = require('../src/services/reportService');

describe('Système de signalement', () => {
    let db;

    beforeEach(() => {
        db = new Database(':memory:');

        db.exec(`
            CREATE TABLE Utilisateur (
                idUser INTEGER PRIMARY KEY
            );

            CREATE TABLE Publication (
                idPubli INTEGER PRIMARY KEY,
                idUser INTEGER NOT NULL
            );

            CREATE TABLE Commentaire (
                idComm INTEGER PRIMARY KEY,
                idUser INTEGER NOT NULL,
                idPubli INTEGER NOT NULL,
                contenuCom TEXT NOT NULL
            );

            CREATE TABLE Signalement (
                idSignalement INTEGER PRIMARY KEY AUTOINCREMENT,
                idUserAuteur INTEGER NOT NULL,
                typeContenu TEXT CHECK(
                    typeContenu IN (
                        'publication',
                        'commentaire',
                        'utilisateur',
                        'media'
                    )
                ) NOT NULL,
                idContenu INTEGER NOT NULL,
                motif TEXT NOT NULL,
                dateSignalement DATETIME DEFAULT CURRENT_TIMESTAMP,
                statut TEXT CHECK(
                    statut IN (
                        'en_attente',
                        'traite',
                        'rejete'
                    )
                ) DEFAULT 'en_attente',
                FOREIGN KEY (idUserAuteur)
                    REFERENCES Utilisateur(idUser)
                    ON DELETE CASCADE
            );

            INSERT INTO Utilisateur (idUser)
            VALUES (1), (2);

            INSERT INTO Publication (idPubli, idUser)
            VALUES (10, 1);
        `);

        db.prepare(`
            INSERT INTO Commentaire (
                idComm,
                idUser,
                idPubli,
                contenuCom
            )
            VALUES (?, ?, ?, ?)
        `).run(1, 1, 10, 'Commentaire de test');
    });

    afterEach(() => {
        db.close();
    });

    test('Un utilisateur peut créer un signalement', () => {
        const resultat = creerSignalement(
            db,
            1,
            'publication',
            10,
            'Contenu inapproprié'
        );

        expect(resultat.succes).toBe(true);
        expect(resultat.idSignalement).toBe(1);
    });

    test('Le signalement est enregistré avec le statut en_attente', () => {
        const resultat = creerSignalement(
            db,
            1,
            'publication',
            10,
            'Contenu inapproprié'
        );

        const signalement = obtenirSignalement(
            db,
            resultat.idSignalement
        );

        expect(signalement.statut).toBe('en_attente');
        expect(signalement.motif).toBe('Contenu inapproprié');
    });

    test('Un type de contenu invalide est refusé', () => {
        const resultat = creerSignalement(
            db,
            1,
            'contenu_invalide',
            10,
            'Test'
        );

        expect(resultat.succes).toBe(false);
        expect(resultat.erreur).toBe('Type de contenu invalide');
    });

    test('Un motif vide est refusé', () => {
        const resultat = creerSignalement(
            db,
            1,
            'publication',
            10,
            '   '
        );

        expect(resultat.succes).toBe(false);
        expect(resultat.erreur).toBe('Le motif est obligatoire');
    });

    test('Un utilisateur inexistant ne peut pas créer de signalement', () => {
        const resultat = creerSignalement(
            db,
            999,
            'publication',
            10,
            'Test'
        );

        expect(resultat.succes).toBe(false);
        expect(resultat.erreur).toBe('Utilisateur introuvable');
    });

    test('Un identifiant de contenu invalide est refusé', () => {
        const resultat = creerSignalement(
            db,
            1,
            'publication',
            0,
            'Test'
        );

        expect(resultat.succes).toBe(false);
        expect(resultat.erreur).toBe(
            'Identifiant du contenu invalide'
        );
    });

    test('Les signalements peuvent être récupérés', () => {
        creerSignalement(
            db,
            1,
            'publication',
            10,
            'Premier signalement'
        );

        creerSignalement(
            db,
            2,
            'commentaire',
            1,
            'Deuxième signalement'
        );

        const signalements = obtenirSignalements(db);

        expect(signalements).toHaveLength(2);
    });

    test('Un signalement inexistant retourne null', () => {
        const signalement = obtenirSignalement(db, 999);

        expect(signalement).toBeNull();
    });

    test('Un utilisateur peut signaler un commentaire', () => {
        const resultat = creerSignalement(
            db,
            1,
            'commentaire',
            1,
            'Commentaire inapproprié'
        );

        expect(resultat.succes).toBe(true);

        const signalement = db.prepare(`
            SELECT *
            FROM Signalement
            WHERE idSignalement = ?
        `).get(resultat.idSignalement);

        expect(signalement.typeContenu).toBe('commentaire');
        expect(signalement.idContenu).toBe(1);
        expect(signalement.statut).toBe('en_attente');
    });

    test('Un commentaire inexistant ne peut pas être signalé', () => {
        const resultat = creerSignalement(
            db,
            1,
            'commentaire',
            9999,
            'Commentaire inapproprié'
        );

        expect(resultat.succes).toBe(false);
        expect(resultat.erreur).toBe('Commentaire introuvable');
    });
});