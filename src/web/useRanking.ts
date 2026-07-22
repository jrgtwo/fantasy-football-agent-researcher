import { HarnessClient, runGroup, type AgentEvent } from 'agent-harness/client';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { getRankingCandidates } from './api';
import {
  allPendingConsents,
  composeRankerInput,
  initialRankingState,
  rankingReducer,
  scoutInput,
} from './rankingReducer';
import { initialRunState } from './runReducer';
import { RANKING_CONCURRENCY, type PlayerRun } from './rankingTypes';

// Dev defaults — match the sidecar's (serve.ts). Hardcoded for the probe.
const WS_URL = 'ws://127.0.0.1:4000';
const TOKEN = 'dev-token';

// Owns a harness client connection dedicated to the Rankings tab and drives the FF workflow: fan out
// the scout runs via the harness `runGroup` (which owns the concurrency mechanics), then — once they
// all settle — start the single ranker synthesis run. All the fiddly "cap N, start the next, know
// when all are done" plumbing lives in the harness now, not in a React effect.
export function useRanking() {
  const [state, dispatch] = useReducer(rankingReducer, initialRankingState);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<HarnessClient | null>(null);

  // Keep the latest state readable inside async callbacks without a stale closure.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Aborts the current ranking's scout group (Stop). Fresh per rank().
  const groupAbort = useRef<AbortController | null>(null);

  // Auto-approve is an explicit opt-in ("Approve all & auto-approve") that flips the harness consent
  // policy to 'allow' (server-side); this state mirror just drives the UI. Per-request is the default.
  const [autoApproving, setAutoApproving] = useState(false);

  // TEMP debug: the exact run.start messages the browser actually puts on the wire (captured by
  // wrapping the WebSocket, so it's ground truth regardless of any client-version questions).
  const [sentDebug, setSentDebug] = useState<string[]>([]);

  // Fold one run's event into the reducer. (Consent auto-approval now lives in the harness policy.)
  const handleRunEvent = useCallback((runId: string, event: AgentEvent) => {
    dispatch({ type: 'event', runId, event });
  }, []);

  useEffect(() => {
    // TEMP debug: wrap WebSocket to record the exact bytes sent for run.start messages.
    class LoggingWebSocket extends WebSocket {
      send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        if (typeof data === 'string') {
          try {
            const m = JSON.parse(data) as { type?: string; agent?: string; cacheKey?: unknown };
            if (m.type === 'run.start') {
              const key = 'cacheKey' in m ? JSON.stringify(m.cacheKey) : 'FIELD ABSENT';
              setSentDebug((prev) => [...prev, `sent ${m.agent}: cacheKey=${key}`].slice(-12));
            }
          } catch {
            /* ignore non-JSON */
          }
        }
        super.send(data);
      }
    }
    // Every run uses a per-run onEvent (via runGroup / startRun below), so the client needs no global
    // event handler — just surface connection errors.
    const client = new HarnessClient(WS_URL, TOKEN, {
      handlers: { onError: (err) => dispatch({ type: 'seedError', error: `${err.code}: ${err.message}` }) },
      WebSocketImpl: LoggingWebSocket as unknown as typeof WebSocket,
    });
    clientRef.current = client;
    client.connect().then(() => setConnected(true)).catch(() => setConnected(false));
    return () => client.close();
  }, []);

  const rank = useCallback(
    async (position: string) => {
      const candidates = await getRankingCandidates(position, 8);
      if (candidates.length === 0) {
        dispatch({ type: 'seedError', error: `no candidates for ${position}` });
        return;
      }
      const client = clientRef.current;
      if (!client) return;

      setAutoApproving(false);
      client.setConsentPolicy('ask'); // fresh ranking → per-request consent again
      const ac = new AbortController();
      groupAbort.current = ac;
      dispatch({ type: 'seed', position, candidates });

      // Fan out the scouts; the harness caps concurrency and tells us when each settles.
      // Memoize each scout by player+season so re-ranking a position reuses research (no re-run,
      // no consent). The frozen snapshot is static within a session, so no ttl (cache for the
      // sidecar's lifetime). The ranker run stays uncached — it depends on all writeups.
      const items = candidates.map((c) => ({
        input: scoutInput(c.player, c.stats),
        agent: 'scout',
        cacheKey: `scout:${c.player.id}:${c.stats.season}`,
      }));
      // TEMP debug: trace the key through each layer between build and the wire.
      // Read the SOURCE of the harness functions the browser actually loaded — if the loaded code
      // doesn't even mention cacheKey, the browser is running a pre-cacheKey (stale) harness bundle.
      setSentDebug((prev) => [
        ...prev,
        `0a. loaded runGroup has cacheKey wiring? ${/cacheKey/.test(runGroup.toString())}`,
        `0b. loaded startRun has cacheKey wiring? ${/cacheKey/.test(client.startRun.toString())}`,
        `1. built item.cacheKey = ${JSON.stringify(items[0]?.cacheKey)}`,
      ].slice(-24));
      // Wrap the client so we see exactly what runGroup hands to startRun.
      const debugClient = {
        startRun: (
          input: string,
          opts: { agent?: string; onEvent?: (e: AgentEvent) => void; cacheKey?: string; ttl?: number },
        ) => {
          setSentDebug((prev) => [...prev, `2. runGroup→startRun cacheKey = ${JSON.stringify(opts.cacheKey ?? null)}`].slice(-24));
          return client.startRun(input, opts);
        },
        cancel: (id: string) => client.cancel(id),
      };
      const results = await runGroup(debugClient, items, {
        concurrency: RANKING_CONCURRENCY,
        signal: ac.signal,
        onEvent: (i, runId, event) => {
          if (event.type === 'run.started') dispatch({ type: 'scoutStarted', index: i, runId });
          handleRunEvent(runId, event);
        },
      });

      if (ac.signal.aborted) return; // stopped mid-fan-out — don't synthesize

      // Compose the ranker input from the scouts' writeups (run.finished result = the full answer),
      // NOT from committed reducer state, which lags React's commit at this await point.
      const scouted: PlayerRun[] = candidates.map((c, i) => ({
        player: c.player,
        stats: c.stats,
        runId: results[i]?.runId ?? null,
        status: results[i]?.status === 'error' ? 'error' : 'done',
        run: { ...initialRunState, answer: typeof results[i]?.result === 'string' ? (results[i]!.result as string) : '' },
      }));
      const rankerRunId = client.startRun(composeRankerInput(position, scouted), {
        agent: 'ranker',
        onEvent: (event) => handleRunEvent(rankerRunId, event),
      });
      dispatch({ type: 'synthesisStarted', runId: rankerRunId });
    },
    [handleRunEvent],
  );

  // Consent queue: EVERY web_search is gated individually (the safety valve while the harness is under
  // active development). Because scouts run concurrently, several consents can be pending at once; we
  // surface them one at a time (the head of allPendingConsents) — each decision clears that run's
  // consent so the next surfaces, and none is skipped or stranded.
  const pending = allPendingConsents(state);
  const head = pending[0] ?? null;

  const approve = useCallback(() => {
    const c = allPendingConsents(stateRef.current)[0];
    if (c) clientRef.current?.decideConsent(c.runId, c.callId, true);
  }, []);

  const deny = useCallback(() => {
    const c = allPendingConsents(stateRef.current)[0];
    if (c) clientRef.current?.decideConsent(c.runId, c.callId, false);
  }, []);

  // Secondary: flip the harness consent policy to auto-approve — the server resolves the current
  // backlog + all future requests, no client round-trip. Stop() is the escape hatch that makes it safe.
  const approveAll = useCallback(() => {
    setAutoApproving(true);
    clientRef.current?.setConsentPolicy('allow');
  }, []);

  // Kill switch: reset the policy to per-request, halt the scout pool, deny anything parked (so a
  // consent-blocked run can end), cancel every run on the connection, and freeze the ranking.
  const stop = useCallback(() => {
    const client = clientRef.current;
    const s = stateRef.current;
    setAutoApproving(false);
    groupAbort.current?.abort();
    if (client) {
      client.setConsentPolicy('ask');
      for (const c of allPendingConsents(s)) client.decideConsent(c.runId, c.callId, false);
      client.cancelAll();
    }
    dispatch({ type: 'stop' });
  }, []);

  const busy = state.phase === 'researching' || state.phase === 'synthesizing';

  return {
    connected, state, rank, busy,
    consent: head, pendingCount: pending.length, autoApproving,
    approve, approveAll, deny, stop,
    sentDebug,
  };
}
