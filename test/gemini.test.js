import assert from 'node:assert/strict';
import {test} from 'node:test';

// Fake credentials and HTTP responses only; no external services are contacted.
test('Gemini accepts notes and files, filters thoughts, and rejects failed output', async t => {
  const keys = ['GEMINI_API_KEY', 'GEMINI_MODEL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  Object.assign(process.env, {GEMINI_API_KEY:'test-key', GEMINI_MODEL:'gemini-3.1-flash-lite', SUPABASE_URL:'https://storage.example', SUPABASE_SERVICE_ROLE_KEY:'storage-test'});
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });
  const {generate, hasAI} = await import('../server/services.js?gemini-test');
  assert.equal(hasAI, true);
  let payload;
  let mode = 'success';
  globalThis.fetch = async (url, options) => {
    if (url.startsWith('https://storage.example/')) return new Response('%PDF-1.7');
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
    assert.equal(options.headers['x-goog-api-key'], 'test-key');
    assert.equal(options.headers.Authorization, undefined);
    payload = JSON.parse(options.body);
    if (mode === 'quota') return Response.json({error:{code:429}}, {status:429});
    return Response.json({candidates:[{finishReason:mode === 'truncated' ? 'MAX_TOKENS' : 'STOP', content:{parts:[{thought:true,text:'private thought'},{text:'Răspuns corect.'}]}}]});
  };
  assert.equal(await generate('summary', {note:'Material de studiu'}), 'Răspuns corect.');
  assert.equal(payload.contents[0].parts[1].text, 'Material de studiu');
  assert.match(payload.systemInstruction.parts[0].text, /română/);
  for (const mimeType of ['application/pdf','image/png']) {
    await generate('explanation', {note:null,file_type:mimeType}, 'document-id');
    assert.deepEqual(payload.contents[0].parts[1].inlineData, {mimeType, data:Buffer.from('%PDF-1.7').toString('base64')});
  }
  mode = 'quota';
  await assert.rejects(generate('summary', {note:'test'}), {status:429});
  mode = 'truncated';
  await assert.rejects(generate('summary', {note:'test'}), {status:502});
  await assert.rejects(generate('constructor', {note:'test'}), {status:400});
});
