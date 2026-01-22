const request = require('supertest');
const app = require('../service');
const { createAdminUser, createDinerUser } = require('../../tests/user.js');
const { randomName } = require('../../tests/randomName.js');
const { clearDatabase } = require('../../tests/database.js');

let adminUser;
let dinerUser;
let adminAuthToken;
let dinerAuthToken;

beforeAll(async () => {
  await clearDatabase();
  adminUser = await createAdminUser();
  dinerUser = await createDinerUser();
  adminAuthToken = await request(app).put('/api/auth').send(adminUser).then(res => res.body.token);
  dinerAuthToken = await request(app).put('/api/auth').send(dinerUser).then(res => res.body.token);
});

describe('User Router', () => {
  test('get authenticated user (me)', async () => {
    const res = await request(app)
      .get('/api/user/me')
      .set('Authorization', `Bearer ${adminAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      name: adminUser.name,
      email: adminUser.email,
      roles: expect.arrayContaining([{ role: 'admin' }])
    });
  });

  test('update user (self)', async () => {
    const newName = randomName();
    const res = await request(app)
      .put(`/api/user/${adminUser.id}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send({ name: newName, email: adminUser.email, password: 'newpass' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: adminUser.id,
      name: newName,
      email: adminUser.email,
      roles: expect.arrayContaining([{ role: 'admin' }])
    });
    expect(res.body.token).toBeDefined();
  });

  test('update user (unauthorized)', async () => {
    const res = await request(app)
      .put(`/api/user/${adminUser.id}`)
      .set('Authorization', `Bearer ${dinerAuthToken}`)
      .send({ name: 'should not work', email: adminUser.email });
    expect(res.status).toBe(403);
  });

  test('delete user (not implemented)', async () => {
    const res = await request(app)
      .delete(`/api/user/${adminUser.id}`)
      .set('Authorization', `Bearer ${adminAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('not implemented');
  });

  test('list users (not implemented)', async () => {
    const res = await request(app)
      .get('/api/user')
      .set('Authorization', `Bearer ${adminAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('not implemented');
    expect(res.body.users).toEqual([]);
    expect(res.body.more).toBe(false);
  });
});
