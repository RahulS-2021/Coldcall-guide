// Data access. Two interchangeable stores with the same methods:
//   - Supabase (production): used when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
//   - in-memory (local dev and tests): used otherwise. /health reports which one is live.

import { randomUUID } from 'node:crypto';

export async function createDb(env = process.env) {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    return supabaseDb(client);
  }
  return memoryDb();
}

function must({ data, error }) {
  if (error) throw new Error(`db: ${error.message}`);
  return data;
}

function supabaseDb(client) {
  return {
    kind: 'supabase',

    async ping() {
      must(await client.from('calls').select('id').limit(1));
    },

    async createCall(fields) {
      return must(await client.from('calls').insert(fields).select().single());
    },

    async getCall(id) {
      return must(await client.from('calls').select('*').eq('id', id).maybeSingle());
    },

    async updateCall(id, patch) {
      return must(await client.from('calls').update(patch).eq('id', id).select().maybeSingle());
    },

    async upsertStage(callId, stage, { taps, words, extra }) {
      const row = must(
        await client
          .from('stage_results')
          .upsert(
            { call_id: callId, stage, taps, words, extra, updated_at: new Date().toISOString() },
            { onConflict: 'call_id,stage' },
          )
          .select()
          .single(),
      );
      // keep calls.last_stage at the furthest stage seen
      const call = await this.getCall(callId);
      if (call && stage > call.last_stage) await this.updateCall(callId, { last_stage: stage });
      return row;
    },

    async getStages(callId) {
      return must(
        await client.from('stage_results').select('*').eq('call_id', callId).order('stage'),
      );
    },

    async listCalls({ limit = 200 } = {}) {
      return must(
        await client.from('calls').select('*').order('started_at', { ascending: false }).limit(limit),
      );
    },
  };
}

function memoryDb() {
  const calls = new Map();
  const stages = new Map(); // `${callId}:${stage}` -> row
  return {
    kind: 'memory',

    async ping() {},

    async createCall(fields) {
      const now = new Date().toISOString();
      const row = {
        id: randomUUID(),
        started_at: now,
        created_at: now,
        ended_at: null,
        duration_seconds: null,
        last_stage: 1,
        outcome: null,
        flags: [],
        callback_at: null,
        summary: '',
        check_result: null,
        mismatch: false,
        ...fields,
      };
      calls.set(row.id, row);
      return { ...row };
    },

    async getCall(id) {
      const c = calls.get(id);
      return c ? { ...c } : null;
    },

    async updateCall(id, patch) {
      const c = calls.get(id);
      if (!c) return null;
      Object.assign(c, patch);
      return { ...c };
    },

    async upsertStage(callId, stage, { taps, words, extra }) {
      const key = `${callId}:${stage}`;
      const row = {
        id: stages.get(key)?.id ?? randomUUID(),
        call_id: callId,
        stage,
        taps,
        words,
        extra,
        updated_at: new Date().toISOString(),
      };
      stages.set(key, row);
      const c = calls.get(callId);
      if (c && stage > c.last_stage) c.last_stage = stage;
      return { ...row };
    },

    async getStages(callId) {
      return [...stages.values()].filter((s) => s.call_id === callId).sort((a, b) => a.stage - b.stage);
    },

    async listCalls({ limit = 200 } = {}) {
      return [...calls.values()]
        .sort((a, b) => b.started_at.localeCompare(a.started_at))
        .slice(0, limit)
        .map((c) => ({ ...c }));
    },
  };
}
