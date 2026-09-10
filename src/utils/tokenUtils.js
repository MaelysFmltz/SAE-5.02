const jwt = require('jsonwebtoken');

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET non configuré'
    );
  }

  return jwt.sign(
    {
      idUser: user.idUser,
      pseudo: user.pseudo,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '2h'
    }
  );
}

module.exports = {
  createToken
};