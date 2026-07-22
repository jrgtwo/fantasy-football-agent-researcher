import react from '@vitejs/plugin-react';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Bust the browser's cache of the linked harness whenever it's rebuilt — active solo dev, no users.
//
// Vite serves the harness under an immutable `?v=<hash>` URL. That hash is derived from the Vite config
// (among other things) and normally never moves for a `file:` dep pinned at 0.0.0 — so the browser
// caches an old harness build forever and never re-fetches. We make the hash track the built harness by
// stamping a no-op plugin's name with the file's mtime: rebuild the harness (and `install --force` so
// FF's copy updates) → mtime changes → config hash changes → Vite's `?v=` changes → the browser fetches
// fresh, through Vite's NORMAL dep serving. No URL rewriting, no extra query, no 504s.
function harnessBuildStamp(): string {
  try {
    const file = fileURLToPath(new URL('./node_modules/agent-harness/dist/client.js', import.meta.url));
    return String(Math.floor(statSync(file).mtimeMs));
  } catch {
    return 'unbuilt';
  }
}

// The UI dev server. The app's own stats HTTP API (the sidecar) is proxied under /api so the
// browser avoids CORS; the harness WebSocket is connected to directly (see the UI).
// `agent-harness` is excluded from dep pre-bundling so live edits to the linked package are picked
// up without a stale Vite cache.
export default defineConfig({
  plugins: [{ name: `harness-build-stamp:${harnessBuildStamp()}` }, react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4100',
    },
  },
  optimizeDeps: {
    exclude: ['agent-harness'],
  },
});
