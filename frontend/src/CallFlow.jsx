import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import Recap from './Recap.jsx';
import {
  STAGES,
  STAGE_BY_N,
  stageContent,
  OUTCOMES,
  OUTCOME_LABEL,
  FLAG_LABEL,
  CALL_TYPES,
  OFFERS,
  LANGUAGES,
  autoFlags,
} from './stages.js';

const ACTIVE_KEY = 'cg.active';
const blank = () => ({ taps: [], words: '', extra: {} });

// An unfinished call survives a refresh, so a caller never loses the screen mid-call.
// localStorage can be unavailable (private windows), so every access is guarded.
const loadActive = () => {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null');
  } catch {
    return null;
  }
};
const saveActive = (value) => {
  try {
    if (value) localStorage.setItem(ACTIVE_KEY, JSON.stringify(value));
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
};

function useElapsed(startedAt, running) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
}

const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function CallFlow({ serverUp, onSaved, onViewPast }) {
  const [phase, setPhase] = useState('setup'); // setup | stage | close | done
  const [call, setCall] = useState(null);
  const [stage, setStage] = useState(1);
  const [reached, setReached] = useState(1);
  const [data, setData] = useState({});
  const [startedAt, setStartedAt] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [resume, setResume] = useState(() => loadActive());
  const [done, setDone] = useState(null);

  // close-screen state
  const [outcome, setOutcome] = useState('');
  const [summary, setSummary] = useState('');
  const [flags, setFlags] = useState([]);
  const [callbackAt, setCallbackAt] = useState('');
  const [check, setCheck] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkErr, setCheckErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const callRef = useRef(null);
  const closeInit = useRef(false);
  const timers = useRef({});
  const pending = useRef({});
  useEffect(() => {
    callRef.current = call;
  }, [call]);

  const secs = useElapsed(startedAt, phase === 'stage' || phase === 'close');

  // keep the active call on disk
  useEffect(() => {
    if ((phase === 'stage' || phase === 'close') && call) {
      saveActive({ call, phase, stage, reached, data, startedAt, outcome, summary, flags, callbackAt });
    }
  }, [phase, call, stage, reached, data, startedAt, outcome, summary, flags, callbackAt]);

  // ---------------------------------------------------------------- saving
  const persist = useCallback(async (n) => {
    const val = pending.current[n];
    if (!val || !callRef.current) return true;
    try {
      await api.saveStage(callRef.current.id, n, val);
      if (pending.current[n] === val) delete pending.current[n];
      return true;
    } catch {
      return false;
    }
  }, []);

  const flush = useCallback(async () => {
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
    const results = await Promise.all(Object.keys(pending.current).map((n) => persist(Number(n))));
    const ok = results.every(Boolean);
    setSaveState(ok ? 'saved' : 'error');
    return ok;
  }, [persist]);

  const queueSave = (n, val) => {
    pending.current[n] = val;
    clearTimeout(timers.current[n]);
    setSaveState('saving');
    timers.current[n] = setTimeout(async () => {
      const ok = await persist(n);
      setSaveState(ok && !Object.keys(pending.current).length ? 'saved' : 'error');
    }, 600);
  };

  const update = (n, patch) => {
    const next = { ...(data[n] ?? blank()), ...patch };
    setData((d) => ({ ...d, [n]: next }));
    queueSave(n, next);
  };

  const toggleTap = (n, id) => {
    const cur = data[n]?.taps ?? [];
    update(n, { taps: cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id] });
  };

  // ---------------------------------------------------------------- navigation
  const goTo = (n) => {
    setPhase('stage');
    setStage(n);
    setReached((r) => Math.max(r, n));
    flush();
    window.scrollTo({ top: 0 });
  };

  const enterClose = (finalReached) => {
    flush();
    setReached((r) => Math.max(r, finalReached));
    if (!closeInit.current) {
      closeInit.current = true;
      setFlags(autoFlags(data, ''));
      setCallbackAt(data[3]?.extra?.callback_at ?? '');
      setOutcome('');
      setSummary('');
      setCheck(null);
      setCheckErr('');
    }
    setSaveErr('');
    setPhase('close');
    window.scrollTo({ top: 0 });
  };

  const next = () => (stage < 7 ? goTo(stage + 1) : enterClose(8));
  const endCall = () => enterClose(reached);

  // ---------------------------------------------------------------- start / resume / reset
  const [form, setForm] = useState({
    contact_name: '',
    company: '',
    call_type: 'first_call',
    offer: 'growth_report',
    language: 'english',
  });
  const [starting, setStarting] = useState(false);
  const [startErr, setStartErr] = useState('');

  const startCall = async (e) => {
    e.preventDefault();
    if (!form.contact_name.trim()) {
      setStartErr('Add who you are calling.');
      return;
    }
    setStarting(true);
    setStartErr('');
    try {
      const created = await api.createCall(form);
      pending.current = {};
      closeInit.current = false;
      setCall(created);
      callRef.current = created;
      setData({});
      setStage(1);
      setReached(1);
      setStartedAt(Date.now());
      setSaveState('idle');
      setResume(null);
      setPhase('stage');
    } catch (err) {
      setStartErr(err.message);
    } finally {
      setStarting(false);
    }
  };

  const resumeCall = () => {
    const r = resume;
    pending.current = {};
    closeInit.current = r.phase === 'close';
    setCall(r.call);
    callRef.current = r.call;
    setData(r.data ?? {});
    setStage(r.stage ?? 1);
    setReached(r.reached ?? 1);
    setStartedAt(r.startedAt ?? Date.now());
    setOutcome(r.outcome ?? '');
    setSummary(r.summary ?? '');
    setFlags(r.flags ?? []);
    setCallbackAt(r.callbackAt ?? '');
    setCheck(null);
    setPhase(r.phase === 'close' ? 'close' : 'stage');
    setResume(null);
  };

  const discardResume = () => {
    saveActive(null);
    setResume(null);
  };

  const reset = () => {
    saveActive(null);
    pending.current = {};
    closeInit.current = false;
    setCall(null);
    setDone(null);
    setForm((f) => ({ ...f, contact_name: '', company: '' }));
    setPhase('setup');
  };

  // ---------------------------------------------------------------- close screen actions
  const pickOutcome = (id) => {
    setOutcome(id);
    if (id === 'call_back') setFlags((f) => (f.includes('callback_due') ? f : [...f, 'callback_due']));
  };

  const toggleFlag = (f) => setFlags((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  const runCheck = async () => {
    setChecking(true);
    setCheckErr('');
    try {
      await flush();
      const r = await api.check(call.id, { outcome: outcome || undefined, reached });
      setCheck(r);
      if (!summary.trim() && r.summary) setSummary(r.summary);
      if (r.soft_yes) setFlags((f) => (f.includes('soft_yes') ? f : [...f, 'soft_yes']));
    } catch (e) {
      setCheckErr(e.message);
    } finally {
      setChecking(false);
    }
  };

  const save = async () => {
    if (!outcome) {
      setSaveErr('Pick an outcome first.');
      return;
    }
    setSaving(true);
    setSaveErr('');
    try {
      const ok = await flush();
      if (!ok) throw new Error('Some notes have not saved yet. Check the connection and press Save again.');
      const finalFlags = new Set(flags);
      if (outcome === 'call_back') finalFlags.add('callback_due');
      const closed = await api.closeCall(call.id, {
        outcome,
        summary: summary.trim(),
        flags: [...finalFlags],
        callback_at: finalFlags.has('callback_due') && callbackAt ? new Date(callbackAt).toISOString() : null,
        reached,
        duration_seconds: secs,
      });
      saveActive(null);
      setDone(closed);
      setPhase('done');
      onSaved?.();
    } catch (e) {
      setSaveErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const disagrees = Boolean(check?.suggested_outcome && outcome && check.suggested_outcome !== outcome);

  // ================================================================ render
  if (phase === 'setup') {
    return (
      <section className="screen">
        {resume?.call && (
          <div className="resume">
            <div>
              <strong>Unfinished call</strong>
              <span>
                {resume.call.contact_name}
                {resume.call.company ? `, ${resume.call.company}` : ''}
              </span>
            </div>
            <div className="resume-actions">
              <button className="btn small" onClick={resumeCall}>
                Resume
              </button>
              <button className="btn ghost small" onClick={discardResume}>
                Discard
              </button>
            </div>
          </div>
        )}
        <form className="card setup" onSubmit={startCall}>
          <p className="eyebrow">New call</p>
          <h1>Who are you calling?</h1>
          <label className="field">
            <span>Name</span>
            <input
              autoFocus
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              placeholder="e.g. Ms. Kavita Rao"
              maxLength={120}
            />
          </label>
          <label className="field">
            <span>Company</span>
            <input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="e.g. Harbor Lane Foods"
              maxLength={160}
            />
          </label>
          <div className="field">
            <span>Type of call</span>
            <div className="seg">
              {CALL_TYPES.map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  className={form.call_type === id ? 'seg-btn on' : 'seg-btn'}
                  aria-pressed={form.call_type === id}
                  onClick={() => setForm({ ...form, call_type: id })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="row2">
            <label className="field">
              <span>What you are offering</span>
              <select value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })}>
                {OFFERS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Language</span>
              <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                {LANGUAGES.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {startErr && <p className="error" role="alert">{startErr}</p>}
          {!serverUp && !startErr && <p className="muted small-text">The server is still waking up. Starting may take a moment.</p>}
          <button className="btn primary wide" disabled={starting}>
            {starting ? 'Starting…' : 'Start call'}
          </button>
        </form>
      </section>
    );
  }

  if (phase === 'done' && done) {
    return (
      <section className="screen">
        <div className="card done">
          <p className="eyebrow ok">Saved</p>
          <h1>{OUTCOME_LABEL[done.outcome]}</h1>
          <p className="done-who">
            {done.contact_name}
            {done.company ? `, ${done.company}` : ''}
          </p>
          <p className="done-reached">
            Reached stage {done.last_stage} of 8: {STAGE_BY_N[done.last_stage].name} · {clock(done.duration_seconds ?? 0)}
          </p>
          {done.summary && <p className="done-summary">{done.summary}</p>}
          <div className="chips-static">
            {(done.flags ?? []).map((f) => (
              <span key={f} className="pill">
                {FLAG_LABEL[f]}
              </span>
            ))}
            {done.mismatch && <span className="pill warn">Outcome differs from the check</span>}
          </div>
          <div className="actions-col">
            <button className="btn primary wide" onClick={reset}>
              Next call
            </button>
            <button className="btn ghost wide" onClick={onViewPast}>
              See past calls
            </button>
          </div>
        </div>
      </section>
    );
  }

  // stage + close share the call bar and the stage strip
  const content = phase === 'stage' ? stageContent(stage, call.call_type) : null;
  const cur = data[stage] ?? blank();

  return (
    <section className="screen">
      <div className="card callbar">
        <div className="callbar-who">
          <strong>{call.contact_name}</strong>
          <span>
            {call.company || 'No company'} · {call.call_type === 'follow_up' ? 'follow-up' : 'first call'}
          </span>
        </div>
        <div className="callbar-right">
          <span className="timer" aria-label="Call time">{clock(secs)}</span>
          <span className={`save ${saveState}`} role="status">
            {saveState === 'saving' && 'Saving…'}
            {saveState === 'saved' && 'Saved'}
            {saveState === 'error' && 'Not saved, will retry'}
          </span>
        </div>
      </div>

      <nav className="strip" aria-label="Call stages">
        {STAGES.map((s) => {
          const isCur = phase === 'stage' ? s.n === stage : s.n === 8;
          const seen = s.n <= reached && !isCur;
          return (
            <button
              key={s.n}
              className={`dot ${isCur ? 'cur' : ''} ${seen ? 'seen' : ''}`}
              aria-current={isCur ? 'step' : undefined}
              aria-label={`Stage ${s.n}, ${s.name}`}
              disabled={s.n === 8}
              onClick={() => goTo(s.n)}
            >
              {s.n}
            </button>
          );
        })}
      </nav>

      {phase === 'stage' && (
        <div className="card stagecard">
          <p className="eyebrow">Stage {stage} of 8</p>
          <h1>{content.name}</h1>
          <p className="purpose">{content.purpose}</p>

          <h2 className="label">They may say</h2>
          <ul className="says">
            {content.mayHear.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <div className="help">
            <p>
              <span className="help-k">Try</span> {content.hint}
            </p>
            <p>
              <span className="help-k">Have ready</span> {content.ready}
            </p>
          </div>

          <h2 className="label">What happened</h2>
          <div className="taps">
            {content.taps.map(([id, label]) => {
              const on = cur.taps.includes(id);
              return (
                <button key={id} className={on ? 'tap on' : 'tap'} aria-pressed={on} onClick={() => toggleTap(stage, id)}>
                  {label}
                </button>
              );
            })}
          </div>

          {content.extra && (content.extra.when ? cur.taps.includes(content.extra.when) : true) && (
            <label className="field inline">
              <span>{content.extra.label}</span>
              <input
                type={content.extra.type}
                value={cur.extra[content.extra.key] ?? ''}
                placeholder={content.extra.placeholder}
                maxLength={120}
                onChange={(e) => update(stage, { extra: { ...cur.extra, [content.extra.key]: e.target.value } })}
              />
            </label>
          )}

          <label className={`field words ${content.emphasis ? 'emph' : ''}`}>
            <span className="label">{content.wordsLabel}</span>
            <textarea
              rows={content.emphasis ? 5 : 3}
              value={cur.words}
              maxLength={4000}
              placeholder={content.wordsPlaceholder}
              onChange={(e) => update(stage, { words: e.target.value })}
            />
          </label>
        </div>
      )}

      {phase === 'close' && (
        <div className="card stagecard">
          <p className="eyebrow">Stage 8 of 8</p>
          <h1>Close</h1>
          <p className="purpose">
            Reached <strong>{STAGE_BY_N[reached].name}</strong>. Pick what happened, then save. Their words are saved as you typed them.
          </p>

          <Recap data={data} />

          <h2 className="label">Outcome</h2>
          <div className="outcomes">
            {OUTCOMES.map((o) => (
              <button
                key={o.id}
                className={outcome === o.id ? 'outcome on' : 'outcome'}
                aria-pressed={outcome === o.id}
                onClick={() => pickOutcome(o.id)}
              >
                <span>{o.label}</span>
                <small>{o.hint}</small>
              </button>
            ))}
          </div>

          <h2 className="label">Flags</h2>
          <div className="taps">
            {Object.entries(FLAG_LABEL).map(([id, label]) => (
              <button key={id} className={flags.includes(id) ? 'tap on' : 'tap'} aria-pressed={flags.includes(id)} onClick={() => toggleFlag(id)}>
                {label}
              </button>
            ))}
          </div>
          {flags.includes('callback_due') && (
            <label className="field inline">
              <span>Call back at</span>
              <input type="datetime-local" value={callbackAt} onChange={(e) => setCallbackAt(e.target.value)} />
            </label>
          )}

          <label className="field words">
            <span className="label">One-line summary</span>
            <textarea
              rows={2}
              maxLength={300}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What happened and what is next. The check can draft this."
            />
          </label>

          <div className="check">
            <button className="btn ghost wide" onClick={runCheck} disabled={checking}>
              {checking ? 'Checking…' : 'Check this against the call'}
            </button>
            {checkErr && <p className="error" role="alert">{checkErr}</p>}
            {check && (
              <div className={`checkcard ${disagrees ? 'warn' : 'okay'}`} role="status">
                <p className="checkhead">
                  {check.suggested_outcome ? (
                    <span>
                      The call points to <strong>{OUTCOME_LABEL[check.suggested_outcome]}</strong>
                    </span>
                  ) : (
                    <span>No clear suggestion from the call.</span>
                  )}
                  <span className="source">{check.source === 'llm' ? 'AI check' : 'Rules check'}</span>
                </p>
                {disagrees && (
                  <p>{check.reason || `You picked ${OUTCOME_LABEL[outcome]}.`}</p>
                )}
                {!disagrees && outcome && check.suggested_outcome && <p>Matches your pick.</p>}
                <p className="muted small-text">
                  Next step: <strong>{check.next_step_strength}</strong>
                  {check.soft_yes && ' · yes came after a no'}
                </p>
                {check.source === 'rules' && check.fallback_reason && check.fallback_reason !== 'no_llm_key' && (
                  <p className="muted small-text">AI was unavailable ({check.fallback_reason}); used the taps instead.</p>
                )}
                <div className="check-actions">
                  {check.suggested_outcome && check.suggested_outcome !== outcome && (
                    <button className="btn small" onClick={() => pickOutcome(check.suggested_outcome)}>
                      Use {OUTCOME_LABEL[check.suggested_outcome]}
                    </button>
                  )}
                  {check.summary && check.summary !== summary && (
                    <button className="btn ghost small" onClick={() => setSummary(check.summary)}>
                      Use suggested summary
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {saveErr && <p className="error" role="alert">{saveErr}</p>}
        </div>
      )}

      <div className="footer">
        {phase === 'stage' ? (
          <>
            <button className="btn primary grow" onClick={next}>
              Next: {stage < 7 ? STAGE_BY_N[stage + 1].name : 'Close'}
            </button>
            <button className="btn ghost" onClick={endCall}>
              End call
            </button>
          </>
        ) : (
          <>
            <button className="btn primary grow" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : disagrees ? 'Save anyway' : 'Save call'}
            </button>
            <button className="btn ghost" onClick={() => goTo(Math.min(reached, 7))}>
              Back
            </button>
          </>
        )}
      </div>
    </section>
  );
}
