import 'dotenv/config';
import { createApp } from './server.js';
import { createDb } from './db.js';
import { createGeminiCheck } from './check.js';

const db = await createDb();
const llm = createGeminiCheck({
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
});
const corsOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

const app = createApp({ db, llm, corsOrigins });
const port = Number(process.env.PORT) || 8787;

app.listen(port, () => {
  console.log(`coldcall-guide api on :${port}  db=${db.kind}  llm=${llm ? 'gemini' : 'rules-only'}`);
  if (db.kind === 'memory') {
    console.warn('WARNING: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set. Using an in-memory store; data is lost on restart.');
  }
});
