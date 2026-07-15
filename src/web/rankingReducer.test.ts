import type { AgentEvent } from 'agent-harness/client';
import { describe, expect, it } from 'vitest';
import type { Player, PlayerStats } from '../data/types';
import {
  allPendingConsents, allScoutsSettled, composeRankerInput, initialRankingState,
  rankingReducer, scoutInput,
} from './rankingReducer';

const p = (id: string, name: string): Player =>
  ({ id, name, position: 'QB', team: 'KC', headshot: '', status: '' });
const st = (id: string, ppr: number): PlayerStats =>
  ({ playerId: id, season: 2024, seasonType: 'REG', team: 'KC', games: 17, passingYards: 4000,
     passingTds: 30, interceptions: 8, carries: 20, rushingYards: 100, rushingTds: 1, receptions: 0,
     targets: 0, receivingYards: 0, receivingTds: 0, fantasyPoints: 300, fantasyPointsPpr: ppr }) as PlayerStats;
const seed = {
  type: 'seed' as const, position: 'QB',
  candidates: [{ player: p('a', 'A'), stats: st('a', 300) }, { player: p('b', 'B'), stats: st('b', 250) }],
};
const ev = (runId: string, event: AgentEvent) => ({ type: 'event' as const, runId, event });

describe('rankingReducer', () => {
  it('seeds candidates as queued and enters researching', () => {
    const s = rankingReducer(initialRankingState, seed);
    expect(s.phase).toBe('researching');
    expect(s.players.map((x) => x.status)).toEqual(['queued', 'queued']);
  });

  it('routes a run event to the player with that runId', () => {
    let s = rankingReducer(initialRankingState, seed);
    s = rankingReducer(s, { type: 'scoutStarted', index: 0, runId: 'r0' });
    s = rankingReducer(s, ev('r0', { type: 'token', runId: 'r0', text: 'writeup' }));
    expect(s.players[0]!.run.answer).toBe('writeup');
    expect(s.players[1]!.run.answer).toBe('');
  });

  it('marks a player done on run.finished', () => {
    let s = rankingReducer(initialRankingState, seed);
    s = rankingReducer(s, { type: 'scoutStarted', index: 0, runId: 'r0' });
    s = rankingReducer(s, ev('r0', { type: 'run.finished', runId: 'r0', result: 'x' }));
    expect(s.players[0]!.status).toBe('done');
  });

  it('folds a pending consent into the requesting run and clears it when decided', () => {
    let s = rankingReducer(initialRankingState, seed);
    s = rankingReducer(s, { type: 'scoutStarted', index: 0, runId: 'r0' });
    s = rankingReducer(s, ev('r0', { type: 'consent.requested', runId: 'r0', callId: 'c1', name: 'web_search', args: {} }));
    expect(s.players[0]!.run.consent?.callId).toBe('c1');
    expect(s.players[1]!.run.consent).toBeNull();
    s = rankingReducer(s, ev('r0', { type: 'consent.decided', runId: 'r0', callId: 'c1', allow: true }));
    expect(s.players[0]!.run.consent).toBeNull();
  });

  it('routes events to the synthesis run', () => {
    let s = rankingReducer(initialRankingState, seed);
    s = rankingReducer(s, { type: 'synthesisStarted', runId: 'rank1' });
    expect(s.phase).toBe('synthesizing');
    s = rankingReducer(s, ev('rank1', { type: 'token', runId: 'rank1', text: '1. A' }));
    expect(s.synthesis.answer).toBe('1. A');
    s = rankingReducer(s, ev('rank1', { type: 'run.finished', runId: 'rank1', result: 'done' }));
    expect(s.phase).toBe('done');
  });

  it('enters the error phase on seedError', () => {
    const s = rankingReducer(initialRankingState, { type: 'seedError', error: 'no candidates for QB' });
    expect(s.phase).toBe('error');
    expect(s.error).toBe('no candidates for QB');
  });

  it('stop freezes the ranking: non-settled runs become stopped, consents clear, later events ignored', () => {
    let s = rankingReducer(initialRankingState, seed);
    s = rankingReducer(s, { type: 'scoutStarted', index: 0, runId: 'r0' });
    s = rankingReducer(s, { type: 'scoutStarted', index: 1, runId: 'r1' });
    s = rankingReducer(s, ev('r0', { type: 'run.finished', runId: 'r0', result: 'x' })); // player 0 settled
    s = rankingReducer(s, ev('r1', { type: 'consent.requested', runId: 'r1', callId: 'c1', name: 'web_search', args: {} }));
    s = rankingReducer(s, { type: 'stop' });
    expect(s.phase).toBe('stopped');
    expect(s.players[0]!.status).toBe('done'); // already-settled runs keep their outcome
    expect(s.players[1]!.status).toBe('stopped'); // in-flight run marked stopped
    expect(allPendingConsents(s)).toEqual([]); // pending consents cleared
    // events arriving after stop (e.g. from a run that hadn't aborted yet) are ignored
    const after = rankingReducer(s, ev('r1', { type: 'token', runId: 'r1', text: 'late' }));
    expect(after.players[1]!.run.answer).toBe('');
    expect(after.phase).toBe('stopped');
  });
});

