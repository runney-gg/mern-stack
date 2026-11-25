import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Transaction from '../src/models/Transaction.js';

describe('transaction HTTP API', () => {
  let server;
  let apiUrl;
  let testMongoUri;
  const testDatabase = 'spendwise_test';

  before(async () => {
    const configuredUri = process.env.MONGODB_URI;
    if (!configuredUri) {
      throw new Error('HTTP API tests need MONGODB_URI in backend/.env to connect to a local MongoDB instance.');
    }

    const configuredUrl = new URL(configuredUri);
    if (!['127.0.0.1', 'localhost', '::1'].includes(configuredUrl.hostname.toLowerCase())) {
      throw new Error('HTTP API tests require a local MongoDB URI; refusing to write to a remote database.');
    }
    const configuredDatabase = decodeURIComponent(configuredUrl.pathname.replace(/^\/+/, ''));
    if (testDatabase === configuredDatabase) {
      throw new Error('Refusing to run HTTP API tests against the configured SpendWise database.');
    }

    const isolatedUrl = new URL(configuredUri);
    isolatedUrl.pathname = `/${testDatabase}`;
    testMongoUri = isolatedUrl.toString();

    try {
      await mongoose.connect(testMongoUri, { serverSelectionTimeoutMS: 3000 });
    } catch (error) {
      throw new Error(
        `HTTP API tests require a reachable MongoDB instance for an isolated test database (${error.name}). `
        + 'Start local MongoDB and rerun npm test; no tests were skipped.',
      );
    }

    await Transaction.deleteMany({});
    await new Promise((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', resolve);
      server.once('error', reject);
    });
    apiUrl = `http://127.0.0.1:${server.address().port}/api`;
  });

  beforeEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await Transaction.deleteMany({});
    }
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    let cleanupError;
    try {
      if (testMongoUri) {
        if (mongoose.connection.readyState !== 1) {
          await mongoose.connect(testMongoUri, { serverSelectionTimeoutMS: 3000 });
        }
        if (mongoose.connection.name !== testDatabase) {
          throw new Error(`Connected to ${mongoose.connection.name} instead of the isolated test database.`);
        }
        await Transaction.deleteMany({});
      }
    } catch (error) {
      cleanupError = error;
    } finally {
      await mongoose.disconnect();
    }

    if (cleanupError) {
      throw new Error(`Could not clear test records from isolated database ${testDatabase}: ${cleanupError.message}`);
    }
  });

  async function request(path, options = {}) {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    return { response, body: await response.json() };
  }

  function createPayload(overrides = {}) {
    return {
      type: 'expense',
      amount: 125.5,
      category: 'Transport',
      description: 'Bus ticket',
      date: '2026-11-09',
      ...overrides,
    };
  }

  it('creates and lists transactions with combined filters', async () => {
    const created = await request('/transactions', {
      method: 'POST',
      body: JSON.stringify(createPayload({ category: ' Transport ' })),
    });
    assert.equal(created.response.status, 201);
    assert.equal(typeof created.body._id, 'string');
    assert.equal(created.body.category, 'Transport');
    assert.equal(created.body.type, 'expense');
    assert.equal(created.body.amount, 125.5);
    assert.equal(typeof created.body.date, 'string');

    const income = await request('/transactions', {
      method: 'POST',
      body: JSON.stringify(createPayload({
        type: 'income',
        amount: 900,
        category: 'Salary',
        description: 'November pay',
      })),
    });
    assert.equal(income.response.status, 201);

    const filtered = await request('/transactions?month=2026-11&type=expense&search=bus');
    assert.equal(filtered.response.status, 200);
    assert.ok(Array.isArray(filtered.body));
    assert.equal(filtered.body.length, 1);
    assert.equal(filtered.body[0]._id, created.body._id);

    const categoryFiltered = await request('/transactions?category=transport');
    assert.equal(categoryFiltered.response.status, 200);
    assert.equal(categoryFiltered.body.length, 1);
  });

  it('paginates filtered results and keeps the response body as an array', async () => {
    for (const date of ['2026-11-09', '2026-11-08', '2026-11-07']) {
      const created = await request('/transactions', {
        method: 'POST',
        body: JSON.stringify(createPayload({ date })),
      });
      assert.equal(created.response.status, 201);
    }

    const firstPage = await request('/transactions?month=2026-11&type=expense&page=1&limit=2');
    assert.equal(firstPage.response.status, 200);
    assert.ok(Array.isArray(firstPage.body));
    assert.equal(firstPage.body.length, 2);
    assert.equal(firstPage.response.headers.get('x-total-count'), '3');
    assert.equal(firstPage.response.headers.get('x-page'), '1');
    assert.equal(firstPage.response.headers.get('x-limit'), '2');
    assert.equal(firstPage.response.headers.get('x-total-pages'), '2');
    assert.match(firstPage.response.headers.get('access-control-expose-headers'), /X-Total-Count/i);
    assert.ok(firstPage.body[0].date > firstPage.body[1].date);

    const lastPage = await request('/transactions?month=2026-11&type=expense&page=2&limit=2');
    assert.equal(lastPage.body.length, 1);
    assert.equal(lastPage.response.headers.get('x-page'), '2');

    const outOfRangePage = await request('/transactions?page=8&limit=2');
    assert.equal(outOfRangePage.body.length, 1);
    assert.equal(outOfRangePage.response.headers.get('x-page'), '2');

    const defaults = await request('/transactions');
    assert.equal(defaults.response.headers.get('x-page'), '1');
    assert.equal(defaults.response.headers.get('x-limit'), '20');

    const oversizedLimit = await request('/transactions?limit=500');
    assert.equal(oversizedLimit.response.headers.get('x-limit'), '100');

    const invalidPage = await request('/transactions?page=0');
    assert.equal(invalidPage.response.status, 400);
    const invalidLimit = await request('/transactions?limit=not-a-number');
    assert.equal(invalidLimit.response.status, 400);
    const excessivePage = await request('/transactions?page=10001');
    assert.equal(excessivePage.response.status, 400);
  });

  it('rejects invalid transaction input with a client error', async () => {
    const result = await request('/transactions', {
      method: 'POST',
      body: JSON.stringify({ type: 'expense', amount: 0, category: 'Food', date: '2026-11-09' }),
    });
    assert.equal(result.response.status, 400);
    assert.match(result.body.message, /between 0.01/i);
  });

  it('returns clear 400s for invalid amounts and overlong transaction fields', async () => {
    const invalidPayloads = [
      createPayload({ amount: 1.239 }),
      createPayload({ amount: 1_000_000_000.01 }),
      createPayload({ category: 'x'.repeat(101) }),
      createPayload({ description: 'x'.repeat(501) }),
    ];

    for (const payload of invalidPayloads) {
      const result = await request('/transactions', { method: 'POST', body: JSON.stringify(payload) });
      assert.equal(result.response.status, 400);
      assert.equal(typeof result.body.message, 'string');
    }
  });

  it('updates a transaction and reports invalid IDs and missing records', async () => {
    const created = await request('/transactions', {
      method: 'POST',
      body: JSON.stringify(createPayload()),
    });

    const updated = await request(`/transactions/${created.body._id}`, {
      method: 'PUT',
      body: JSON.stringify({ amount: 200, description: 'Updated fare' }),
    });
    assert.equal(updated.response.status, 200);
    assert.equal(typeof updated.body._id, 'string');
    assert.equal(updated.body.amount, 200);
    assert.equal(updated.body.description, 'Updated fare');

    const invalidId = await request('/transactions/not-an-object-id', {
      method: 'PUT',
      body: JSON.stringify({ amount: 250 }),
    });
    assert.equal(invalidId.response.status, 400);
    assert.equal(invalidId.body.message, 'Invalid transaction ID.');

    const missing = await request('/transactions/64b000000000000000000000', {
      method: 'PUT',
      body: JSON.stringify({ amount: 250 }),
    });
    assert.equal(missing.response.status, 404);
    assert.equal(missing.body.message, 'Transaction not found.');
  });

  it('deletes a transaction and reports missing records', async () => {
    const created = await request('/transactions', {
      method: 'POST',
      body: JSON.stringify(createPayload()),
    });

    const deleted = await request(`/transactions/${created.body._id}`, { method: 'DELETE' });
    assert.equal(deleted.response.status, 200);
    assert.deepEqual(deleted.body, { message: 'Transaction deleted.' });

    const missing = await request(`/transactions/${created.body._id}`, { method: 'DELETE' });
    assert.equal(missing.response.status, 404);

    const invalidId = await request('/transactions/invalid-id', { method: 'DELETE' });
    assert.equal(invalidId.response.status, 400);
    assert.equal(invalidId.body.message, 'Invalid transaction ID.');
  });

  it('returns a filtered summary with correct totals', async () => {
    for (const transaction of [
      createPayload({ type: 'income', amount: 1000, category: 'Salary' }),
      createPayload({ type: 'expense', amount: 250, category: 'Food' }),
      createPayload({ type: 'expense', amount: 100, category: 'Transport' }),
    ]) {
      const created = await request('/transactions', {
        method: 'POST',
        body: JSON.stringify(transaction),
      });
      assert.equal(created.response.status, 201);
    }

    const result = await request('/summary?month=2026-11');
    assert.equal(result.response.status, 200);
    assert.equal(result.body.totalIncome, 1000);
    assert.equal(result.body.totalExpenses, 350);
    assert.equal(result.body.balance, 650);
    assert.deepEqual(result.body.expensesByCategory, [
      { category: 'Food', total: 250 },
      { category: 'Transport', total: 100 },
    ]);
  });

  it('returns summary currency totals rounded to cents', async () => {
    for (const transaction of [
      createPayload({ type: 'income', amount: 0.1, category: 'Salary' }),
      createPayload({ type: 'income', amount: 0.2, category: 'Salary' }),
      createPayload({ type: 'expense', amount: 0.1, category: 'Food' }),
      createPayload({ type: 'expense', amount: 0.2, category: 'Food' }),
    ]) {
      const created = await request('/transactions', {
        method: 'POST',
        body: JSON.stringify(transaction),
      });
      assert.equal(created.response.status, 201);
    }

    const result = await request('/summary?month=2026-11');
    assert.equal(result.response.status, 200);
    assert.equal(result.body.totalIncome, 0.3);
    assert.equal(result.body.totalExpenses, 0.3);
    assert.equal(result.body.balance, 0);
    assert.deepEqual(result.body.expensesByCategory, [{ category: 'Food', total: 0.3 }]);
    assert.deepEqual(result.body.monthlyData, [{ month: '2026-11', income: 0.3, expenses: 0.3 }]);
  });

  it('returns 503 for database-backed routes when MongoDB is disconnected', async () => {
    await mongoose.disconnect();

    const result = await request('/transactions');
    assert.equal(result.response.status, 503);
    assert.match(result.body.message, /database is unavailable/i);
  });
});
