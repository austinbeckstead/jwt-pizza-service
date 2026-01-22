const request = require('supertest');
const app = require('../service');
const { expectValidJwt } = require('../../tests/auth.js');
const { randomName } = require('../../tests/randomName.js');
const { clearDatabase } = require('../../tests/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

beforeAll(async () => {
  // clear the database before running tests
  await clearDatabase();

  // register the test user and get the auth token
  testUser.email = randomName() + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test('register', async () => {
    const name = randomName();
    const registerRes = await request(app).post('/api/auth').send({
      name: name,
      email: name + '@test.com',
      password: 'password'
    });
    expect(registerRes.status).toBe(200);
    expectValidJwt(registerRes.body.token);
    const expectedUser = { id: expect.any(Number), name: name, email: name + '@test.com', roles: [{ role: 'diner' }] };
    expect(registerRes.body.user).toMatchObject(expectedUser);
});

test('register with no password', async () => {
    const name = randomName();
    const registerRes = await request(app).post('/api/auth').send({
      name: name,
      email: name + '@test.com',
    });
    expect(registerRes.status).toBe(400);
});

test('login', async () => {
  const loginRes = await request(app)
    .put('/api/auth')
    .send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test('login invalid email', async () => {
  const invalidUser = { ...testUser };
  invalidUser.email = 'invalid'
  const loginRes = await request(app)
    .put('/api/auth')
    .send(invalidUser);
  expect(loginRes.status).toBe(404);
});

test('login incorrect password', async () => {
  const invalidUser = { ...testUser };
  invalidUser.password = 'incorrect'
  const loginRes = await request(app)
    .put('/api/auth')
    .send(invalidUser);
  expect(loginRes.status).toBe(404);
});

test('logout', async () => {
    const logoutRes = await request(app)
      .delete('/api/auth')
      .set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(logoutRes.status).toBe(200);
});

test('logout without token', async () => {
    const logoutRes = await request(app)
      .delete('/api/auth');
    expect(logoutRes.status).toBe(401);
});

