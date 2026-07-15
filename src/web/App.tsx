import { useState } from 'react';
import { Evaluate } from './Evaluate';
import { Rankings } from './Rankings';

type Tab = 'rankings' | 'evaluate';

export function App() {
  const [tab, setTab] = useState<Tab>('rankings');
  return (
    <main className="app">
      <header>
        <h1>
          FF Analyst <span className="muted">— probe</span>
        </h1>
        <nav className="tabs">
          <button className={tab === 'rankings' ? 'on' : ''} onClick={() => setTab('rankings')}>Rankings</button>
          <button className={tab === 'evaluate' ? 'on' : ''} onClick={() => setTab('evaluate')}>Evaluate a player</button>
        </nav>
      </header>
      {tab === 'rankings' ? <Rankings /> : <Evaluate />}
    </main>
  );
}
