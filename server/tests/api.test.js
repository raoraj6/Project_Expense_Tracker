import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

import { createApp } from '../src/app.js';

let mongo;
let app;
let token;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe('auth', () => {
  test('registers a user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'password123' })
      .expect(201);

    assert.ok(res.body.token);
    assert.equal(res.body.user.email, 'ada@example.com');
    assert.equal(res.body.user.passwordHash, undefined, 'password hash must not leak');
    token = res.body.token;
  });

  test('rejects a duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'password123' })
      .expect(409);
  });

  test('rejects a short password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'bob@example.com', password: 'short' })
      .expect(422);
  });

  test('logs in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: 'password123' })
      .expect(200);
    assert.ok(res.body.token);
  });

  test('rejects a wrong password without revealing which field failed', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: 'wrongpassword' })
      .expect(401);
    assert.equal(res.body.error, 'Invalid email or password');
  });

  test('blocks unauthenticated access to transactions', async () => {
    await request(app).get('/api/transactions').expect(401);
  });
});

describe('transactions', () => {
  let txId;

  test('creates an expense', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 250.5, category: 'Groceries', note: 'Weekly shop' })
      .expect(201);

    assert.equal(res.body.amount, 250.5);
    txId = res.body.id;
  });

  test('rejects a category that does not belong to the type', async () => {
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 100, category: 'Salary' })
      .expect(422);
  });

  test('rejects a non-positive amount', async () => {
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 0, category: 'Groceries' })
      .expect(422);
  });

  test('lists with pagination metadata', async () => {
    const res = await request(app)
      .get('/api/transactions?limit=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.equal(res.body.limit, 5);
    assert.equal(res.body.page, 1);
    assert.ok(res.body.total >= 1);
  });

  test('filters by search term', async () => {
    const hit = await request(app)
      .get('/api/transactions?search=weekly')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.equal(hit.body.items.length, 1);

    const miss = await request(app)
      .get('/api/transactions?search=nonexistentterm')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.equal(miss.body.items.length, 0);
  });

  test('updates a transaction', async () => {
    const res = await request(app)
      .patch(`/api/transactions/${txId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 300, category: 'Food & Dining' })
      .expect(200);

    assert.equal(res.body.amount, 300);
    assert.equal(res.body.category, 'Food & Dining');
  });

  test("does not expose another user's transaction", async () => {
    const other = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Eve', email: 'eve@example.com', password: 'password123' })
      .expect(201);

    await request(app)
      .get(`/api/transactions/${txId}`)
      .set('Authorization', `Bearer ${other.body.token}`)
      .expect(404);
  });

  test('deletes a transaction', async () => {
    await request(app)
      .delete(`/api/transactions/${txId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(app)
      .get(`/api/transactions/${txId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});

describe('stats', () => {
  before(async () => {
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post('/api/transactions').set(auth)
      .send({ type: 'income', amount: 1000, category: 'Salary' }).expect(201);
    await request(app).post('/api/transactions').set(auth)
      .send({ type: 'expense', amount: 400, category: 'Transport' }).expect(201);
  });

  test('computes totals, balance and savings rate', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.equal(res.body.summary.income, 1000);
    assert.equal(res.body.summary.expense, 400);
    assert.equal(res.body.summary.balance, 600);
    assert.equal(res.body.summary.savingsRate, 60);
  });

  test('breaks spending down by category', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const transport = res.body.byCategory.find((c) => c.category === 'Transport');
    assert.equal(transport.total, 400);
  });

  test('returns a gapless monthly trend', async () => {
    const res = await request(app)
      .get('/api/stats?months=6')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.equal(res.body.monthlyTrend.length, 6);
  });
});

describe('ai', () => {
  test('reports whether AI is configured', async () => {
    const res = await request(app).get('/api/ai/status').expect(200);
    assert.equal(typeof res.body.enabled, 'boolean');
  });

  test('returns 503 for categorize when no API key is set', async (t) => {
    if (process.env.GROQ_API_KEY) return t.skip('GROQ_API_KEY present');
    await request(app)
      .post('/api/ai/categorize')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'uber ride to airport' })
      .expect(503);
  });

  test('rejects a too-short description', async () => {
    await request(app)
      .post('/api/ai/categorize')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'x' })
      .expect(422);
  });
});
