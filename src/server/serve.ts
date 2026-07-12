import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHarnessServer, OpenAICompatibleClient, Store } from 'agent-harness';
import { createStatsStore } from '../data/store';
import { analystAgent } from './agent';
import { startAppApi } from './appApi';
import { resolveModelUrl } from './resolveModelUrl';

// The FF sidecar: one Node process running two servers —
//   1. the app's stats HTTP API (deterministic nflverse facts the browser reads for the card), and
//   2. the harness WebSocket server (the analyst agent + its research tool + consent + trace).
// You bring the model (an OpenAI-compatible endpoint). You run this process; it is not auto-started.

const token = process.env.HARNESS_TOKEN ?? 'dev-token';
const wsPort = Number(process.env.HARNESS_PORT ?? 4000);
const apiPort = Number(process.env.APP_API_PORT ?? 4100);
const dbPath = process.env.HARNESS_DB ?? 'data/harness.sqlite';

// App-owned stats store (frozen nflverse snapshot). Throws a helpful error if `pnpm ingest` hasn't run.
const stats = createStatsStore();
await startAppApi(stats, apiPort);
console.log(`app stats API:  http://127.0.0.1:${apiPort}  (season ${stats.season})`);

// Harness sidecar: analyst agent, your model, a session store.
const { baseUrl, how } = await resolveModelUrl();
const model = new OpenAICompatibleClient({
  baseUrl,
  model: process.env.MODEL_NAME ?? 'local',
  apiKey: process.env.MODEL_API_KEY,
});
mkdirSync(dirname(dbPath), { recursive: true });
const store = new Store(dbPath);
const handle = await createHarnessServer({ model, agents: [analystAgent()], token, port: wsPort, store });

console.log(`harness sidecar: ws://127.0.0.1:${handle.port}`);
console.log(`model:  ${process.env.MODEL_NAME ?? 'local'} @ ${baseUrl}  [${how}]`);
console.log(`token:  ${token}`);
