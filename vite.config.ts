import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The UI dev server. The app's own stats HTTP API (the sidecar) is proxied under /api so the
// browser avoids CORS; the harness WebSocket is connected to directly (see the UI).
// `agent-harness` is excluded from dep pre-bundling so live edits to the linked package are picked
// up without a stale Vite cache.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4100',
    },
  },
  optimizeDeps: {
    exclude: ['agent-harness'],
  },
});
