const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

async function hashPassword(motDePasse) {
  return bcrypt.hash(motDePasse, SALT_ROUNDS);
}

async function comparePassword(
  motDePasse,
  hashedPassword
) {
  return bcrypt.compare(
    motDePasse,
    hashedPassword
  );
}

module.exports = {
  hashPassword,
  comparePassword
};