/**
 * Tests de sécurité et de non-régression des fonctions de validation.
 */

const {
  validatePseudo,
  validateEmail,
  validatePassword,
  validateBirthDate
} = require('../src/utils/validationUtils');

describe('validatePseudo - sécurité', () => {
  test('accepte un pseudo valide', () => {
    expect(validatePseudo('leandro_67')).toBe('leandro_67');
  });

  test('refuse le caractère multiplication U+00D7', () => {
    expect(() => {
      validatePseudo('ab×');
    }).toThrow(/pseudo|lettres|format/i);
  });

  test('refuse le caractère division U+00F7', () => {
    expect(() => {
      validatePseudo('ab÷');
    }).toThrow(/pseudo|lettres|format/i);
  });

  test('refuse un pseudo contenant une balise HTML', () => {
    expect(() => {
      validatePseudo('<script>');
    }).toThrow();
  });

  test('refuse un pseudo trop court', () => {
    expect(() => {
      validatePseudo('ab');
    }).toThrow();
  });

  test('refuse un pseudo trop long', () => {
    expect(() => {
      validatePseudo('a'.repeat(31));
    }).toThrow();
  });
});

describe('validateEmail - sécurité', () => {
  test('accepte et normalise un email valide', () => {
    expect(
      validateEmail('Leandro@Test.com')
    ).toBe('leandro@test.com');
  });

  test('refuse une adresse avec des points consécutifs', () => {
    expect(() => {
      validateEmail('a..b@test.com');
    }).toThrow(/email|format/i);
  });

  test('refuse un domaine réduit à un tiret', () => {
    expect(() => {
      validateEmail('a@-.com');
    }).toThrow(/email|format/i);
  });

  test('refuse un email sans arobase', () => {
    expect(() => {
      validateEmail('utilisateur.test.com');
    }).toThrow(/email|format/i);
  });

  test('refuse un email sans nom de domaine', () => {
    expect(() => {
      validateEmail('utilisateur@');
    }).toThrow(/email|format/i);
  });

  test('refuse une valeur vide', () => {
    expect(() => {
      validateEmail('');
    }).toThrow();
  });
});

describe('validatePassword - sécurité', () => {
  test('accepte un mot de passe suffisamment robuste', () => {
    expect(
      validatePassword('Motdepasse1!')
    ).toBe('Motdepasse1!');
  });

  test('refuse un mot de passe trop court', () => {
    expect(() => {
      validatePassword('1');
    }).toThrow();
  });

  test('refuse un mot de passe sans majuscule', () => {
    expect(() => {
      validatePassword('motdepasse1!');
    }).toThrow();
  });

  test('refuse un mot de passe sans minuscule', () => {
    expect(() => {
      validatePassword('MOTDEPASSE1!');
    }).toThrow();
  });

  test('refuse un mot de passe sans chiffre', () => {
    expect(() => {
      validatePassword('Motdepasse!');
    }).toThrow();
  });

  test('refuse un mot de passe sans caractère spécial', () => {
    expect(() => {
      validatePassword('Motdepasse1');
    }).toThrow();
  });
});

describe('validateBirthDate - sécurité', () => {
  test('accepte une date de naissance valide', () => {
    expect(
      validateBirthDate('2000-01-01')
    ).toBe('2000-01-01');
  });

  test('refuse une date future', () => {
    const futureYear = new Date().getFullYear() + 1;

    expect(() => {
      validateBirthDate(`${futureYear}-01-01`);
    }).toThrow();
  });

  test('refuse une valeur qui ne représente pas une date', () => {
    expect(() => {
      validateBirthDate('pas-une-date');
    }).toThrow();
  });

  test('refuse un format de date incorrect', () => {
    expect(() => {
      validateBirthDate('01/01/2000');
    }).toThrow();
  });
});
