const request = require('supertest');
const app = require('../service');
const { createAdminUser, createDinerUser } = require('../../tests/user.js');
const { randomName } = require('../../tests/randomName.js');
const { clearDatabase } = require('../../tests/database.js');

let adminUser;
let dinerUser;
let adminAuthToken;
let dinerAuthToken;
let franchise;
let franchiseId;

const getFranchisesQuery = {name: '',page: 1, limit: 10};

beforeAll(async () => {
    // clear the database before running tests
    await clearDatabase();
    
    // create admin and diner users and get their auth tokens
    adminUser = await createAdminUser();
    dinerUser = await createDinerUser();
    adminAuthToken = await request(app).put('/api/auth').send(adminUser).then(res => res.body.token);
    dinerAuthToken = await request(app).put('/api/auth').send(dinerUser).then(res => res.body.token);

    // create a franchise for testing
    franchise = {name: randomName(), admins: [{email: adminUser.email}]};
    const createFranchiseRes = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(franchise)
    expect (createFranchiseRes.status).toBe(200);
    franchiseId = createFranchiseRes.body.id;
})

test('create franchise as admin', async () =>{
    const createFranchiseReq = {name: randomName(), admins: [{email: adminUser.email}]};
    const createFranchiseRes = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(createFranchiseReq)
    expect (createFranchiseRes.status).toBe(200);
    expect (createFranchiseRes.body).toMatchObject(createFranchiseReq);
})

test('create franchise as diner', async () =>{
    const createFranchiseReq = {name: randomName(), admins: [{email: dinerUser.email}]};
    const createFranchiseRes = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${dinerAuthToken}`)
        .send(createFranchiseReq)
    expect (createFranchiseRes.status).toBe(403);
})

test('create franchise already exists', async () => {
    const createFranchiseReq = {name: franchise.name, admins: [{email: adminUser.email}]};
    const createFranchiseRes = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(createFranchiseReq)
    expect (createFranchiseRes.status).toBe(500);
})

test('get franchises as admin', async () =>{
    const getFranchisesReq = { query: getFranchisesQuery };
    const getFranchisesRes = await request(app)
        .get('/api/franchise')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .query(getFranchisesReq);
    expect(getFranchisesRes.status).toBe(200);
    expect(getFranchisesRes.body.franchises.length).toBeGreaterThan(0);

    expect(getFranchisesRes.body.franchises).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                admins: expect.arrayContaining([
                    expect.objectContaining({ email: adminUser.email })
                ])
            })
        ])
    );
})

test('get franchises as diner', async () => {
    const getFranchisesReq = {query: getFranchisesQuery};
    const getFranchisesRes = await request(app)
        .get('/api/franchise')
        .set('Authorization', `Bearer ${dinerAuthToken}`)
        .query(getFranchisesReq)
    expect (getFranchisesRes.status).toBe(200);
    expect (getFranchisesRes.body.franchises.length).toBeGreaterThan(0);
    expect (getFranchisesRes.body.franchises).toEqual(
        expect.arrayContaining([
            expect.objectContaining({name: franchise.name})
        ])
    );
})

test('get user franchises as admin', async () => {
    const getUserFranchisesRes = await request(app)
        .get(`/api/franchise/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminAuthToken}`);
    expect (getUserFranchisesRes.status).toBe(200);
    expect (getUserFranchisesRes.body.length).toBeGreaterThan(0);
    expect (getUserFranchisesRes.body).toEqual(
        expect.arrayContaining([
            expect.objectContaining({name: franchise.name})
        ])
    );
})

test('get user franchises bad id', async () => {
    const getUserFranchisesRes = await request(app)
        .get(`/api/franchise/999999`)
        .set('Authorization', `Bearer ${adminAuthToken}`);
    expect (getUserFranchisesRes.status).toBe(200);
    expect (getUserFranchisesRes.body.length).toBe(0);
})

test('delete franchise', async () => {
    const createFranchiseReq = {name: randomName(), admins: [{email: adminUser.email}]};
    const createFranchiseRes = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(createFranchiseReq)
    expect (createFranchiseRes.status).toBe(200);

    const franchiseId = createFranchiseRes.body.id;
    const deleteFranchiseRes = await request(app)
        .delete(`/api/franchise/${franchiseId}`)
    expect (deleteFranchiseRes.status).toBe(200);
})

test('add store to franchise as admin', async () => {
    const createStoreReq = {name: randomName()};
    const createStoreRes = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(createStoreReq)
    expect (createStoreRes.status).toBe(200);
    expect (createStoreRes.body).toMatchObject(createStoreReq);
})

test('add store to franchise as diner', async () => {
    const createStoreReq = {name: randomName()};
    const createStoreRes = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${dinerAuthToken}`)
        .send(createStoreReq)
    expect (createStoreRes.status).toBe(403);
})

test('add store to non-existent franchise', async () => {
    const createStoreReq = {name: randomName()};
    const createStoreRes = await request(app)
        .post(`/api/franchise/999999/store`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(createStoreReq)
    expect (createStoreRes.status).toBe(500);
})

test('delete store from franchise', async () => {
    const createStoreReq = {name: randomName()};
    const createStoreRes = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(createStoreReq)
    expect (createStoreRes.status).toBe(200);

    const storeId = createStoreRes.body.id;
    const deleteStoreRes = await request(app)
        .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
    expect (deleteStoreRes.status).toBe(200);
})

test('delete store from franchise as diner', async () => {
    const createStoreReq = {name: randomName()};
    const createStoreRes = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(createStoreReq)
    expect (createStoreRes.status).toBe(200);

    const storeId = createStoreRes.body.id;
    const deleteStoreRes = await request(app)
        .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
        .set('Authorization', `Bearer ${dinerAuthToken}`)
    expect (deleteStoreRes.status).toBe(403);
})