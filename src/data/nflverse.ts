import { parse } from 'csv-parse/sync';
import type { Player, PlayerStats } from './types';

// Parse the nflverse CSV releases into app domain records. We map columns *by header name* (not
// index) so extra/reordered columns in the 40-/143-wide files don't matter. csv-parse handles
// quoted fields (e.g. headshot URLs that contain commas).

function rows(csv: string): Record<string, string>[] {
  return parse(csv, { columns: true, skip_empty_lines: true, relax_column_count: true }) as Record<string, string>[];
}

const num = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function parsePlayersCsv(csv: string): Player[] {
  return rows(csv).map((r) => ({
    id: r.gsis_id ?? '',
    name: r.display_name ?? '',
    position: r.position ?? '',
    team: r.latest_team ?? '',
    headshot: r.headshot ?? '',
    status: r.status ?? '',
  }));
}

export function parseStatsCsv(csv: string): PlayerStats[] {
  return rows(csv).map((r) => ({
    playerId: r.player_id ?? '',
    season: num(r.season),
    seasonType: r.season_type ?? '',
    team: r.recent_team ?? '',
    games: num(r.games),
    passingYards: num(r.passing_yards),
    passingTds: num(r.passing_tds),
    interceptions: num(r.passing_interceptions),
    carries: num(r.carries),
    rushingYards: num(r.rushing_yards),
    rushingTds: num(r.rushing_tds),
    receptions: num(r.receptions),
    targets: num(r.targets),
    receivingYards: num(r.receiving_yards),
    receivingTds: num(r.receiving_tds),
    fantasyPoints: num(r.fantasy_points),
    fantasyPointsPpr: num(r.fantasy_points_ppr),
  }));
}
