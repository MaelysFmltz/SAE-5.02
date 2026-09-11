const adminMiddleware = require('../src/middlewares/adminMiddleware');

describe('Droits administrateur', () => {
    test('autoriser un administrateur', () => {
        const req = {
            user: {
                idUser: 2,
                role: 'admin'
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        const next = jest.fn();

        adminMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    test('refuser un utilisateur classique', () => {
        const req = {
            user: {
                idUser: 1,
                role: 'user'
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        const next = jest.fn();

        adminMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Accès réservé aux administrateurs'
        });
        expect(next).not.toHaveBeenCalled();
    });

    test('refuser une requête sans utilisateur', () => {
        const req = {};

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        const next = jest.fn();

        adminMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
});