import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Snapshot } from './types';

// The frozen local snapshot the app develops against. Written once by `pnpm ingest`, read on
// sidecar startup. Lives under the gitignored data/ dir — never committed. Refresh is deferred:
// re-running ingest overwrites it.

export const SNAPSHOT_PATH = 'data/snapshot.json';

export function writeSnapshot(snapshot: Snapshot, path: string = SNAPSHOT_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(snapshot));
}

export function loadSnapshot(path: string = SNAPSHOT_PATH): Snapshot {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`No nflverse snapshot at ${path}. Run \`pnpm ingest\` first.`);
  }
  return JSON.parse(raw) as Snapshot;
}