describe('ranking helpers', () => {
  it('allScoutsSettled is true only when every scout is done or error', () => {
    let s = rankingReducer(initialRankingState, seed);
    s = rankingReducer(s, { type: 'scoutStarted', index: 0, runId: 'r0' });
    s = rankingReducer(s, { type: 'scoutStarted', index: 1, runId: 'r1' });
    s = rankingReducer(s, ev('r0', { type: 'run.finished', runId: 'r0', result: 'x' }));
    expect(allScoutsSettled(s)).toBe(false);
    s = rankingReducer(s, ev('r1', { type: 'run.error', runId: 'r1', error: 'boom' }));
    expect(allScoutsSettled(s)).toBe(true);
  });

  it('scoutInput includes the player and PPR; composeRankerInput lists each writeup', () => {
    expect(scoutInput(p('a', 'Alice'), st('a', 300))).toContain('Alice');
    let s = rankingReducer(initialRankingState, seed);
    s = rankingReducer(s, { type: 'scoutStarted', index: 0, runId: 'r0' });
    s = rankingReducer(s, ev('r0', { type: 'token', runId: 'r0', text: 'A is great' }));
    const input = composeRankerInput('QB', s.players);
    expect(input).toContain('QB');
    expect(input).toContain('A is great');
    expect(input).toContain('[[P1]]'); // handles injected for the card-hydration round-trip
    expect(input).toContain('[[P2]]');
  });

  it('allPendingConsents returns EVERY concurrently-pending consent (not just the representative)', () => {
    // Two first-wave scouts both request web_search consent before the user decides. The single
    // ranking-level state.consent only reflects the latest — but a robust approve must resolve BOTH,
    // or the overwritten one strands its run forever (the live 2-stuck-scouts bug).
    let s = rankingReducer(initialRankingState, seed);
    s = rankingReducer(s, { type: 'scoutStarted', index: 0, runId: 'r0' });
    s = rankingReducer(s, { type: 'scoutStarted', index: 1, runId: 'r1' });
    s = rankingReducer(s, ev('r0', { type: 'consent.requested', runId: 'r0', callId: 'c0', name: 'web_search', args: {} }));
    s = rankingReducer(s, ev('r1', { type: 'consent.requested', runId: 'r1', callId: 'c1', name: 'web_search', args: {} }));
    const pending = allPendingConsents(s);
    expect(pending.map((c) => c.callId).sort()).toEqual(['c0', 'c1']); // BOTH survive — neither strands
  });

  it('allPendingConsents includes a pending synthesis consent and drops resolved ones', () => {
    let s = rankingReducer(initialRankingState, seed);
    s = rankingReducer(s, { type: 'scoutStarted', index: 0, runId: 'r0' });
    s = rankingReducer(s, ev('r0', { type: 'consent.requested', runId: 'r0', callId: 'c0', name: 'web_search', args: {} }));
    s = rankingReducer(s, { type: 'synthesisStarted', runId: 'rank1' });
    s = rankingReducer(s, ev('rank1', { type: 'consent.requested', runId: 'rank1', callId: 'cs', name: 'web_search', args: {} }));
    expect(allPendingConsents(s).map((c) => c.callId).sort()).toEqual(['c0', 'cs']);
    // once c0 is decided it drops out of the pending set
    s = rankingReducer(s, ev('r0', { type: 'consent.decided', runId: 'r0', callId: 'c0', allow: true }));
    expect(allPendingConsents(s).map((c) => c.callId)).toEqual(['cs']);
  });
});
