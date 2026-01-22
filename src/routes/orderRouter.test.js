const request = require('supertest');
const app = require('../service');
const { clearDatabase } = require('../../tests/database.js');
const { createAdminUser, createDinerUser } = require('../../tests/user.js');    

let adminUser;
let dinerUser;
let adminAuthToken;
let dinerAuthToken;
const defaultMenuItem = { title: 'Default Item', description: 'Default Description', image: 'default-image.jpg', price: 11.99 };
const menuItem = { title: 'Test Item', description: 'Test Description', image: 'test-image.jpg', price: 10.99 };

beforeAll(async () => {
    // clear the database before running tests
    await clearDatabase();

    // create admin and diner users and get their auth tokens
    adminUser = await createAdminUser();
    dinerUser = await createDinerUser();
    adminAuthToken = await request(app).put('/api/auth').send(adminUser).then(res => res.body.token);
    dinerAuthToken = await request(app).put('/api/auth').send(dinerUser).then(res => res.body.token);

    // add a default menu item for testing
    await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(defaultMenuItem);
})

test('add a menu item', async () => {
    const addMenuItemRes = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(menuItem);
    expect (addMenuItemRes.status).toBe(200);
    expect (addMenuItemRes.body).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                title: menuItem.title,
                description: menuItem.description,
                image: menuItem.image,
                price: menuItem.price
            })
        ])
    );
})

test('add a menu item as diner', async () => {
    const addMenuItemRes = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${dinerAuthToken}`)
        .send(menuItem);
    expect (addMenuItemRes.status).toBe(403);
})

test('get the menu', async () => {
    const getMenuRes = await request(app)
        .get('/api/order/menu');
    expect (getMenuRes.status).toBe(200);
    expect (getMenuRes.body).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                title: defaultMenuItem.title,
                description: defaultMenuItem.description,
                image: defaultMenuItem.image,
                price: defaultMenuItem.price
            })
        ]) 
    );
})

test('get orders', async () => {
    const getOrdersRes = await request(app)
        .get('/api/order')
        .set('Authorization', `Bearer ${dinerAuthToken}`);
    expect (getOrdersRes.status).toBe(200);
})
