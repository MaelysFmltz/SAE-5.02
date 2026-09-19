const fs = require('fs');
const path = require('path');

function seedSchema(db) {
  const schema = fs.readFileSync(
    path.join(__dirname, '../database/dump.sql'),
    'utf8'
  );

  db.exec(schema);
}

module.exports = { seedSchema };
