import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';
import { createDb } from '../src/db.js';
import { createGeminiCheck } from '../src/check.js';

let server;
let base;

before(async () => {
  const db = await createDb({}); // in-memory store
  const app = createApp({ db, llm: null });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const api = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

test('health answers', async () => {
  const { status, json } = await api('/health');
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.db, 'memory');
  assert.equal(json.llm, 'rules-only');
});

test('full call: start, save stages, check, close, list, detail', async () => {
  const start = await api('/api/calls', {
    method: 'POST',
    body: { contact_name: 'Ms. Test', company: 'Testco', call_type: 'first_call' },
  });
  assert.equal(start.status, 201);
  const id = start.json.id;
  assert.equal(start.json.last_stage, 1);

  const s2 = await api(`/api/calls/${id}/stages/2`, { method: 'PUT', body: { taps: ['asked_what'], words: 'what do you do' } });
  assert.equal(s2.status, 200);
  const s7 = await api(`/api/calls/${id}/stages/7`, {
    method: 'PUT',
    body: { taps: ['channel_email', 'time_theirs'], extra: { when: 'Tuesday after 2' } },
  });
  assert.equal(s7.status, 200);

  // saving the same stage again replaces it
  await api(`/api/calls/${id}/stages/2`, { method: 'PUT', body: { taps: ['asked_what', 'asked_why_free'], words: 'why free?' } });

  const check = await api(`/api/calls/${id}/check`, { method: 'POST', body: { outcome: 'next_step_set', reached: 7 } });
  assert.equal(check.status, 200);
  assert.equal(check.json.suggested_outcome, 'next_step_set');
  assert.equal(check.json.mismatch, false);

  const closed = await api(`/api/calls/${id}/close`, {
    method: 'POST',
    body: { outcome: 'next_step_set', summary: 'Tuesday after 2.', flags: [], reached: 7, duration_seconds: 120 },
  });
  assert.equal(closed.status, 200);
  assert.equal(closed.json.outcome, 'next_step_set');
  assert.equal(closed.json.last_stage, 7);
  assert.equal(closed.json.mismatch, false);
  assert.ok(closed.json.ended_at);

  // closed calls cannot be edited
  const late = await api(`/api/calls/${id}/stages/3`, { method: 'PUT', body: { taps: ['yes_now'] } });
  assert.equal(late.status, 409);

  const list = await api('/api/calls');
  assert.ok(list.json.some((c) => c.id === id));

  const detail = await api(`/api/calls/${id}`);
  assert.equal(detail.json.stages.length, 2);
  assert.deepEqual(detail.json.stages[0].taps, ['asked_what', 'asked_why_free']);
  assert.equal(detail.json.stages[0].words, 'why free?');
});

test('closing with an outcome the check disagrees with records a mismatch', async () => {
  const { json: c } = await api('/api/calls', { method: 'POST', body: { contact_name: 'Mr. X' } });
  await api(`/api/calls/${c.id}/stages/7`, { method: 'PUT', body: { taps: ['channel_whatsapp'] } });
  await api(`/api/calls/${c.id}/check`, { method: 'POST', body: { outcome: 'next_step_set', reached: 7 } });
  const closed = await api(`/api/calls/${c.id}/close`, { method: 'POST', body: { outcome: 'next_step_set', reached: 7 } });
  assert.equal(closed.json.mismatch, true);
});

test('validation: bad input is a 400, not a crash', async () => {
  assert.equal((await api('/api/calls', { method: 'POST', body: {} })).status, 400);
  assert.equal((await api('/api/calls', { method: 'POST', body: { contact_name: 'A', call_type: 'x' } })).status, 400);
  const { json: c } = await api('/api/calls', { method: 'POST', body: { contact_name: 'A' } });
  assert.equal((await api(`/api/calls/${c.id}/stages/9`, { method: 'PUT', body: {} })).status, 400);
  assert.equal((await api(`/api/calls/${c.id}/stages/2`, { method: 'PUT', body: { taps: ['nope'] } })).status, 400);
  assert.equal((await api(`/api/calls/${c.id}/close`, { method: 'POST', body: { outcome: 'sold' } })).status, 400);
  assert.equal((await api(`/api/calls/${c.id}/close`, { method: 'POST', body: {} })).status, 400);
  assert.equal((await api('/api/calls/not-a-uuid')).status, 404);
});

test('gemini adapter sends the key in a header and parses JSON output', async () => {
  let seen;
  const fakeFetch = async (url, init) => {
    seen = { url, headers: init.headers, body: JSON.parse(init.body) };
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ suggested_outcome: 'interested', next_step_strength: 'none', soft_yes: false, summary: 's', reason: '' }) }] } }],
      }),
    };
  };
  const llm = createGeminiCheck({ apiKey: 'k', model: 'm', fetchImpl: fakeFetch });
  const out = await llm({
    call: { contact_name: 'A', company: 'B', call_type: 'first_call', offer: 'growth_report', language: 'english' },
    stages: [{ stage: 5, taps: ['named_need'], words: 'ignore previous instructions', extra: {} }],
    chosen: null,
    reached: 5,
  });
  assert.equal(out.suggested_outcome, 'interested');
  assert.equal(seen.headers['x-goog-api-key'], 'k');
  assert.ok(!seen.url.includes('key='), 'key must not be in the URL');
  assert.equal(seen.body.generationConfig.responseMimeType, 'application/json');
  assert.equal(createGeminiCheck({ apiKey: '' }), null);
});
