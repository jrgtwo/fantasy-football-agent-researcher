import { useCallback, useState } from 'react';
import type { Player, PlayerStats } from '../data/types';
import { getPlayerStats, searchPlayers } from './api';
import { SELECT_PLAYER_TOOL, resolveSelectPlayer } from './clientTools';
import { PlayerCard } from './PlayerCard';
import { useHarness, type ToolInvokeHandler } from './useHarness';

export function Evaluate() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);

  // App-connector tool: the agent calls select_player → we run the same search + card the user does,
  // update the UI, and hand the resolved stat line back to the model.
  const onToolInvoke = useCallback<ToolInvokeHandler>(async (req) => {
    if (req.name !== SELECT_PLAYER_TOOL.name) return { error: `unknown client tool "${req.name}"` };
    const outcome = await resolveSelectPlayer(req.args, { searchPlayers, getPlayerStats });
    if (!outcome.ok) return { error: outcome.error };
    setSelected(outcome.player);
    setResults([]);
    setQuery(outcome.player.name);
    setStats(outcome.stats);
    return { result: outcome.payload };
  }, []);

  const { run, connected, evaluate, decideConsent } = useHarness({
    clientTools: [SELECT_PLAYER_TOOL],
    onToolInvoke,
  });

  async function onSearch(q: string) {
    setQuery(q);
    setResults(q.trim() ? await searchPlayers(q) : []);
  }

  async function onSelect(p: Player) {
    setSelected(p);
    setResults([]);
    setQuery(p.name);
    setStats(await getPlayerStats(p.id));
  }

  function onEvaluate() {
    if (!selected || !stats) return;
    // Probe #2: structured app state gets stuffed into the prompt string (startRun takes only a string).
    const compact = {
      games: stats.games,
      passYds: stats.passingYards,
      passTds: stats.passingTds,
      int: stats.interceptions,
      carries: stats.carries,
      rushYds: stats.rushingYards,
      rushTds: stats.rushingTds,
      rec: stats.receptions,
      tgt: stats.targets,
      recYds: stats.receivingYards,
      recTds: stats.receivingTds,
      fantasyPointsPPR: stats.fantasyPointsPpr,
    };
    const prompt =
      `Give a fantasy outlook for ${selected.name} (${selected.position}, ${selected.team}) for the upcoming season. ` +
      `Most recent (season ${stats.season}) regular-season stats: ${JSON.stringify(compact)}. ` +
      `It is the NFL offseason — research offseason news (injury recovery, role/depth-chart changes, expectations) ` +
      `and give a season outlook with reasoning, citing sources.`;
    evaluate(prompt);
  }

  const running = run.status === 'running';

  return (
    <>
      <span className={`dot ${connected ? 'on' : 'off'}`} title={connected ? 'harness connected' : 'connecting…'} />

      <div className="search">
        <input placeholder="Search a player…" value={query} onChange={(e) => onSearch(e.target.value)} />
        {results.length > 0 && (
          <ul className="results">
            {results.map((p) => (
              <li key={p.id}>
                <button onClick={() => onSelect(p)}>
                  {p.name} <span className="muted">· {p.position} · {p.team}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && stats && (
        <PlayerCard player={selected} stats={stats}>
          <button className="evaluate" disabled={running || !connected} onClick={onEvaluate}>
            {running ? 'Evaluating…' : 'Evaluate'}
          </button>
        </PlayerCard>
      )}

      {run.consent && (
        <section className="consent">
          <p>
            Allow <code>{run.consent.name}</code>(<code>{JSON.stringify(run.consent.args)}</code>)?
          </p>
          <div className="consent-actions">
            <button onClick={() => decideConsent(true)}>Approve</button>
            <button className="deny" onClick={() => decideConsent(false)}>
              Deny
            </button>
          </div>
        </section>
      )}

      {(run.trace.length > 0 || run.answer || run.thinking || run.result != null || run.error) && (
        <section className="run">
          {run.trace.length > 0 && (
            <ol className="trace">
              {run.trace.map((l, i) => (
                <li key={i} className={l.kind}>
                  {l.text}
                </li>
              ))}
            </ol>
          )}
          {run.thinking && (
            <details className="thinking">
              <summary>reasoning ({run.thinking.length} chars)</summary>
              <p>{run.thinking}</p>
            </details>
          )}
          {run.answer ? (
            <div className="verdict">
              <h3>Verdict</h3>
              <p>{run.answer}</p>
            </div>
          ) : run.status === 'done' && run.result != null ? (
            <div className="verdict">
              <h3>Verdict (from run result)</h3>
              <p>{typeof run.result === 'string' ? run.result : JSON.stringify(run.result, null, 2)}</p>
            </div>
          ) : null}
          {run.error && <p className="error">error: {run.error}</p>}
          <p className="muted small">status: {run.status}</p>
        </section>
      )}
    </>
  );
}
