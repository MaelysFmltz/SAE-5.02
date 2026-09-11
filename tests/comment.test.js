process.env.DB_PATH = ':memory:';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const app = require('../src/app');
const db = require('../src/config/database');
const commentModel = require('../src/models/commentModel');

function seedSchema() {
  const schema = fs.readFileSync(
    path.join(__dirname, '../database/dump.sql'),
    'utf8'
  );
  db.exec(schema);
}

beforeAll(() => {
  seedSchema();
});

beforeEach(() => {
  db.exec(`
    INSERT INTO Utilisateur (idUser, pseudo, email, motDePasse)
    VALUES
      (1, 'alice', 'alice@test.com', 'x'),
      (2, 'bob', 'bob@test.com', 'x');

    INSERT INTO Publication (idPubli, idUser, contenuPub, visibilite)
    VALUES (1, 1, 'Une publication', 1);
  `);
});

afterEach(() => {
  db.exec('DELETE FROM Commentaire');
  db.exec('DELETE FROM Publication');
  db.exec('DELETE FROM Utilisateur');
});

afterAll(() => {
  db.close();
});

describe('commentModel', () => {

  test('createComment insère un commentaire et renvoie son id', () => {
    const comment = commentModel.createComment(1, 1, 'Salut');

    expect(comment.idComm).toBeDefined();
    expect(comment.idUser).toBe(1);
    expect(comment.idPubli).toBe(1);
    expect(comment.contenuCom).toBe('Salut');
  });

  test('getCommentsByPostId renvoie les commentaires avec le pseudo de leur auteur, triés par date', () => {
    commentModel.createComment(1, 1, 'Premier');
    commentModel.createComment(2, 1, 'Second');

    const comments = commentModel.getCommentsByPostId(1);

    expect(comments).toHaveLength(2);
    expect(comments[0]).toMatchObject({ contenuCom: 'Premier', pseudo: 'alice' });
    expect(comments[1]).toMatchObject({ contenuCom: 'Second', pseudo: 'bob' });
  });

  test("getCommentsByPostId renvoie un tableau vide s'il n'y a aucun commentaire", () => {
    expect(commentModel.getCommentsByPostId(1)).toEqual([]);
  });

  test("updateComment modifie le commentaire quand l'idUser correspond à l'auteur", () => {
    const comment = commentModel.createComment(1, 1, 'Original');

    const succes = commentModel.updateComment(comment.idComm, 1, 'Modifié');

    expect(succes).toBe(true);
    expect(commentModel.getCommentsByPostId(1)[0].contenuCom).toBe('Modifié');
  });

  test("updateComment échoue quand l'idUser ne correspond pas à l'auteur", () => {
    const comment = commentModel.createComment(1, 1, 'Original');

    const succes = commentModel.updateComment(comment.idComm, 2, 'Piraté');

    expect(succes).toBe(false);
    expect(commentModel.getCommentsByPostId(1)[0].contenuCom).toBe('Original');
  });

  test("deleteComment supprime le commentaire quand l'idUser correspond à l'auteur", () => {
    const comment = commentModel.createComment(1, 1, 'À supprimer');

    const succes = commentModel.deleteComment(comment.idComm, 1);

    expect(succes).toBe(true);
    expect(commentModel.getCommentsByPostId(1)).toHaveLength(0);
  });

  test("deleteComment échoue quand l'idUser ne correspond pas à l'auteur", () => {
    const comment = commentModel.createComment(1, 1, 'Protégé');

    const succes = commentModel.deleteComment(comment.idComm, 2);

    expect(succes).toBe(false);
    expect(commentModel.getCommentsByPostId(1)).toHaveLength(1);
  });

  test('updateComment/deleteComment sur un id inexistant renvoient false sans planter', () => {
    expect(commentModel.updateComment(9999, 1, 'x')).toBe(false);
    expect(commentModel.deleteComment(9999, 1)).toBe(false);
  });

});

