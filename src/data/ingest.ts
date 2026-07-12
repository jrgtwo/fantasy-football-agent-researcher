import { parsePlayersCsv, parseStatsCsv } from './nflverse';
import { SNAPSHOT_PATH, writeSnapshot } from './snapshot';

// `pnpm ingest` — one-time manual pull of a single frozen nflverse snapshot. HTTP-downloads the
// release-asset CSVs directly (no key, no service), parses them, and writes a local JSON snapshot.
// Not run on sidecar startup (dev restarts stay instant/offline). Set SEASON to override the year.

const SEASON = Number(process.env.SEASON ?? 2025);
const BASE = 'https://github.com/nflverse/nflverse-data/releases/download';
const PLAYERS_URL = `${BASE}/players/players.csv`;
const STATS_URL = `${BASE}/stats_player/stats_player_reg_${SEASON}.csv`;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status} ${res.statusText}`);
  return res.text();
}

async function main(): Promise<void> {
  console.log(`Ingesting nflverse snapshot for ${SEASON} …`);
  const [playersCsv, statsCsv] = await Promise.all([fetchText(PLAYERS_URL), fetchText(STATS_URL)]);

  const allPlayers = parsePlayersCsv(playersCsv);
  const stats = parseStatsCsv(statsCsv);

  // Keep only players who recorded regular-season stats this season: the relevant universe, and it
  // keeps the snapshot small and search useful (no retired namesakes).
  const withStats = new Set(stats.map((s) => s.playerId));
  const players = allPlayers.filter((p) => withStats.has(p.id));

  writeSnapshot({ season: SEASON, ingestedAt: new Date().toISOString(), players, stats }, SNAPSHOT_PATH);
  console.log(`Wrote ${SNAPSHOT_PATH}: ${players.length} players, ${stats.length} stat lines.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
