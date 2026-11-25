import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

let server;
let apiUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not bind the local security test server.');
  apiUrl = `http://127.0.0.1:${address.port}/api`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('rejects JSON bodies larger than 16 KB with HTTP 413', async () => {
  const response = await fetch(`${apiUrl}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'x'.repeat(17_000) }),
  });
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { message: 'Request body cannot exceed 16 KB.' });
});

test('allows loopback CORS origins and omits CORS access for remote origins', async () => {
  const local = await fetch(`${apiUrl}/health`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(local.headers.get('access-control-allow-origin'), 'http://localhost:5173');

  const remote = await fetch(`${apiUrl}/health`, { headers: { Origin: 'https://example.com' } });
  assert.equal(remote.headers.get('access-control-allow-origin'), null);
});
