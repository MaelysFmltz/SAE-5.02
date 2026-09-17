jest.mock('../src/config/database', () => ({}));

const publicationRoutes = require('../src/routes/publicationRoutes');
const publicationPermissionMiddleware = require('../src/middlewares/publicationPermissionMiddleware');

describe('publicationRoutes', () => {

    test("expose au moins une route de publication (échoue tant que la branche n'est pas câblée)", () => {
        const routeLayers = publicationRoutes.stack.filter(layer => layer.route);

        expect(routeLayers.length).toBeGreaterThan(0);
    });

    test("la route de consultation d'une publication applique publicationPermissionMiddleware", () => {
        const usesPermissionMiddleware = publicationRoutes.stack.some(layer =>
            layer.route &&
            layer.route.stack.some(handler => handler.handle === publicationPermissionMiddleware)
        );

        expect(usesPermissionMiddleware).toBe(true);
    });

});
