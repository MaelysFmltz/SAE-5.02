const { hashPassword, comparePassword } = require('../src/utils/passwordUtils');

const {
  validatePseudo,
  validateEmail,
  validatePassword,
  validateBirthDate
} = require('../src/utils/validationUtils');

describe('passwordUtils', () => {
  test('hashPassword produit un hash différent du mot de passe en clair', async () => {
    const hash = await hashPassword('motdepasse');

    expect(hash).not.toBe('motdepasse');
    expect(hash.length).toBeGreaterThan(0);
  });

  test('comparePassword valide le bon mot de passe', async () => {
    const hash = await hashPassword('motdepasse');

    await expect(comparePassword('motdepasse', hash)).resolves.toBe(true);
  });

  test('comparePassword rejette un mauvais mot de passe', async () => {
    const hash = await hashPassword('motdepasse');

    await expect(comparePassword('autrechose', hash)).resolves.toBe(false);
  });
});

describe('validationUtils.validatePseudo', () => {
  test('accepte un pseudo valide', () => {
    expect(validatePseudo('chloe_01')).toBe('chloe_01');
  });

  test('rejette un pseudo trop court', () => {
    expect(() => validatePseudo('ab')).toThrow();
  });

  test('rejette un pseudo contenant des caractères interdits', () => {
    expect(() => validatePseudo('chloe@!')).toThrow();
  });

  test('retire les balises HTML via sanitizeText', () => {
    expect(() => validatePseudo('<b>chloe</b>')).not.toThrow();
    expect(validatePseudo('<b>chloe</b>')).toBe('chloe');
  });
});

describe('validationUtils.validateEmail', () => {
  test('accepte un email valide et le met en minuscule', () => {
    expect(validateEmail('Chloe@Test.com')).toBe('chloe@test.com');
  });

  test('rejette un email sans arobase', () => {
    expect(() => validateEmail('chloe-test.com')).toThrow();
  });

  test('rejette un email trop long', () => {
    const longEmail = `${'a'.repeat(250)}@test.com`;

    expect(() => validateEmail(longEmail)).toThrow();
  });
});

describe('validationUtils.validatePassword', () => {
  test('accepte un mot de passe conforme à la politique', () => {
    expect(validatePassword('Motdepasse1!')).toBe('Motdepasse1!');
  });

  test('rejette un mot de passe trop court', () => {
    expect(() => validatePassword('Mdp1!')).toThrow();
  });

  test('rejette un mot de passe sans majuscule', () => {
    expect(() => validatePassword('motdepasse1!')).toThrow();
  });

  test('rejette un mot de passe sans caractère spécial', () => {
    expect(() => validatePassword('Motdepasse1')).toThrow();
  });
});

describe('validationUtils.validateBirthDate', () => {
  test('accepte une date valide', () => {
    expect(validateBirthDate('2000-01-01')).toBe('2000-01-01');
  });

  test('retourne null si aucune date fournie', () => {
    expect(validateBirthDate(undefined)).toBeNull();
    expect(validateBirthDate('')).toBeNull();
  });

  test('rejette une date dans le futur', () => {
    const nextYear = new Date().getFullYear() + 1;

    expect(() => validateBirthDate(`${nextYear}-01-01`)).toThrow();
  });

  test('rejette une date calendaire invalide', () => {
    expect(() => validateBirthDate('2023-02-30')).toThrow();
  });
});
