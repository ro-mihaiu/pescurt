import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { validSignature } from '../server/billing.js';
import { uploaded, validateAction } from '../server/services.js';

test('Stripe signatures bind the exact request bytes and expire', () => {
  const body = Buffer.from('{"event":"checkout"}');
  const timestamp = 1700000000;
  const secret = 'local-test-secret';
  const signature = 't=' + timestamp + ',v1=' + createHmac('sha256', secret)
    .update(timestamp + '.').update(body).digest('hex');
  assert.equal(validSignature(body, signature, secret, timestamp * 1000), true);
  assert.equal(validSignature(Buffer.concat([body, Buffer.from('\n')]), signature, secret, timestamp * 1000), false);
  assert.equal(validSignature(body, signature, secret, (timestamp + 301) * 1000), false);
  assert.equal(validSignature(body, 't=' + timestamp + ',v1=aaa', secret, timestamp * 1000), false);
});

test('uploads check file bytes and refuse unsupported and oversized payloads', () => {
  assert.equal(uploaded(Buffer.from('%PDF-1.7').toString('base64')).type, 'application/pdf');
  assert.equal(uploaded('iVBORw0KGgo=').type, 'image/png');
  assert.throws(() => uploaded(Buffer.from('<svg>').toString('base64')), {status: 400});
  assert.throws(() => uploaded('A'.repeat(4194305)), {status: 400});
  assert.doesNotThrow(() => validateAction('summary'));
  assert.throws(() => validateAction('constructor'), {status: 400});
});

test('unconfigured server describes availability and rejects cross-origin writes', async t => {
  const oldEnv = Object.fromEntries(['APP_URL','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY','OPENAI_MODEL','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET',
    'LEGAL_OPERATOR_NAME','LEGAL_OPERATOR_ADDRESS','LEGAL_OPERATOR_REGISTRATION','LEGAL_CONTACT_EMAIL'].map(key => [key, process.env[key]]));
  for (const key of Object.keys(oldEnv)) delete process.env[key];
  const {spawn} = await import('node:child_process');
  const portServer = createServer();
  await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
  const port = portServer.address().port;
  await new Promise(resolve => portServer.close(resolve));
  const child = spawn(process.execPath, ['server/local.js'], {env: {...process.env, PORT: String(port)}});
  for (const [key, value] of Object.entries(oldEnv)) if (value !== undefined) process.env[key] = value;
  t.after(() => child.kill());
  await new Promise((resolve, reject) => {
    child.stdout.once('data', resolve);
    child.once('error', reject);
    child.once('exit', () => reject(new Error('Server exited before startup')));
  });
  const base = 'http://localhost:' + port;
  const config = await fetch(base + '/api/config');
  assert.equal(config.status, 200);
  assert.equal(config.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await config.json(), {auth: false, ai: false, billing: false, prices: {}, zone: 'Europe/Bucharest', legal: {}});
  const post = (route, origin) => fetch(base + '/api/' + route, {
    method: 'POST', headers: {origin, 'Content-Type':'application/json'}, body:'{}'
  });
  assert.equal((await post('auth/login', 'https://outside.example')).status, 403);
  assert.equal((await post('admin/proof', base)).status, 503);
  assert.equal((await post('auth/login', base)).status, 503);
  assert.deepEqual(await (await post('auth/session', base)).json(), {signedIn:false, recovery:false});
});