describe('API commentaires - failles de sécurité (aucune authentification requise)', () => {

  test("POST /api/comments fonctionne sans aucun token/session : n'importe qui peut publier", async () => {
    const res = await request(app)
      .post('/api/comments')
      .send({ idPubli: 1, idUser: 1, contenuCom: 'Anonyme mais accepté' });

    expect(res.status).toBe(302); // redirect, pas d'erreur
    expect(commentModel.getCommentsByPostId(1)).toHaveLength(1);
  });

  test("POST /api/comments : l'idUser vient du body, donc on peut publier au nom de n'importe quel utilisateur existant", async () => {
    // Rien ne prouve qu'on est réellement "bob" (pas de token, pas de
    // session) : il suffit de connaître son idUser.
    await request(app)
      .post('/api/comments')
      .send({ idPubli: 1, idUser: 2, contenuCom: "Message posté au nom de bob" });

    const comments = commentModel.getCommentsByPostId(1);
    expect(comments).toHaveLength(1);
    expect(comments[0].pseudo).toBe('bob');
  });

  test("POST /api/comments/:idComm/edit : on peut modifier le commentaire d'un autre utilisateur en donnant son idUser", async () => {
    const comment = commentModel.createComment(1, 1, "Commentaire d'alice");

    const res = await request(app)
      .post(`/api/comments/${comment.idComm}/edit`)
      .send({ idPubli: 1, idUser: 1, contenuCom: 'Modifié par un usurpateur' });

    expect(res.status).toBe(302);
    expect(commentModel.getCommentsByPostId(1)[0].contenuCom).toBe('Modifié par un usurpateur');
  });

  test("POST /api/comments/:idComm/delete : on peut supprimer le commentaire d'un autre utilisateur en donnant son idUser", async () => {
    const comment = commentModel.createComment(2, 1, "Commentaire de bob");

    // L'attaquant se contente d'envoyer idUser=2 dans le formulaire, sans
    // jamais s'être authentifié en tant que bob.
    const res = await request(app)
      .post(`/api/comments/${comment.idComm}/delete`)
      .send({ idPubli: 1, idUser: 2 });

    expect(res.status).toBe(302);
    expect(commentModel.getCommentsByPostId(1)).toHaveLength(0);
  });

  test('POST /api/comments sans idUser fourni publie quand même, au nom du user 1 par défaut', async () => {
    await request(app)
      .post('/api/comments')
      .send({ idPubli: 1, contenuCom: 'Sans idUser du tout' });

    const comments = commentModel.getCommentsByPostId(1);
    expect(comments).toHaveLength(1);
    expect(comments[0].idUser).toBe(1);
  });

});

describe('API commentaires - comportement fonctionnel', () => {

  test('GET /api/comments/:idPubli (REST) renvoie du JSON', async () => {
    commentModel.createComment(1, 1, 'Un commentaire');

    const res = await request(app).get('/api/comments/1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].contenuCom).toBe('Un commentaire');
  });

  test('POST /api/comments refuse un commentaire de plus de 500 caractères', async () => {
    const res = await request(app)
      .post('/api/comments')
      .send({ idPubli: 1, idUser: 1, contenuCom: 'a'.repeat(501) });

    expect(res.status).toBe(400);
    expect(commentModel.getCommentsByPostId(1)).toHaveLength(0);
  });

  test('POST /api/comments avec un contenu vide ne crée rien mais redirige quand même comme un succès', async () => {
    const res = await request(app)
      .post('/api/comments')
      .send({ idPubli: 1, idUser: 1, contenuCom: '   ' });

    expect(res.status).toBe(302);
    expect(commentModel.getCommentsByPostId(1)).toHaveLength(0);
  });

  test("DELETE /api/comments/:idComm (route REST) redirige au lieu de répondre en JSON", async () => {
    const comment = commentModel.createComment(1, 1, 'À supprimer via REST');

    const res = await request(app)
      .delete(`/api/comments/${comment.idComm}`)
      .send({ idUser: 1 });

    // removeComment répond toujours par un redirect, même appelée depuis
    // la route "REST" censée renvoyer du JSON.
    expect(res.status).toBe(302);
    expect(res.headers['content-type']).not.toMatch(/json/);
  });

  test('GET /api/comments/view/:idPubli affiche la page et échappe correctement le HTML du commentaire (pas de XSS reflété)', async () => {
    commentModel.createComment(1, 1, '<script>alert(1)</script>');

    const res = await request(app).get('/api/comments/view/1');

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('<script>alert(1)</script>');
    expect(res.text).toContain('&lt;script&gt;');
  });

  test("GET /api/comments/view/:idPubli sur une publication inexistante ne plante pas (fallback)", async () => {
    const res = await request(app).get('/api/comments/view/9999');

    expect(res.status).toBe(200);
  });

});
