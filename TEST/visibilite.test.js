import VISIBILITE from './visibilite.js';

test('Une publication publique possède la visibilité 1', () => {
    expect(VISIBILITE.PUBLIC).toBe(1);
});

test('Une publication privée/amis possède la visibilité 0', () => {
    expect(VISIBILITE.PRIVE_AMIS).toBe(0);
});