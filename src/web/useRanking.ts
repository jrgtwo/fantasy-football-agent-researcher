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

  // Auto-approve is an explicit opt-in (the "Approve all & auto-approve" action) — per-request consent
  // stays the default. A SYNCHRONOUS ref for the event-callback read; a state mirror for display.
  const autoApprove = useRef(false);
  const [autoApproving, setAutoApproving] = useState(false);

  // Fold one run's event into the reducer, auto-approving consent if the user opted in.
  const handleRunEvent = useCallback((runId: string, event: AgentEvent) => {
    if (event.type === 'consent.requested' && autoApprove.current) {
      clientRef.current?.decideConsent(runId, event.callId, true);
    }
    dispatch({ type: 'event', runId, event });
  }, []);

  useEffect(() => {
    // Every run uses a per-run onEvent (via runGroup / startRun below), so the client needs no global
    // event handler — just surface connection errors.
    const client = new HarnessClient(WS_URL, TOKEN, {
      handlers: { onError: (err) => dispatch({ type: 'seedError', error: `${err.code}: ${err.message}` }) },
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

      autoApprove.current = false;
      setAutoApproving(false);
      const ac = new AbortController();
      groupAbort.current = ac;
      dispatch({ type: 'seed', position, candidates });

      // Fan out the scouts; the harness caps concurrency and tells us when each settles.
      const items = candidates.map((c) => ({ input: scoutInput(c.player, c.stats), agent: 'scout' }));
      const results = await runGroup(client, items, {
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

  // Secondary: approve every currently-pending consent AND auto-approve subsequent ones. Stop() is the
  // escape hatch that makes this safe.
  const approveAll = useCallback(() => {
    autoApprove.current = true;
    setAutoApproving(true);
    const client = clientRef.current;
    if (client) for (const c of allPendingConsents(stateRef.current)) client.decideConsent(c.runId, c.callId, true);
  }, []);

  // Kill switch: abort the scout group (harness cancels its in-flight runs), cancel the ranker if it's
  // running, deny any pending consents, and freeze the ranking. Turns off auto-approve.
  const stop = useCallback(() => {
    const client = clientRef.current;
    const s = stateRef.current;
    autoApprove.current = false;
    setAutoApproving(false);
    groupAbort.current?.abort();
    if (client) {
      for (const c of allPendingConsents(s)) client.decideConsent(c.runId, c.callId, false);
      if (s.synthesisRunId && s.phase === 'synthesizing') client.cancel(s.synthesisRunId);
    }
    dispatch({ type: 'stop' });
  }, []);

  const busy = state.phase === 'researching' || state.phase === 'synthesizing';

  return {
    connected, state, rank, busy,
    consent: head, pendingCount: pending.length, autoApproving,
    approve, approveAll, deny, stop,
  };
}
