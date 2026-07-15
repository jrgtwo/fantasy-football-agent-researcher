import { HarnessClient } from 'agent-harness/client';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { getRankingCandidates } from './api';
import {
  allPendingConsents,
  allScoutsSettled,
  composeRankerInput,
  initialRankingState,
  rankingReducer,
  scoutInput,
} from './rankingReducer';
import { RANKING_CONCURRENCY } from './rankingTypes';

// Dev defaults — match the sidecar's (serve.ts). Hardcoded for the probe.
const WS_URL = 'ws://127.0.0.1:4000';
const TOKEN = 'dev-token';

// Owns a harness client connection dedicated to the Rankings tab and drives the fan-out
// orchestration: N concurrent scout runs (capped) routed by runId into rankingReducer, then one
// ranker synthesis run once every scout has settled.
export function useRanking() {
  const [state, dispatch] = useReducer(rankingReducer, initialRankingState);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<HarnessClient | null>(null);

  // Keep the latest state readable inside the (once-bound) WS event callback — avoids the stale
  // closure the callback would otherwise capture over the reducer's first render.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Idempotency guards for pump. React 18 (createRoot) commits renders on a later macrotask, so
  // `stateRef.current` LAGS a just-dispatched action; StrictMode also double-invokes effects in
  // dev. Both mean pump can run against stale state or run twice — so the "have I started this
  // yet?" decision is tracked in refs updated SYNCHRONOUSLY inside pump (before the dispatch
  // commits), not derived from the (lagging) committed status.
  const startedScouts = useRef<Set<number>>(new Set());
  const synthesisStarted = useRef(false);

  // Auto-approve is an explicit opt-in (the "Approve all & auto-approve" action) — per-request
  // consent stays the default. A SYNCHRONOUS ref for the onEvent read (can't miss a consent racing
  // the click); a state mirror for display. Both reset on rank() and stop().
  const autoApprove = useRef(false);
  const [autoApproving, setAutoApproving] = useState(false);

  // Start queued scouts up to the cap, then — once all scouts settle — start the single synthesis
  // run. Guarded to only act while researching, and idempotent via the refs above so redundant
  // invocations (StrictMode double-invoke, pre-commit re-runs) start nothing twice.
  const pump = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;
    const s = stateRef.current;
    if (s.phase !== 'researching') return;

    // Start queued scouts up to the cap, skipping any already started (ref-guarded for
    // idempotency). In-flight = started refs minus those already settled in committed state.
    const settled = s.players.filter((p) => p.status === 'done' || p.status === 'error').length;
    const inFlight = startedScouts.current.size - settled;
    let slots = Math.max(0, RANKING_CONCURRENCY - inFlight);
    for (let i = 0; i < s.players.length && slots > 0; i++) {
      if (startedScouts.current.has(i) || s.players[i]!.status !== 'queued') continue;
      startedScouts.current.add(i);
      slots--;
      const { player, stats } = s.players[i]!;
      const runId = client.startRun(scoutInput(player, stats), { agent: 'scout' });
      dispatch({ type: 'scoutStarted', index: i, runId });
    }

    if (allScoutsSettled(s) && !synthesisStarted.current) {
      synthesisStarted.current = true;
      const runId = client.startRun(composeRankerInput(s.position, s.players), { agent: 'ranker' });
      dispatch({ type: 'synthesisStarted', runId });
    }
  }, []);

  useEffect(() => {
    const client = new HarnessClient(WS_URL, TOKEN, {
      handlers: {
        onEvent: (runId, event) => {
          // Per-request consent by default: fold the event so the request joins the pending queue
          // (allPendingConsents). If the user opted into auto-approve, decide it immediately instead
          // (keyed off the synchronous ref so a consent racing the opt-in isn't missed). The pump
          // effect re-fires after React commits, reading current (not pre-commit) state.
          if (event.type === 'consent.requested' && autoApprove.current) {
            client.decideConsent(runId, event.callId, true);
          }
          dispatch({ type: 'event', runId, event });
        },
        onError: (err) => dispatch({ type: 'seedError', error: `${err.code}: ${err.message}` }),
      },
    });
    clientRef.current = client;
    client.connect().then(() => setConnected(true)).catch(() => setConnected(false));
    return () => client.close();
  }, [pump]);

  // Drive pump from a POST-COMMIT effect. React runs passive effects after committing state, so
  // `stateRef.current` is current here — unlike a microtask chained off dispatch, which would run
  // before the commit and see stale state. pump's own ref guards make redundant runs no-ops.
  useEffect(() => {
    pump();
  }, [state.phase, state.players, state.synthesisRunId, pump]);

  const rank = useCallback(async (position: string) => {
    const candidates = await getRankingCandidates(position, 8);
    if (candidates.length === 0) {
      dispatch({ type: 'seedError', error: `no candidates for ${position}` });
      return;
    }
    // Reset the idempotency + consent guards for the new ranking BEFORE seeding; the pump effect
    // fires once the seed commits.
    startedScouts.current = new Set();
    synthesisStarted.current = false;
    autoApprove.current = false;
    setAutoApproving(false);
    dispatch({ type: 'seed', position, candidates });
  }, []);

  // Consent queue: EVERY web_search is gated individually (the safety valve while the harness is
  // under active development — a runaway loop is visible and stoppable). Because scouts run
  // concurrently, several consents can be pending at once; we surface them one at a time (the head
  // of allPendingConsents) and approve/deny that specific one. Each decision clears that run's
  // consent, so the next pending one surfaces — no request is ever skipped or stranded.
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

  // Secondary: approve every currently-pending consent AND auto-approve subsequent ones — the
  // convenience path once you trust the run. Stop() is the escape hatch that makes this safe.
  const approveAll = useCallback(() => {
    autoApprove.current = true;
    setAutoApproving(true);
    const client = clientRef.current;
    if (client) for (const c of allPendingConsents(stateRef.current)) client.decideConsent(c.runId, c.callId, true);
  }, []);

  // Kill switch: deny every pending consent, cancel every in-flight run (scouts + synthesis), and
  // freeze the ranking (dispatch stop makes further events/errors no-ops). Turns off auto-approve.
  const stop = useCallback(() => {
    const client = clientRef.current;
    const s = stateRef.current;
    autoApprove.current = false;
    setAutoApproving(false);
    if (client) {
      for (const c of allPendingConsents(s)) client.decideConsent(c.runId, c.callId, false);
      for (const p of s.players) if (p.runId && p.status === 'running') client.cancel(p.runId);
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
