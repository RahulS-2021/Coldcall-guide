import { STAGES, tapLabel } from './stages.js';

// Read-only recap of what was tapped and typed during a call.
// `data` is { [stage]: { taps, words, extra } }.
export default function Recap({ data, emptyText = 'Nothing was recorded during the call.' }) {
  const rows = STAGES.filter((s) => s.n < 8)
    .map((s) => ({ s, d: data[s.n] }))
    .filter(({ d }) => d && (d.taps?.length || d.words?.trim() || Object.values(d.extra ?? {}).some(Boolean)));
  if (!rows.length) return <p className="muted small-text">{emptyText}</p>;
  return (
    <div className="recap">
      {rows.map(({ s, d }) => (
        <div key={s.n} className="recap-row">
          <span className="recap-stage">
            {s.n}. {s.name}
          </span>
          <span className="recap-body">
            {(d.taps ?? []).map((id) => tapLabel(s.n, id)).join(' · ')}
            {d.extra?.when ? ` (${d.extra.when})` : ''}
            {d.extra?.callback_at ? ` (call back ${new Date(d.extra.callback_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })})` : ''}
            {d.words?.trim() && <em> “{d.words.trim()}”</em>}
          </span>
        </div>
      ))}
    </div>
  );
}
