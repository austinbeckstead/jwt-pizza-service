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

async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

async function loginUser(service, user) {
  const loginRes = await service.put('/api/auth').send(user);
  return loginRes.body.token;
}


module.exports = { createAdminUser, createDinerUser, registerUser, loginUser };