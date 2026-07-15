import { createServer, type Server } from 'node:http';
import { topByPosition } from '../data/query';
import type { StatsStore } from '../data/store';

export interface ApiResponse {
  status: number;
  body: unknown;
}

// The app's own stats HTTP API — deterministic facts the browser reads directly (the card), separate
// from the harness WebSocket. Pure request→response so it's unit-testable; startAppApi binds it to a
// Node http server. Tolerates an optional `/api` prefix (the Vite dev proxy forwards it).
export function handleApiRequest(method: string, url: string, store: StatsStore): ApiResponse {
  if (method !== 'GET') return { status: 405, body: { error: 'method not allowed' } };

  const parsed = new URL(url, 'http://localhost');
  const path = parsed.pathname.replace(/^\/api/, '');

  if (path === '/players') {
    const q = parsed.searchParams.get('q') ?? '';
    return { status: 200, body: store.search(q) };
  }

  const statsMatch = path.match(/^\/players\/([^/]+)\/stats$/);
  if (statsMatch) {
    const id = decodeURIComponent(statsMatch[1]!);
    const stats = store.stats(id);
    if (!stats) return { status: 404, body: { error: 'no stats for player' } };
    return { status: 200, body: stats };
  }

  if (path === '/rankings/candidates') {
    const position = parsed.searchParams.get('position');
    if (!position) return { status: 400, body: { error: 'position required' } };
    const nRaw = Number(parsed.searchParams.get('n') || '8');
    const n = Math.min(12, Math.max(1, Number.isFinite(nRaw) ? nRaw : 8));
    return { status: 200, body: topByPosition(store.allPlayers(), store.allStats(), position, n) };
  }

  return { status: 404, body: { error: 'not found' } };
}

// Thin Node http binding around the (tested) request handler. Resolves once listening.
export function startAppApi(store: StatsStore, port: number, host = '127.0.0.1'): Promise<Server> {
  const server = createServer((req, res) => {
    const { status, body } = handleApiRequest(req.method ?? 'GET', req.url ?? '/', store);
    res.writeHead(status, {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
    });
    // Trailing newline so curl output doesn't collide with the shell prompt.
    res.end(JSON.stringify(body) + '\n');
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}
