import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { STAGES, STAGE_BY_N, OUTCOME_LABEL, FLAG_LABEL } from './stages.js';
import Recap from './Recap.jsx';

function when(iso) {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`;
}

const mins = (s) => (s == null ? '' : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);

export default function PastCalls() {
  const [calls, setCalls] = useState(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState(null); // stage number or null
  const [open, setOpen] = useState(null); // call id
  const [detail, setDetail] = useState({}); // id -> { data } | 'loading' | 'error'

  const load = () => {
    setErr('');
    setCalls(null);
    api
      .listCalls()
      .then(setCalls)
      .catch((e) => setErr(e.message));
  };
  useEffect(load, []);

  const finished = useMemo(() => (calls ?? []).filter((c) => c.ended_at), [calls]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(STAGES.map((s) => [s.n, 0]));
    finished.forEach((x) => {
      c[x.last_stage] += 1;
    });
    return c;
  }, [finished]);
  const maxCount = Math.max(1, ...Object.values(counts));
  const early = finished.filter((c) => c.last_stage <= 3).length;
  const mismatches = finished.filter((c) => c.mismatch).length;
  const shown = finished.filter((c) => filter == null || c.last_stage === filter);

  const toggle = async (id) => {
    if (open === id) {
      setOpen(null);
      return;
    }
    setOpen(id);
    if (detail[id]?.data) return;
    setDetail((d) => ({ ...d, [id]: 'loading' }));
    try {
      const { stages } = await api.getCall(id);
      const data = Object.fromEntries(stages.map((s) => [s.stage, s]));
      setDetail((d) => ({ ...d, [id]: { data } }));
    } catch {
      setDetail((d) => ({ ...d, [id]: 'error' }));
    }
  };

  return (
    <section className="screen">
      <div className="card">
        <div className="pc-head">
          <div>
            <p className="eyebrow">Past calls</p>
            <h1>Where your calls end</h1>
          </div>
          <button className="btn ghost small" onClick={load}>
            Refresh
          </button>
        </div>

        {err && (
          <p className="error" role="alert">
            {err}{' '}
            <button className="link" onClick={load}>
              Retry
            </button>
          </p>
        )}
        {!calls && !err && <p className="muted">Loading…</p>}

        {calls && (
          <>
            <p className="muted small-text">
              {finished.length} calls · {early} ended by stage 3 · {mismatches} outcome{mismatches === 1 ? '' : 's'} differing from the check
            </p>
            <div className="bars" role="group" aria-label="Filter by the stage a call reached">
              {STAGES.map((s) => (
                <button
                  key={s.n}
                  className={`bar ${filter === s.n ? 'on' : ''}`}
                  aria-pressed={filter === s.n}
                  onClick={() => setFilter(filter === s.n ? null : s.n)}
                  title={`${s.name}: ${counts[s.n]}`}
                >
                  <span className="bar-n">{counts[s.n]}</span>
                  <span className="bar-fill" style={{ height: `${Math.max(4, (counts[s.n] / maxCount) * 56)}px` }} />
                  <span className="bar-l">{s.n}</span>
                </button>
              ))}
            </div>
            <p className="muted small-text bar-caption">
              {filter ? `Showing calls that ended at ${STAGE_BY_N[filter].name}. Tap the bar again to clear.` : 'Tap a bar to see the calls that ended at that stage.'}
            </p>
          </>
        )}
      </div>

      {calls && shown.length === 0 && (
        <div className="card">
          <p className="muted">{finished.length ? 'No calls ended at that stage.' : 'No saved calls yet. Finish a call and it appears here.'}</p>
        </div>
      )}

      <ul className="calls">
        {shown.map((c) => {
          const isOpen = open === c.id;
          const d = detail[c.id];
          return (
            <li key={c.id} className="call">
              <button className="call-row" onClick={() => toggle(c.id)} aria-expanded={isOpen}>
                <div className="call-main">
                  <strong>{c.contact_name}</strong>
                  <span className="call-co">
                    {c.company || 'No company'}
                    {c.call_type === 'follow_up' ? ' · follow-up' : ''}
                  </span>
                  <span className="call-sum">{c.summary || OUTCOME_LABEL[c.outcome]}</span>
                </div>
                <div className="call-side">
                  <span className="call-stage">{STAGE_BY_N[c.last_stage].name}</span>
                  <span className="call-time">{when(c.started_at)}</span>
                </div>
              </button>
              <div className="call-pills">
                <span className="pill dark">{OUTCOME_LABEL[c.outcome]}</span>
                {(c.flags ?? []).map((f) => (
                  <span key={f} className="pill">
                    {FLAG_LABEL[f]}
                    {f === 'callback_due' && c.callback_at ? ` ${when(c.callback_at)}` : ''}
                  </span>
                ))}
                {c.mismatch && <span className="pill warn">Outcome differs from the check</span>}
                {c.duration_seconds != null && <span className="pill quiet">{mins(c.duration_seconds)}</span>}
              </div>
              {isOpen && (
                <div className="call-detail">
                  {d === 'loading' && <p className="muted small-text">Loading…</p>}
                  {d === 'error' && <p className="error">Could not load this call.</p>}
                  {d?.data && <Recap data={d.data} emptyText="Nothing was recorded at the stages for this call." />}
                  {c.check_result?.reason && c.mismatch && <p className="small-text warn-text">Check: {c.check_result.reason}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
