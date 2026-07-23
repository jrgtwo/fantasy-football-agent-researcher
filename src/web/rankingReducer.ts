import type { AgentEvent } from 'agent-harness/client';
import type { Player, PlayerStats } from '../data/types';
import { foldRunEvent, initialRunState, type ConsentPrompt } from './runReducer';
import type { PlayerRun, RankingAction, RankingState } from './rankingTypes';

export const initialRankingState: RankingState = {
  phase: 'idle', position: '', players: [], synthesis: initialRunState, synthesisRunId: null, error: null,
};

const settled = (s: PlayerRun['status']) => s === 'done' || s === 'error' || s === 'stopped';

// Compact the stat line the way App.onEvaluate does — a small, model-friendly object.
function compactStats(stats: PlayerStats) {
  return {
    games: stats.games, passYds: stats.passingYards, passTds: stats.passingTds, int: stats.interceptions,
    carries: stats.carries, rushYds: stats.rushingYards, rushTds: stats.rushingTds, rec: stats.receptions,
    tgt: stats.targets, recYds: stats.receivingYards, recTds: stats.receivingTds,
    fantasyPointsPPR: stats.fantasyPointsPpr,
  };
}

export function scoutInput(player: Player, stats: PlayerStats): string {
  return (
    `Research ${player.name} (${player.position}, ${player.team}) for the upcoming season. ` +
    `Most recent (season ${stats.season}) regular-season stats: ${JSON.stringify(compactStats(stats))}. ` +
    `Give a concise scouting writeup and cite your sources.`
  );
}

export function composeRankerInput(position: string, players: PlayerRun[]): string {
  // Give each candidate an id (P1..Pn). The ranker returns a structured board keyed by these ids
  // (rankingBoard resolves each pick's id back to the seeded player). The id resolves by exact lookup.
  const blocks = players
    .map((pr, i) => {
      const writeup = pr.run.answer.trim() || '(no writeup produced)';
      return `### id=P${i + 1} · ${pr.player.name} (${pr.player.team}) · season ${pr.stats.season} PPR ${pr.stats.fantasyPointsPpr.toFixed(1)}\n${writeup}`;
    })
    .join('\n\n');
  return `Rank the top 5 ${position} for the upcoming season based on these scouting notes. Use the id shown for each player (P1, P2, …) as the id for each pick.\n\n${blocks}`;
}

export function allScoutsSettled(state: RankingState): boolean {
  return state.players.length > 0 && state.players.every((p) => settled(p.status));
}

// Every consent currently awaiting a decision across the whole fan-out — each run folds its own
// pending consent into its state (cleared on consent.decided), so this is the true set. The
// ranking-level `state.consent` is only a representative (the latest); resolving that alone strands
// the concurrent consents it overwrote. Approve/deny must act over ALL of these.
export function allPendingConsents(state: RankingState): ConsentPrompt[] {
  const pending = state.players.map((p) => p.run.consent).filter((c): c is ConsentPrompt => c !== null);
  if (state.synthesis.consent) pending.push(state.synthesis.consent);
  return pending;
}

function updatePlayer(state: RankingState, index: number, fn: (p: PlayerRun) => PlayerRun): RankingState {
  const players = state.players.map((p, i) => (i === index ? fn(p) : p));
  return { ...state, players };
}

export function rankingReducer(state: RankingState, action: RankingAction): RankingState {
  switch (action.type) {
    case 'reset':
      return initialRankingState;
    case 'seed':
      return {
        ...initialRankingState,
        phase: 'researching',
        position: action.position,
        players: action.candidates.map((c) => ({
          player: c.player, stats: c.stats, runId: null, status: 'queued', run: initialRunState,
        })),
      };
    case 'seedError':
      if (state.phase === 'stopped') return state; // a halted ranking stays halted
      return { ...state, phase: 'error', error: action.error };
    case 'scoutStarted':
      return updatePlayer(state, action.index, (p) => ({ ...p, runId: action.runId, status: 'running' }));
    case 'synthesisStarted':
      return { ...state, phase: 'synthesizing', synthesisRunId: action.runId };
    case 'stop':
      // Freeze the ranking: any run still in flight is marked stopped and its pending consent
      // cleared; already-settled runs keep their outcome. The hook cancels the live runs; `event`
      // and `seedError` no-op once stopped so late/abort events can't revive it.
      return {
        ...state,
        phase: 'stopped',
        players: state.players.map((p) =>
          settled(p.status) ? p : { ...p, status: 'stopped', run: { ...p.run, consent: null } },
        ),
        synthesis: { ...state.synthesis, consent: null },
      };
    case 'event':
      if (state.phase === 'stopped') return state;
      return foldEvent(state, action.runId, action.event);
  }
}

function foldEvent(state: RankingState, runId: string, event: AgentEvent): RankingState {
  // Synthesis run?
  if (runId === state.synthesisRunId) {
    const synthesis = foldRunEvent(state.synthesis, runId, event);
    const phase = event.type === 'run.finished' ? 'done' : event.type === 'run.error' ? 'error' : state.phase;
    const error = event.type === 'run.error' ? event.error : state.error;
    return { ...state, synthesis, phase, error };
  }
  // Otherwise a scout run. foldRunEvent folds this run's pending consent into its own run.consent
  // (set on consent.requested, cleared on consent.decided) — allPendingConsents reads that, so
  // concurrent requests all survive and are shown one at a time.
  const index = state.players.findIndex((p) => p.runId === runId);
  if (index === -1) return state;

  return updatePlayer(state, index, (p) => {
    const run = foldRunEvent(p.run, runId, event);
    const status =
      event.type === 'run.finished' ? 'done' : event.type === 'run.error' ? 'error' : p.status;
    return { ...p, run, status };
  });
}
