import { useState } from 'react';
import { PlayerCard } from './PlayerCard';
import { resolveRankedPlayers } from './rankingBoard';
import { useRanking } from './useRanking';

const POSITIONS = ['QB', 'RB', 'WR', 'TE'];

export function Rankings() {
  const { connected, state, rank, busy, consent, pendingCount, autoApproving, approve, approveAll, deny, stop } =
    useRanking();
  const [pos, setPos] = useState('QB');
  const doneCount = state.players.filter((p) => p.status !== 'queued' && p.status !== 'running').length;
  // Which run raised the pending consent — the synthesis run, or a specific scout.
  const consentWho = consent
    ? consent.runId === state.synthesisRunId
      ? 'ranking synthesis'
      : (state.players.find((p) => p.runId === consent.runId)?.player.name ?? 'a scout')
    : '';

  return (
    <section className="rankings">
      <div className="rank-controls">
        {POSITIONS.map((p) => (
          <button key={p} className={p === pos ? 'pos on' : 'pos'} onClick={() => setPos(p)} disabled={busy}>
            {p}
          </button>
        ))}
        <button className="evaluate" disabled={busy || !connected} onClick={() => rank(pos)}>
          {busy ? 'Working…' : 'Rank'}
        </button>
        {busy && (
          <button className="deny stop" onClick={stop}>
            Stop
          </button>
        )}
      </div>

      {autoApproving && busy && (
        <p className="muted small">Auto-approving web research — hit Stop to halt.</p>
      )}

      {consent && (
        <section className="consent">
          <p>
            Allow <code>{consent.name}</code> for <b>{consentWho}</b>?{' '}
            {pendingCount > 1 && <span className="muted">({pendingCount} pending)</span>}
          </p>
          <p className="muted small consent-args">{JSON.stringify(consent.args)}</p>
          <div className="consent-actions">
            <button onClick={approve}>Approve</button>
            <button className="deny" onClick={deny}>Deny</button>
            <button onClick={approveAll}>Approve all &amp; auto-approve</button>
          </div>
        </section>
      )}

      {state.players.length > 0 && (
        <>
          <p className="muted small">
            {state.phase === 'stopped'
              ? `Stopped — ${doneCount}/${state.players.length} finished`
              : state.phase === 'synthesizing'
                ? 'Synthesizing ranking…'
                : `Researching ${state.position} — ${doneCount}/${state.players.length} done`}
          </p>
          <ul className="scout-list">
            {state.players.map((pr) => (
              <li key={pr.player.id} className={`scout ${pr.status}`}>
                <details>
                  <summary>
                    <span className={`chip ${pr.status}`} /> {pr.player.name}{' '}
                    <span className="muted">· {pr.status}</span>
                  </summary>
                  {pr.run.answer && <p className="writeup">{pr.run.answer}</p>}
                  {pr.run.trace.length > 0 && (
                    <ol className="trace">
                      {pr.run.trace.map((l, i) => (
                        <li key={i} className={l.kind}>{l.text}</li>
                      ))}
                    </ol>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </>
      )}

      {state.synthesis.answer &&
        (() => {
          // Hydrate the ranker's [[Pn]] handles into real cards; fall back to prose-only if none parse.
          const picks = resolveRankedPlayers(state.synthesis.answer, state.players);
          return (
            <div className="verdict board">
              <h3>Ranked top 5 — {state.position}</h3>
              {picks.length > 0 && (
                <ol className="ranked-cards">
                  {picks.map((pick) => (
                    <li key={pick.run.player.id} className="ranked-card">
                      <span className="rank-num">{pick.rank}</span>
                      <PlayerCard className="compact" player={pick.run.player} stats={pick.run.stats} />
                      {pick.note && <p className="rank-note">{pick.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
              <details className="board-prose" open={picks.length === 0}>
                <summary>Full analysis</summary>
                <pre className="board-md">{state.synthesis.answer}</pre>
              </details>
            </div>
          );
        })()}
      {state.error && <p className="error">error: {state.error}</p>}
    </section>
  );
}
