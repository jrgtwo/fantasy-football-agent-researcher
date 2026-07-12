import { HarnessClient } from 'agent-harness/client';
import type { AgentEvent } from 'agent-harness/client';

// Scaffold placeholder. It intentionally imports the harness *client* SDK to prove the linked
// package resolves in the browser build. The real UI (player search, Evaluate, live trace) lands
// in a later milestone.
export function App() {
  // Reference both imports so the resolution experiment isn't tree-shaken away.
  const clientName = HarnessClient.name;
  const noop = (_event: AgentEvent) => {};
  void noop;

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640 }}>
      <h1>Fantasy Football — analyst probe</h1>
      <p>
        Scaffold is up. Harness client SDK linked: <code>{clientName}</code>.
      </p>
    </main>
  );
}
