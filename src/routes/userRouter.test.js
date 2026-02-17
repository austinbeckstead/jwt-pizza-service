const request = require('supertest');
const app = require('../service');
const { createAdminUser, createDinerUser, registerUser, loginUser } = require('../../tests/user.js');
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


  test('list users unauthorized (no auth token)', async () => {
    const listUsersRes = await request(app).get('/api/user');
    expect(listUsersRes.status).toBe(401);
  });

  test('list users unauthorized (not admin)', async () => {
    const listUsersRes = await request(app)
      .get('/api/user')
      .set('Authorization', `Bearer ${dinerAuthToken}`);
    expect(listUsersRes.status).toBe(403);
  });

  test('list users', async () => {
    const listUsersRes = await request(app)
      .get('/api/user')
      .set('Authorization', `Bearer ${adminAuthToken}`);
    expect(listUsersRes.status).toBe(200);
    expect(listUsersRes.body.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: dinerUser.id,
        }),
        expect.objectContaining({
          id: adminUser.id,
        }),
      ])
    );
  });

  test('delete user not admin', async () => {
    const deleteRes = await request(app)
      .delete(`/api/user/${dinerUser.id}`)
      .set('Authorization', `Bearer ${dinerAuthToken}`);
    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body.message).toBe('unauthorized');
  });

  test('delete user', async () => {
    const deleteRes = await request(app)
      .delete(`/api/user/${dinerUser.id}`)
      .set('Authorization', `Bearer ${adminAuthToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe('user deleted');

    const listUsersRes = await request(app)
      .get('/api/user')
      .set('Authorization', `Bearer ${adminAuthToken}`);
    expect(listUsersRes.status).toBe(200);
    expect(listUsersRes.body.users).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: dinerUser.id,
        }),
      ])
    );
  });
});
