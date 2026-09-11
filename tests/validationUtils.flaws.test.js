const {
  validatePseudo,
  validateEmail,
  validatePassword,
  validateBirthDate
} = require('../src/utils/validationUtils');

describe('validationUtils.js - comportements à vérifier par exécution réelle', () => {
  test('PSEUDO_REGEX accepte "×" (U+00D7) comme si c\'était une lettre accentuée', () => {
    expect(() => validatePseudo('ab×')).not.toThrow();
    expect(validatePseudo('ab×')).toBe('ab×');
  });

  test('PSEUDO_REGEX accepte "÷" (U+00F7) comme si c\'était une lettre accentuée', () => {
    expect(() => validatePseudo('ab÷')).not.toThrow();
  });

  test('validateEmail accepte une adresse avec des points consécutifs', () => {
    expect(() => validateEmail('a..b@test.com')).not.toThrow();
  });

  test('validateEmail accepte une adresse avec un domaine réduit à un tiret', () => {
    expect(() => validateEmail('a@-.com')).not.toThrow();
  });

  // Ces deux tests ne sont pas des failles : ils prouvent que la fonction,
  // ISOLÉE, fait bien son travail (authService.js les appelle désormais
  // correctement, voir authService.flaws.test.js).
  test('validatePassword rejette bien un mot de passe faible quand elle est appelée seule', () => {
    expect(() => validatePassword('1')).toThrow();
  });

  test('validateBirthDate rejette bien une date future quand elle est appelée seule', () => {
    const futureYear = new Date().getFullYear() + 1;

    expect(() => validateBirthDate(`${futureYear}-01-01`)).toThrow();
  });
});
