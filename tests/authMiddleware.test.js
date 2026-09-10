process.env.JWT_SECRET = 'test-secret-de-test-uniquement';

const jwt = require('jsonwebtoken');

const authMiddleware = require('../src/middlewares/authMiddleware');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
}

describe('authMiddleware', () => {
  test('refuse une requête sans en-tête Authorization', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('refuse un en-tête Authorization mal formé', () => {
    const req = { headers: { authorization: 'Token abc' } };
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('refuse un token invalide', () => {
    const req = { headers: { authorization: 'Bearer token.invalide' } };
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

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('laisse passer un token valide et attache req.user', () => {
    const token = jwt.sign(
      { idUser: 1, pseudo: 'chloe', role: 'user' },
      process.env.JWT_SECRET
    );

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ idUser: 1, pseudo: 'chloe', role: 'user' });
  });
});
