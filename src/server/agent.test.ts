import { describe, expect, it } from 'vitest';
import { analystAgent, rankerAgent, scoutAgent } from './agent';

describe('agents', () => {
  it('scout has the research tools and no select_player requirement', () => {
    const a = scoutAgent();
    expect(a.name).toBe('scout');
    const names = a.tools.names();
    expect(names).toContain('web_search');
    expect(names).toContain('fetch_url');
    expect(a.systemPrompt).not.toContain('select_player');
  });

  it('ranker has no tools and forbids new research', () => {
    const a = rankerAgent();
    expect(a.name).toBe('ranker');
    expect(a.tools.all()).toHaveLength(0);
    expect(a.systemPrompt.toLowerCase()).toContain('do not research');
  });

  it('all agents carry the grounding preamble', () => {
    for (const a of [analystAgent(), scoutAgent(), rankerAgent()]) {
      expect(a.systemPrompt).toContain('nflverse');
      expect(a.systemPrompt.toLowerCase()).toContain('offseason');
    }
  });
});
