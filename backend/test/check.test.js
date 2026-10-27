import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rulesCheck, runCheck, deriveStrength, buildEvidence } from '../src/check.js';

const st = (stage, taps = [], words = '', extra = {}) => ({ stage, taps, words, extra });

test('a time named by the prospect with a day is a firm next step', () => {
  const stages = [st(7, ['channel_email', 'time_theirs'], '', { when: 'Thursday after 3' })];
  assert.equal(deriveStrength(buildEvidence(stages)), 'firm');
  const r = rulesCheck({ stages, chosen: 'next_step_set', reached: 7 });
  assert.equal(r.suggested_outcome, 'next_step_set');
  assert.equal(r.mismatch, false);
});

test('"send it by email" with no day is report_agreed, and logging next_step_set is flagged', () => {
  const stages = [st(7, ['channel_email'])];
  const r = rulesCheck({ stages, chosen: 'next_step_set', reached: 7 });
  assert.equal(r.next_step_strength, 'weak');
  assert.equal(r.suggested_outcome, 'report_agreed');
  assert.equal(r.mismatch, true);
  assert.match(r.reason, /day or time the prospect named|channel/i);
});

test('a time proposed by the caller is weak, not firm', () => {
  const stages = [st(7, ['channel_email', 'time_ours'], '', { when: 'Tuesday' })];
  assert.equal(deriveStrength(buildEvidence(stages)), 'weak');
});

test('do-not-call is flagged when nothing says they asked to stop', () => {
  // prospect redirected to the CFO; no request to stop
  const stages = [st(1, ['right_person']), st(6, ['not_right_person'], 'talk to our CFO')];
  const r = rulesCheck({ stages, chosen: 'asked_not_to_call', reached: 6 });
  assert.equal(r.mismatch, true);
  assert.equal(r.suggested_outcome, 'wrong_person_or_left');
  assert.match(r.reason, /not to be called/i);
});

test('do-not-call is accepted when the tap says they asked', () => {
  const stages = [st(6, ['asked_not_to_call'])];
  const r = rulesCheck({ stages, chosen: 'asked_not_to_call', reached: 6 });
  assert.equal(r.suggested_outcome, 'asked_not_to_call');
  assert.equal(r.mismatch, false);
});

test('"please do not call again" typed in their words counts as asking', () => {
  const stages = [st(6, [], 'please do not call again')];
  const r = rulesCheck({ stages, chosen: null, reached: 6 });
  assert.equal(r.suggested_outcome, 'asked_not_to_call');
});

test('a stale number or someone who left is wrong_person_or_left', () => {
  const r = rulesCheck({ stages: [st(1, ['stale_number'])], chosen: 'not_interested', reached: 1 });
  assert.equal(r.suggested_outcome, 'wrong_person_or_left');
  assert.equal(r.mismatch, true);
});

test('a callback request at stage 3 is call_back', () => {
  const r = rulesCheck({ stages: [st(3, ['callback'])], chosen: 'interested', reached: 3 });
  assert.equal(r.suggested_outcome, 'call_back');
  assert.equal(r.mismatch, true);
});

test('no taps and no words means could_not_connect', () => {
  const r = rulesCheck({ stages: [], chosen: null, reached: 1 });
  assert.equal(r.suggested_outcome, 'could_not_connect');
});

test('yes after an objection is a soft yes', () => {
  const stages = [st(6, ['have_provider']), st(7, ['channel_whatsapp'])];
  const r = rulesCheck({ stages, chosen: null, reached: 7 });
  assert.equal(r.soft_yes, true);
  assert.equal(r.suggested_outcome, 'report_agreed');
});

test('words are never touched by the check', () => {
  const stages = [st(5, ['named_need'], 'we want two new export markets')];
  const before = JSON.stringify(stages);
  rulesCheck({ stages, chosen: 'interested', reached: 5 });
  assert.equal(JSON.stringify(stages), before);
});

// ------------------------------------------------------------- runCheck: LLM path and fallbacks
const call = { contact_name: 'A', company: 'B', call_type: 'first_call', offer: 'growth_report', language: 'english' };

test('runCheck uses the LLM answer when it is valid', async () => {
  const llm = async () => ({
    suggested_outcome: 'report_agreed',
    next_step_strength: 'weak',
    soft_yes: true,
    summary: 'Agreed to receive the report on email; no day set.',
    reason: 'Only a channel was agreed, no day.',
  });
  const r = await runCheck({ call, stages: [st(7, ['channel_email'])], chosen: 'next_step_set', reached: 7, llm });
  assert.equal(r.source, 'llm');
  assert.equal(r.mismatch, true);
  assert.equal(r.reason, 'Only a channel was agreed, no day.');
});

test('runCheck falls back to rules when the LLM throws', async () => {
  const llm = async () => {
    throw new Error('gemini_timeout');
  };
  const r = await runCheck({ call, stages: [st(7, ['channel_email'])], chosen: 'report_agreed', reached: 7, llm });
  assert.equal(r.source, 'rules');
  assert.equal(r.fallback_reason, 'gemini_timeout');
  assert.equal(r.suggested_outcome, 'report_agreed');
});

test('runCheck rejects an LLM outcome that is not in the list', async () => {
  const llm = async () => ({ suggested_outcome: 'sold_deal', next_step_strength: 'firm', soft_yes: false, summary: 'x', reason: '' });
  const r = await runCheck({ call, stages: [st(7, ['channel_email'])], chosen: null, reached: 7, llm });
  assert.equal(r.source, 'rules');
  assert.equal(r.fallback_reason, 'bad_output');
});

test('runCheck without an LLM says why it used rules', async () => {
  const r = await runCheck({ call, stages: [], chosen: null, reached: 1, llm: null });
  assert.equal(r.source, 'rules');
  assert.equal(r.fallback_reason, 'no_llm_key');
});
