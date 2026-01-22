const { Role, DB } = require('../src/database/database.js');
const {randomName } = require('./randomName.js');

async function createAdminUser() {
  let user = { password: 'adminPassword', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@jwt.com';

  user = await DB.addUser(user);
  return { ...user, password: 'adminPassword' };
}

async function createDinerUser() {
    let user = { password: 'dinerPassword', roles: [{ role: Role.Diner }] };
    user.name = randomName();
    user.email = user.name + '@jwt.com';

    user = await DB.addUser(user);
    return { ...user, password: 'dinerPassword' };

}

module.exports = { createAdminUser, createDinerUser };