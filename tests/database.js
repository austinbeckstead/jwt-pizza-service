const { DB } = require('../src/database/database.js');

async function clearDatabase() {
    const connection = await DB.getConnection();
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE user');
    await connection.query('TRUNCATE TABLE userRole');
    await connection.query('TRUNCATE TABLE franchise');
    await connection.query('TRUNCATE TABLE store');
    await connection.query('TRUNCATE TABLE dinerOrder');
    await connection.query('TRUNCATE TABLE orderItem');
    await connection.query('TRUNCATE TABLE auth');
    await connection.query('TRUNCATE TABLE menu');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    connection.end();
  }
}

module.exports = { clearDatabase };
