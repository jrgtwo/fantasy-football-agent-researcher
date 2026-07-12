// App-owned domain types (not the harness's). Structured, deterministic facts from nflverse —
// the app fetches these directly and hands them to the analyst as context; the agent does not
// fetch raw stats.

export interface Player {
  /** nflverse gsis_id — the join key to PlayerStats.playerId. */
  id: string;
  name: string;
  position: string;
  team: string;
  headshot: string;
  status: string;
}

export interface PlayerStats {
  playerId: string;
  season: number;
  seasonType: string;
  team: string;
  games: number;
  passingYards: number;
  passingTds: number;
  interceptions: number;
  carries: number;
  rushingYards: number;
  rushingTds: number;
  receptions: number;
  targets: number;
  receivingYards: number;
  receivingTds: number;
  fantasyPoints: number;
  fantasyPointsPpr: number;
}

export interface Snapshot {
  season: number;
  ingestedAt: string;
  players: Player[];
  stats: PlayerStats[];
}
