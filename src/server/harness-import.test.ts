import { describe, expect, it } from 'vitest';
import * as harness from 'agent-harness';

// Proves the `file:` link to agent-harness resolves under Node/tsx (the sidecar's runtime) and
// exposes the surface FF's sidecar needs.
describe('agent-harness link (server side)', () => {
  it('exposes the sidecar + client surface', () => {
    expect(typeof harness.createHarnessServer).toBe('function');
    expect(typeof harness.HarnessClient).toBe('function');
    expect(typeof harness.OpenAICompatibleClient).toBe('function');
    expect(typeof harness.ToolRegistry).toBe('function');
    expect(typeof harness.Store).toBe('function');
  });
});
