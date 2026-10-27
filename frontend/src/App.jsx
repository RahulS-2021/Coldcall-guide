import { useEffect, useState } from 'react';
import { api } from './api.js';
import CallFlow from './CallFlow.jsx';
import PastCalls from './PastCalls.jsx';

export default function App() {
  const [tab, setTab] = useState('call');
  const [server, setServer] = useState('checking'); // checking | up | down
  const [slow, setSlow] = useState(false);
  const [listKey, setListKey] = useState(0); // bump to refresh the past-calls list

  useEffect(() => {
    let alive = true;
    const slowTimer = setTimeout(() => alive && setSlow(true), 1500);
    api
      .wake()
      .then(() => alive && setServer('up'))
      .catch(() => alive && setServer('down'))
      .finally(() => clearTimeout(slowTimer));
    return () => {
      alive = false;
      clearTimeout(slowTimer);
    };
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">M</span>
          <span className="brand-name">Call Guide</span>
        </div>
        <nav className="tabs" aria-label="Screens">
          <button className={tab === 'call' ? 'tab on' : 'tab'} onClick={() => setTab('call')}>
            Call
          </button>
          <button
            className={tab === 'past' ? 'tab on' : 'tab'}
            onClick={() => {
              setListKey((k) => k + 1);
              setTab('past');
            }}
          >
            Past calls
          </button>
        </nav>
      </header>

      {server === 'checking' && slow && (
        <div className="banner wait" role="status">
          Waking the server. The free tier sleeps when idle, so the first load can take up to a minute.
        </div>
      )}
      {server === 'down' && (
        <div className="banner err" role="alert">
          Cannot reach the server at {api.base}.{' '}
          <button className="link" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      )}

      <main>
        {/* CallFlow stays mounted so switching tabs mid-call does not lose the call */}
        <div hidden={tab !== 'call'}>
          <CallFlow serverUp={server === 'up'} onSaved={() => setListKey((k) => k + 1)} onViewPast={() => { setListKey((k) => k + 1); setTab('past'); }} />
        </div>
        {tab === 'past' && <PastCalls key={listKey} />}
      </main>
    </div>
  );
}
