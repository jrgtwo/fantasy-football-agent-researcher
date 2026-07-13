import type { ClientToolDecl } from 'agent-harness/client';
import type { Player, PlayerStats } from '../data/types';

// Client-side (app-connector) tool: the analyst calls back into the browser UI to pull up a player
// and get their real stat line. The handler runs here in the browser (not the sidecar), driving the
// same search + card the user does. Proves the harness's client-tool RPC round-trip.

export const SELECT_PLAYER_TOOL: ClientToolDecl = {
  name: 'select_player',
  description:
    'Pull up a player in the app UI and return their most recent season stat line. Use to inspect ' +
    'another player mid-analysis (e.g. a teammate or position competitor) so a comparison is grounded ' +
    'in real numbers.',
  params: {
    type: 'object',
    properties: { name: { type: 'string', description: 'Player full name, e.g. "Josh Allen".' } },
    required: ['name'],
    additionalProperties: false,
  },
  mode: 'confirm',
};

/** The compact, agent-facing view of a stat line (mirrors the Evaluate prompt's shape). */
function compactStats(s: PlayerStats) {
  return {
    games: s.games,
    fantasyPointsPPR: s.fantasyPointsPpr,
    passYds: s.passingYards,
    passTds: s.passingTds,
    int: s.interceptions,
    rushYds: s.rushingYards,
    rushTds: s.rushingTds,
    rec: s.receptions,
    tgt: s.targets,
    recYds: s.receivingYards,
    recTds: s.receivingTds,
  };
}

export interface SelectPlayerDeps {
  searchPlayers: (q: string) => Promise<Player[]>;
  getPlayerStats: (id: string) => Promise<PlayerStats | null>;
}

export type SelectPlayerOutcome =
  | { ok: true; player: Player; stats: PlayerStats | null; payload: unknown }
  | { ok: false; error: string };

/**
 * Resolve a `select_player` call: name → top match → stat line + a compact payload for the model.
 * Pure over its deps (no React/DOM) so it can be unit-tested; the component applies the UI state.
 */
export async function resolveSelectPlayer(args: unknown, deps: SelectPlayerDeps): Promise<SelectPlayerOutcome> {
  const raw = (args as { name?: unknown } | null)?.name;
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name) return { ok: false, error: 'select_player requires a "name" argument' };

  const matches = await deps.searchPlayers(name);
  const top = matches[0];
  if (!top) return { ok: false, error: `no player named "${name}" found` };

  const stats = await deps.getPlayerStats(top.id);
  const payload = {
    player: { name: top.name, position: top.position, team: top.team },
    season: stats?.season ?? null,
    stats: stats ? compactStats(stats) : null,
  };
  return { ok: true, player: top, stats, payload };
}
