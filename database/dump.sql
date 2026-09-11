PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. COMPTES & PROFILS
-- ============================================================

CREATE TABLE IF NOT EXISTS Utilisateur (
    idUser INTEGER PRIMARY KEY AUTOINCREMENT,
    pseudo TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    motDePasse TEXT NOT NULL,
    dateInscription DATETIME DEFAULT CURRENT_TIMESTAMP,
    dateNaissance DATE,
    statut TEXT CHECK(statut IN ('actif', 'suspendu', 'supprime')) DEFAULT 'actif',
    role TEXT CHECK(role IN ('user', 'moderator', 'admin')) DEFAULT 'user',
    dateDerniereConnexion DATETIME
);

-- ============================================================
-- 2. PUBLICATIONS & MÉDIAS
-- ============================================================

CREATE TABLE IF NOT EXISTS Publication (
    idPubli INTEGER PRIMARY KEY AUTOINCREMENT,
    idUser INTEGER NOT NULL,
    contenuPub TEXT,
    visibilite INTEGER NOT NULL DEFAULT 1,
    idPubliPartagee INTEGER,
    datePubli DATETIME DEFAULT CURRENT_TIMESTAMP,
    dateModif DATETIME,
    FOREIGN KEY (idUser) REFERENCES Utilisateur(idUser) ON DELETE CASCADE,
    FOREIGN KEY (idPubliPartagee) REFERENCES Publication(idPubli) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Media (
    idMedia INTEGER PRIMARY KEY AUTOINCREMENT,
    idPubli INTEGER,
    nomMedia TEXT NOT NULL,
    typeMedia TEXT CHECK(typeMedia IN ('image', 'video')) NOT NULL,
    duree INTEGER,
    dateUpload DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idPubli) REFERENCES Publication(idPubli) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Profil (
    idProfil INTEGER PRIMARY KEY AUTOINCREMENT,
    idUser INTEGER NOT NULL UNIQUE,
    idMedia INTEGER,
    nom TEXT,
    prenom TEXT,
    bio TEXT,
    FOREIGN KEY (idUser) REFERENCES Utilisateur(idUser) ON DELETE CASCADE,
    FOREIGN KEY (idMedia) REFERENCES Media(idMedia) ON DELETE SET NULL
);

-- ============================================================
-- 3. INTERACTIONS SOCIALES & TENDANCES
-- ============================================================

CREATE TABLE IF NOT EXISTS Commentaire (
    idComm INTEGER PRIMARY KEY AUTOINCREMENT,
    idUser INTEGER NOT NULL,
    idPubli INTEGER NOT NULL,
    contenuCom TEXT NOT NULL,
    dateCommentaire DATETIME DEFAULT CURRENT_TIMESTAMP,
    dateModif DATETIME,
    FOREIGN KEY (idUser) REFERENCES Utilisateur(idUser) ON DELETE CASCADE,
    FOREIGN KEY (idPubli) REFERENCES Publication(idPubli) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS LikeDislike (
    idUser INTEGER NOT NULL,
    idPubli INTEGER NOT NULL,
    estLike INTEGER NOT NULL CHECK(estLike IN (0, 1)),
    PRIMARY KEY (idUser, idPubli),
    FOREIGN KEY (idUser) REFERENCES Utilisateur(idUser) ON DELETE CASCADE,
    FOREIGN KEY (idPubli) REFERENCES Publication(idPubli) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS LikeCommentaire (
    idUser INTEGER NOT NULL,
    idComm INTEGER NOT NULL,
    estLike INTEGER NOT NULL CHECK(estLike IN (0, 1)),
    PRIMARY KEY (idUser, idComm),
    FOREIGN KEY (idUser) REFERENCES Utilisateur(idUser) ON DELETE CASCADE,
    FOREIGN KEY (idComm) REFERENCES Commentaire(idComm) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Hashtag (
    idHashtag INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS PubliHashtag (
    idPubli INTEGER NOT NULL,
    idHashtag INTEGER NOT NULL,
    PRIMARY KEY (idPubli, idHashtag),
    FOREIGN KEY (idPubli) REFERENCES Publication(idPubli) ON DELETE CASCADE,
    FOREIGN KEY (idHashtag) REFERENCES Hashtag(idHashtag) ON DELETE CASCADE
);

-- ============================================================
-- 4. RELATIONS & MODÉRATION
-- ============================================================

CREATE TABLE IF NOT EXISTS Abonnement (
    idUserAbonne INTEGER NOT NULL,
    idUserSuivi INTEGER NOT NULL,
    dateAbonnement DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (idUserAbonne, idUserSuivi),
    FOREIGN KEY (idUserAbonne) REFERENCES Utilisateur(idUser) ON DELETE CASCADE,
    FOREIGN KEY (idUserSuivi) REFERENCES Utilisateur(idUser) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Blocage (
    idUserBloqueur INTEGER NOT NULL,
    idUserBloque INTEGER NOT NULL,
    dateBlocage DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (idUserBloqueur, idUserBloque),
    FOREIGN KEY (idUserBloqueur) REFERENCES Utilisateur(idUser) ON DELETE CASCADE,
    FOREIGN KEY (idUserBloque) REFERENCES Utilisateur(idUser) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Signalement (
    idSignalement INTEGER PRIMARY KEY AUTOINCREMENT,
    idUserAuteur INTEGER NOT NULL,
    typeContenu TEXT CHECK(typeContenu IN ('publication', 'commentaire', 'utilisateur', 'media')) NOT NULL,
    idContenu INTEGER NOT NULL,
    motif TEXT NOT NULL,
    dateSignalement DATETIME DEFAULT CURRENT_TIMESTAMP,
    statut TEXT CHECK(statut IN ('en_attente', 'traite', 'rejete')) DEFAULT 'en_attente',
    FOREIGN KEY (idUserAuteur) REFERENCES Utilisateur(idUser) ON DELETE CASCADE
);

-- ============================================================
-- 5. MESSAGERIE INSTANTANÉE
-- ============================================================

CREATE TABLE IF NOT EXISTS Conversation (
    idConversation INTEGER PRIMARY KEY AUTOINCREMENT,
    titreGroupe TEXT,
    dateCreation DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ConversationMembre (
    idConversation INTEGER NOT NULL,
    idUser INTEGER NOT NULL,
    dateRejoint DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (idConversation, idUser),
    FOREIGN KEY (idConversation) REFERENCES Conversation(idConversation) ON DELETE CASCADE,
    FOREIGN KEY (idUser) REFERENCES Utilisateur(idUser) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Message (
    idMessage INTEGER PRIMARY KEY AUTOINCREMENT,
    idConversation INTEGER NOT NULL,
    idUser INTEGER NOT NULL,
    contenu TEXT NOT NULL,
    dateEnvoi DATETIME DEFAULT CURRENT_TIMESTAMP,
    lu INTEGER DEFAULT 0,
    dateLecture DATETIME,
    FOREIGN KEY (idConversation) REFERENCES Conversation(idConversation) ON DELETE CASCADE,
    FOREIGN KEY (idUser) REFERENCES Utilisateur(idUser) ON DELETE CASCADE
);

-- ============================================================
-- 6. ACTIVITÉ & SYSTÈME
-- ============================================================

CREATE TABLE IF NOT EXISTS Notification (
    idNotif INTEGER PRIMARY KEY AUTOINCREMENT,
    idUser INTEGER NOT NULL,
    type TEXT NOT NULL,
    idSource INTEGER,
    dateNotif DATETIME DEFAULT CURRENT_TIMESTAMP,
    lu INTEGER DEFAULT 0,
    FOREIGN KEY (idUser) REFERENCES Utilisateur(idUser) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS VuePublication (
    idVue INTEGER PRIMARY KEY AUTOINCREMENT,
    idPubli INTEGER NOT NULL,
    idUser INTEGER,
    dateVue DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idPubli) REFERENCES Publication(idPubli) ON DELETE CASCADE,
    FOREIGN KEY (idUser) REFERENCES Utilisateur(idUser) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Recherche (
    idRecherche INTEGER PRIMARY KEY AUTOINCREMENT,
    idUser INTEGER NOT NULL,
    motclef TEXT NOT NULL,
    dateRecherche DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idUser) REFERENCES Utilisateur(idUser) ON DELETE CASCADE
);