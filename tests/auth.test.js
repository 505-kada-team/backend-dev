const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Auth API', () => {
  const newUser = {
    name: 'Budi Santoso',
    email: 'budi@example.com',
    password: 'password123',
  };

  it('berhasil registrasi user baru', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(newUser);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(newUser.email);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('menolak registrasi dengan email yang sama', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(newUser);
    expect(res.statusCode).toBe(409);
  });

  it('berhasil login dengan kredensial yang benar', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: newUser.email, password: newUser.password });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('menolak login dengan password salah', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: newUser.email, password: 'salahpassword' });

    expect(res.statusCode).toBe(401);
  });
});
