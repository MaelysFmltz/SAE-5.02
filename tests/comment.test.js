process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-de-test-uniquement';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const db = require('../src/config/database');
const commentModel = require('../src/models/commentModel');

function tokenPour(idUser, pseudo, role = 'user') {
  return jwt.sign({ idUser, pseudo, role }, process.env.JWT_SECRET);
}

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
    expect(comments[0]).toMatchObject({
      contenuCom: 'Premier',
      pseudo: 'alice'
    });
    expect(comments[1]).toMatchObject({
      contenuCom: 'Second',
      pseudo: 'bob'
    });
  });

  test("getCommentsByPostId renvoie un tableau vide s'il n'y a aucun commentaire", () => {
    expect(commentModel.getCommentsByPostId(1)).toEqual([]);
  });

  test("updateComment modifie le commentaire quand l'idUser correspond à l'auteur", () => {
    const comment = commentModel.createComment(1, 1, 'Original');

    const succes = commentModel.updateComment(
      comment.idComm,
      1,
      'Modifié'
    );

    expect(succes).toBe(true);
    expect(
      commentModel.getCommentsByPostId(1)[0].contenuCom
    ).toBe('Modifié');
  });

  test("updateComment échoue quand l'idUser ne correspond pas à l'auteur", () => {
    const comment = commentModel.createComment(1, 1, 'Original');

    const succes = commentModel.updateComment(
      comment.idComm,
      2,
      'Piraté'
    );

    expect(succes).toBe(false);
    expect(
      commentModel.getCommentsByPostId(1)[0].contenuCom
    ).toBe('Original');
  });

  test("deleteComment supprime le commentaire quand l'idUser correspond à l'auteur", () => {
    const comment = commentModel.createComment(
      1,
      1,
      'À supprimer'
    );

    const succes = commentModel.deleteComment(
      comment.idComm,
      1
    );

    expect(succes).toBe(true);
    expect(
      commentModel.getCommentsByPostId(1)
    ).toHaveLength(0);
  });

  test("deleteComment échoue quand l'idUser ne correspond pas à l'auteur", () => {
    const comment = commentModel.createComment(
      1,
      1,
      'Protégé'
    );

    const succes = commentModel.deleteComment(
      comment.idComm,
      2
    );

    expect(succes).toBe(false);
    expect(
      commentModel.getCommentsByPostId(1)
    ).toHaveLength(1);
  });

  test('updateComment/deleteComment sur un id inexistant renvoient false sans planter', () => {
    expect(
      commentModel.updateComment(9999, 1, 'x')
    ).toBe(false);

    expect(
      commentModel.deleteComment(9999, 1)
    ).toBe(false);
  });

});

