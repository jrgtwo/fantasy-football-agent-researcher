import type { Player, PlayerStats } from '../data/types';
import type { RunState } from './runReducer';

export const RANKING_CONCURRENCY = 3;

export interface PlayerRun {
  player: Player;
  stats: PlayerStats;
  runId: string | null; // null while queued
  status: 'queued' | 'running' | 'done' | 'error' | 'stopped';
  run: RunState; // folded per-run state (answer = the scout writeup; run.consent = its pending consent)
}

export interface RankingState {
  phase: 'idle' | 'researching' | 'synthesizing' | 'done' | 'error' | 'stopped';
  position: string;
  players: PlayerRun[];
  synthesis: RunState; // the ranker run (answer = the board)
  synthesisRunId: string | null;
  error: string | null;
}

// Consent is NOT tracked at the ranking level — each run folds its own pending consent into its
// RunState.consent (see allPendingConsents), so concurrent requests all survive and are shown one
// at a time. This keeps every web_search individually gated (the safety valve during harness dev).
export type RankingAction =
  | { type: 'reset' }
  | { type: 'seed'; position: string; candidates: { player: Player; stats: PlayerStats }[] }
  | { type: 'scoutStarted'; index: number; runId: string }
  | { type: 'synthesisStarted'; runId: string }
  | { type: 'stop' } // user halted the ranking — freeze state; the hook cancels the live runs
  | { type: 'event'; runId: string; event: import('agent-harness/client').AgentEvent }
  | { type: 'seedError'; error: string };
