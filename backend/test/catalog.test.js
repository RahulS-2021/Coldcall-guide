import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { TAPS, OUTCOMES } from '../src/catalog.js';

// The frontend owns the wording, the backend owns the ids it will accept.
// If they drift, a tap the caller presses would be rejected with a 400 mid-call.
const stagesUrl = pathToFileURL(path.resolve(import.meta.dirname, '../../frontend/src/stages.js')).href;

test('every tap id in the frontend is accepted by the backend, and the other way round', async () => {
  const { STAGES, OUTCOMES: feOutcomes } = await import(stagesUrl);
  for (const s of STAGES) {
    const feIds = new Set([...s.taps, ...(s.followUp?.taps ?? [])].map(([id]) => id));
    const beIds = new Set(Object.keys(TAPS[s.n]));
    assert.deepEqual([...feIds].sort(), [...beIds].sort(), `stage ${s.n} taps differ`);
    for (const [id, label] of [...s.taps, ...(s.followUp?.taps ?? [])]) {
      assert.equal(label, TAPS[s.n][id], `stage ${s.n} label for ${id} differs`);
    }
  }
  assert.deepEqual(feOutcomes.map((o) => o.id).sort(), Object.keys(OUTCOMES).sort());
});

test('every stage has exactly three "they may say" lines', async () => {
  const { STAGES } = await import(stagesUrl);
  for (const s of STAGES) {
    assert.equal(s.mayHear.length, 3, `stage ${s.n}`);
    if (s.followUp?.mayHear) assert.equal(s.followUp.mayHear.length, 3, `stage ${s.n} follow-up`);
  }
});