describe(
  'API commentaires - authentification et anti-spoofing obligatoires',
  () => {

    test(
      "POST /api/comments refuse une requête sans token/session",
      async () => {
        const res = await request(app)
          .post('/api/comments')
          .send({
            idPubli: 1,
            idUser: 1,
            contenuCom: 'Anonyme'
          });

        expect(res.status).toBe(401);
        expect(
          commentModel.getCommentsByPostId(1)
        ).toHaveLength(0);
      }
    );

    test(
      "POST /api/comments : un idUser fourni dans le body est ignoré, l'auteur vient du token",
      async () => {
        await request(app)
          .post('/api/comments')
          .set('Authorization', `Bearer ${tokenPour(1, 'alice')}`)
          .send({
            idPubli: 1,
            idUser: 2,
            contenuCom: 'Tentative de spoof'
          });

        const comments =
          commentModel.getCommentsByPostId(1);

        expect(comments).toHaveLength(1);
        expect(comments[0].pseudo).toBe('alice');
      }
    );

    test(
      "POST /api/comments/:idComm/edit refuse une requête sans token/session",
      async () => {
        const comment = commentModel.createComment(1, 1, "Commentaire d'alice");

        const res = await request(app)
          .post(`/api/comments/${comment.idComm}/edit`)
          .send({ idPubli: 1, idUser: 1, contenuCom: 'Modifié anonymement' });

        expect(res.status).toBe(401);
        expect(
          commentModel.getCommentsByPostId(1)[0].contenuCom
        ).toBe("Commentaire d'alice");
      }
    );

    test(
      "POST /api/comments/:idComm/edit : bob ne peut pas modifier le commentaire d'alice en spoofant idUser",
      async () => {
        const comment = commentModel.createComment(1, 1, "Commentaire d'alice");

        const res = await request(app)
          .post(`/api/comments/${comment.idComm}/edit`)
          .set('Authorization', `Bearer ${tokenPour(2, 'bob')}`)
          .send({ idPubli: 1, idUser: 1, contenuCom: 'Modifié par un usurpateur' });

        expect(res.status).toBe(403);
        expect(
          commentModel.getCommentsByPostId(1)[0].contenuCom
        ).toBe("Commentaire d'alice");
      }
    );

    test(
      "POST /api/comments/:idComm/delete refuse une requête sans token/session",
      async () => {
        const comment = commentModel.createComment(2, 1, 'Commentaire de bob');

        const res = await request(app)
          .post(`/api/comments/${comment.idComm}/delete`)
          .send({ idPubli: 1, idUser: 2 });

        expect(res.status).toBe(401);
        expect(
          commentModel.getCommentsByPostId(1)
        ).toHaveLength(1);
      }
    );

    test(
      "POST /api/comments/:idComm/delete : alice ne peut pas supprimer le commentaire de bob en spoofant idUser",
      async () => {
        const comment = commentModel.createComment(2, 1, 'Commentaire de bob');

        const res = await request(app)
          .post(`/api/comments/${comment.idComm}/delete`)
          .set('Authorization', `Bearer ${tokenPour(1, 'alice')}`)
          .send({ idPubli: 1, idUser: 2 });

        expect(res.status).toBe(403);
        expect(
          commentModel.getCommentsByPostId(1)
        ).toHaveLength(1);
      }
    );

  }
);

describe('API commentaires - comportement fonctionnel', () => {

  test(
    'GET /api/comments/:idPubli (REST) renvoie du JSON',
    async () => {
      commentModel.createComment(
        1,
        1,
        'Un commentaire'
      );

      const res = await request(app)
        .get('/api/comments/1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].contenuCom).toBe(
        'Un commentaire'
      );
    }
  );

  test(
    'POST /api/comments refuse un commentaire de plus de 500 caractères',
    async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${tokenPour(1, 'alice')}`)
        .send({
          idPubli: 1,
          contenuCom: 'a'.repeat(501)
        });

      expect(res.status).toBe(400);
      expect(
        commentModel.getCommentsByPostId(1)
      ).toHaveLength(0);
    }
  );

  test(
    'POST /api/comments avec un contenu vide ne crée rien mais redirige quand même comme un succès',
    async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Cookie', `token=${tokenPour(1, 'alice')}`)
        .send({
          idPubli: 1,
          contenuCom: '   '
        });

      expect(res.status).toBe(302);
      expect(
        commentModel.getCommentsByPostId(1)
      ).toHaveLength(0);
    }
  );

  test(
    "DELETE /api/comments/:idComm (route REST) redirige au lieu de répondre en JSON",
    async () => {
      const comment = commentModel.createComment(
        1,
        1,
        'À supprimer via REST'
      );

      const res = await request(app)
        .delete(`/api/comments/${comment.idComm}`)
        .set('Cookie', `token=${tokenPour(1, 'alice')}`)
        .send();

      expect(res.status).toBe(302);
      expect(
        res.headers['content-type']
      ).not.toMatch(/json/);
    }
  );

  test(
    'GET /api/comments/view/:idPubli affiche la page et échappe correctement le HTML du commentaire (pas de XSS reflété)',
    async () => {
      commentModel.createComment(
        1,
        1,
        '<script>alert(1)</script>'
      );

      const res = await request(app)
        .get('/api/comments/view/1');

      expect(res.status).toBe(200);
      expect(res.text).not.toContain(
        '<script>alert(1)</script>'
      );
      expect(res.text).toContain(
        '&lt;script&gt;'
      );
    }
  );

  test(
    "GET /api/comments/view/:idPubli sur une publication inexistante ne plante pas (fallback)",
    async () => {
      const res = await request(app)
        .get('/api/comments/view/9999');

      expect(res.status).toBe(200);
    }
  );

});