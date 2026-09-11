process.env.JWT_SECRET = 'test-secret-de-test-uniquement';

const jwt = require('jsonwebtoken');

const authMiddleware = require('../src/middlewares/authMiddleware');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis()
  };
}

// req.accepts('html') détermine si le middleware répond en JSON (API) ou
// redirige vers '/' (navigation EJS classique). Un client API envoie un
// Accept: application/json et n'accepte donc pas 'html'.
function apiReq(overrides) {
  return {
    headers: {},
    cookies: {},
    accepts: () => false,
    ...overrides
  };
}

describe('authMiddleware', () => {
  test('refuse une requête API sans cookie ni en-tête Authorization', () => {
    const req = apiReq({ headers: {} });
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('refuse un en-tête Authorization mal formé', () => {
    const req = apiReq({ headers: { authorization: 'Token abc' } });
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('refuse un token invalide', () => {
    const req = apiReq({ headers: { authorization: 'Bearer token.invalide' } });
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('refuse un token expiré', () => {
    const token = jwt.sign(
      { idUser: 1 },
      process.env.JWT_SECRET,
      { expiresIn: -1 }
    );

    const req = apiReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('laisse passer un token valide envoyé en en-tête Authorization', () => {
    const token = jwt.sign(
      { idUser: 1, pseudo: 'chloe', role: 'user' },
      process.env.JWT_SECRET
    );

    const req = apiReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ idUser: 1, pseudo: 'chloe', role: 'user' });
  });

  test('laisse passer un token valide envoyé en cookie', () => {
    const token = jwt.sign(
      { idUser: 2, pseudo: 'bob', role: 'user' },
      process.env.JWT_SECRET
    );

    const req = apiReq({ cookies: { token } });
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ idUser: 2, pseudo: 'bob', role: 'user' });
  });

  test('le cookie est prioritaire sur le header Authorization si les deux sont présents', () => {
    const cookieToken = jwt.sign({ idUser: 1 }, process.env.JWT_SECRET);
    const headerToken = jwt.sign({ idUser: 2 }, process.env.JWT_SECRET);

    const req = apiReq({
      cookies: { token: cookieToken },
      headers: { authorization: `Bearer ${headerToken}` }
    });
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(req.user.idUser).toBe(1);
  });

  test('redirige vers / (au lieu de renvoyer un 401 JSON) pour une requête navigateur sans token', () => {
    const req = { headers: {}, cookies: {}, accepts: () => true };
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith('/');
    expect(res.status).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('efface le cookie token invalide avant de rediriger', () => {
    const req = {
      headers: {},
      cookies: { token: 'token.invalide' },
      accepts: () => true
    };
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.clearCookie).toHaveBeenCalledWith('token');
    expect(res.redirect).toHaveBeenCalledWith('/');
  });
});
