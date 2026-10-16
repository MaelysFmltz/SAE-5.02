const db = require('../src/config/database');

db.exec(`
    ALTER TABLE Publication
    ADD COLUMN typePublication TEXT NOT NULL DEFAULT 'original'
    CHECK(typePublication IN ('original', 'repost', 'duo', 'collage'));
`);

console.log('Colonne typePublication ajoutée.');