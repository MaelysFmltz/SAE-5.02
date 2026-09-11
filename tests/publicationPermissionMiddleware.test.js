jest.mock('../src/config/database', () => ({}));

jest.mock('../src/services/postService', () => ({
    peutVoirPublication: jest.fn()
}));

const publicationPermissionMiddleware = require('../src/middlewares/publicationPermissionMiddleware');
const { peutVoirPublication } = require('../src/services/postService');

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('publicationPermissionMiddleware', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("renvoie 401 si l'utilisateur n'est pas authentifié", () => {
        const req = { params: { idPubli: '1' }, user: undefined };
        const res = mockRes();
        const next = jest.fn();

        publicationPermissionMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Utilisateur non authentifié' });
        expect(peutVoirPublication).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test("renvoie 400 si idPubli n'est pas un entier", () => {
        const req = { params: { idPubli: 'abc' }, user: { idUser: 1 } };
        const res = mockRes();
        const next = jest.fn();

        publicationPermissionMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(peutVoirPublication).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test("renvoie 400 si idPubli est un nombre décimal ('1.5')", () => {
        const req = { params: { idPubli: '1.5' }, user: { idUser: 1 } };
        const res = mockRes();
        const next = jest.fn();

        publicationPermissionMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    test("renvoie 403 si peutVoirPublication refuse l'accès", () => {
        peutVoirPublication.mockReturnValue(false);
        const req = { params: { idPubli: '1' }, user: { idUser: 42 } };
        const res = mockRes();
        const next = jest.fn();

        publicationPermissionMiddleware(req, res, next);

        expect(peutVoirPublication).toHaveBeenCalledWith(expect.anything(), 1, 42);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    test("appelle next() si peutVoirPublication autorise l'accès", () => {
        peutVoirPublication.mockReturnValue(true);
        const req = { params: { idPubli: '1' }, user: { idUser: 42 } };
        const res = mockRes();
        const next = jest.fn();

        publicationPermissionMiddleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    test("idPubli = '0' est un entier valide (pas de rejet 400)", () => {
        peutVoirPublication.mockReturnValue(true);
        const req = { params: { idPubli: '0' }, user: { idUser: 1 } };
        const res = mockRes();
        const next = jest.fn();

        publicationPermissionMiddleware(req, res, next);

        expect(res.status).not.toHaveBeenCalledWith(400);
        expect(peutVoirPublication).toHaveBeenCalledWith(expect.anything(), 0, 1);
    });

});
