import express from 'express';
import cors from 'cors';
import {
  OUTCOMES,
  FLAGS,
  CALL_TYPES,
  OFFERS,
  LANGUAGES,
  isValidTap,
} from './catalog.js';
import { runCheck } from './check.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const bad = (msg) => new HttpError(400, msg);

function text(value, { max, required = false, name }) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (required && !s) throw bad(`${name} is required`);
  if (s.length > max) throw bad(`${name} is too long (max ${max})`);
  return s;
}

function oneOf(value, list, name, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (!list.includes(value)) throw bad(`${name} must be one of: ${list.join(', ')}`);
  return value;
}

function isoOrNull(value, name) {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw bad(`${name} is not a valid date`);
  return d.toISOString();
}

function stageNumber(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 8) throw bad('stage must be 1 to 8');
  return n;
}

function cleanExtra(extra) {
  if (extra === undefined || extra === null) return {};
  if (typeof extra !== 'object' || Array.isArray(extra)) throw bad('extra must be an object');
  const out = {};
  for (const key of ['when', 'callback_at']) {
    if (extra[key] !== undefined && extra[key] !== null && extra[key] !== '') {
      out[key] = text(String(extra[key]), { max: 120, name: `extra.${key}` });
    }
  }
  return out;
}

// Small in-memory limiter for the one endpoint that costs money/quota.
function limiter({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: 'Too many checks. Wait a minute and try again.' });
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

export function createApp({ db, llm = null, corsOrigins = [] }) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: corsOrigins.length ? corsOrigins : true,
      methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

  const loadCall = async (id) => {
    if (!UUID_RE.test(id)) throw new HttpError(404, 'Call not found');
    const call = await db.getCall(id);
    if (!call) throw new HttpError(404, 'Call not found');
    return call;
  };

  // ------------------------------------------------------------ health
  app.get(
    '/health',
    wrap(async (req, res) => {
      const body = {
        ok: true,
        service: 'coldcall-guide-api',
        db: db.kind,
        llm: llm ? 'gemini' : 'rules-only',
        time: new Date().toISOString(),
      };
      if (req.query.deep) {
        try {
          await db.ping();
          body.db_reachable = true;
        } catch (e) {
          body.ok = false;
          body.db_reachable = false;
          return res.status(503).json(body);
        }
      }
      res.json(body);
    }),
  );

  // ------------------------------------------------------------ start a call
  app.post(
    '/api/calls',
    wrap(async (req, res) => {
      const b = req.body ?? {};
      const call = await db.createCall({
        contact_name: text(b.contact_name, { max: 120, required: true, name: 'contact_name' }),
        company: text(b.company, { max: 160, name: 'company' }),
        call_type: oneOf(b.call_type, CALL_TYPES, 'call_type', 'first_call'),
        offer: oneOf(b.offer, OFFERS, 'offer', 'growth_report'),
        language: oneOf(b.language, LANGUAGES, 'language', 'english'),
      });
      res.status(201).json(call);
    }),
  );

  // ------------------------------------------------------------ save one stage
  app.put(
    '/api/calls/:id/stages/:n',
    wrap(async (req, res) => {
      const call = await loadCall(req.params.id);
      if (call.ended_at) throw new HttpError(409, 'This call is already closed');
      const stage = stageNumber(req.params.n);
      const b = req.body ?? {};
      const taps = Array.isArray(b.taps) ? [...new Set(b.taps)] : [];
      for (const id of taps) {
        if (typeof id !== 'string' || !isValidTap(stage, id)) throw bad(`unknown tap "${id}" for stage ${stage}`);
      }
      const row = await db.upsertStage(call.id, stage, {
        taps,
        words: text(b.words, { max: 4000, name: 'words' }),
        extra: cleanExtra(b.extra),
      });
      res.json(row);
    }),
  );

  // ------------------------------------------------------------ outcome check (LLM or rules)
  app.post(
    '/api/calls/:id/check',
    limiter({ windowMs: 60_000, max: 15 }),
    wrap(async (req, res) => {
      const call = await loadCall(req.params.id);
      const b = req.body ?? {};
      const chosen = b.outcome && Object.hasOwn(OUTCOMES, b.outcome) ? b.outcome : null;
      const reached = Math.min(8, Math.max(1, Number(b.reached) || call.last_stage));
      const stages = await db.getStages(call.id);
      const result = await runCheck({ call, stages, chosen, reached, llm });
      await db.updateCall(call.id, { check_result: result });
      res.json(result);
    }),
  );

  // ------------------------------------------------------------ close the call
  app.post(
    '/api/calls/:id/close',
    wrap(async (req, res) => {
      const call = await loadCall(req.params.id);
      if (call.ended_at) throw new HttpError(409, 'This call is already closed');
      const b = req.body ?? {};
      const outcome = oneOf(b.outcome, Object.keys(OUTCOMES), 'outcome', null);
      if (!outcome) throw bad('outcome is required');
      const flags = Array.isArray(b.flags) ? [...new Set(b.flags)] : [];
      for (const f of flags) if (!FLAGS.includes(f)) throw bad(`unknown flag "${f}"`);
      const reached = stageNumber(b.reached ?? call.last_stage);
      const duration = Number.isFinite(Number(b.duration_seconds))
        ? Math.max(0, Math.round(Number(b.duration_seconds)))
        : null;
      const suggested = call.check_result?.suggested_outcome ?? null;
      const updated = await db.updateCall(call.id, {
        outcome,
        flags,
        callback_at: isoOrNull(b.callback_at, 'callback_at'),
        summary: text(b.summary, { max: 300, name: 'summary' }),
        last_stage: Math.max(call.last_stage, reached),
        duration_seconds: duration,
        ended_at: new Date().toISOString(),
        mismatch: Boolean(suggested && suggested !== outcome),
      });
      res.json(updated);
    }),
  );

  // ------------------------------------------------------------ list + detail
  app.get(
    '/api/calls',
    wrap(async (req, res) => {
      const calls = await db.listCalls({ limit: 200 });
      res.json(calls);
    }),
  );

  app.get(
    '/api/calls/:id',
    wrap(async (req, res) => {
      const call = await loadCall(req.params.id);
      const stages = await db.getStages(call.id);
      res.json({ call, stages });
    }),
  );

  // ------------------------------------------------------------ errors
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Body is not valid JSON' });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  });

  return app;
}
