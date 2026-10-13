import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from './app.js';

function testDatabase(handler) {
  return { query: handler };
}

test('POST /tickets creates a ticket with validated input', async () => {
  let queryValues;
  const app = createApp(testDatabase(async (sql, values) => {
    queryValues = values;
    return { rows: [{ id: '12', title: values[0], description: values[1], status: 'open', priority: values[2], created_at: '2026-10-13T08:00:00.000Z' }] };
  }));

  const response = await request(app).post('/tickets').send({ title: '  Printer offline  ', description: 'Room 2', priority: 'high' });
  assert.equal(response.status, 201);
  assert.equal(response.body.title, 'Printer offline');
  assert.equal(response.body.status, 'open');
  assert.deepEqual(queryValues, ['Printer offline', 'Room 2', 'high']);
});

test('GET /tickets applies status filter and pagination', async () => {
  const calls = [];
  const app = createApp(testDatabase(async (sql, values) => {
    calls.push({ sql, values });
    return sql.startsWith('SELECT id')
      ? { rows: [{ id: '3', title: 'Network issue', status: 'open', priority: 'medium' }] }
      : { rows: [{ count: 9 }] };
  }));

  const response = await request(app).get('/tickets?status=open&page=2&limit=5');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    tickets: [{ id: '3', title: 'Network issue', status: 'open', priority: 'medium' }],
    page: 2, limit: 5, total: 9,
  });
  assert.deepEqual(calls[0].values, ['open', 5, 5]);
  assert.deepEqual(calls[1].values, ['open']);
});

test('GET /tickets rejects malformed and unsafe pagination values', async () => {
  const app = createApp(testDatabase(async () => { throw new Error('Database should not be queried'); }));
  for (const query of ['page=2x', 'page=9007199254740991&limit=100', 'limit=1.5', 'status=']) {
    const response = await request(app).get(`/tickets?${query}`);
    assert.equal(response.status, 400, query);
    assert.equal(typeof response.body.error, 'string', query);
  }
});

test('GET /tickets/stats includes zero counts for empty statuses', async () => {
  const app = createApp(testDatabase(async () => ({ rows: [{ status: 'closed', count: 4 }] })));
  const response = await request(app).get('/tickets/stats');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { open: 0, in_progress: 0, closed: 4 });
});

test('POST /tickets rejects malformed JSON with a readable error', async () => {
  const app = createApp(testDatabase(async () => { throw new Error('Database should not be queried'); }));
  const response = await request(app)
    .post('/tickets')
    .set('Content-Type', 'application/json')
    .send('{"title":');

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: 'Request body must contain valid JSON.' });
});

test('GET /health reports database availability', async () => {
  const healthy = createApp(testDatabase(async () => ({ rows: [{ '?column?': 1 }] })));
  const unavailable = createApp(testDatabase(async () => { throw new Error('connection refused'); }));

  assert.deepEqual((await request(healthy).get('/health')).body, { status: 'ok' });
  const response = await request(unavailable).get('/health');
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { status: 'error', error: 'Database is unavailable.' });
});

test('PATCH /tickets/:id updates status and returns 404 for a missing ticket', async () => {
  const app = createApp(testDatabase(async () => ({ rowCount: 0, rows: [] })));
  const invalid = await request(app).patch('/tickets/2').send({ status: 'waiting' });
  const missing = await request(app).patch('/tickets/2').send({ status: 'closed' });
  assert.equal(invalid.status, 400);
  assert.equal(missing.status, 404);
});
