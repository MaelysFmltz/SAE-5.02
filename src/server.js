require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.error(
    'ERREUR : JWT_SECRET absent du fichier .env'
  );

  process.exit(1);
}

app.listen(PORT, () => {
  console.log(
    `Serveur lancé sur http://localhost:${PORT}`
  );
});