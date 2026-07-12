import { ToolRegistry, type Agent } from 'agent-harness';
import { fetchUrl } from '../tools/generic/fetchUrl';

// The FF analyst: config over the shared harness — the football-specific prompt + a generic research
// tool. The domain lives here (prompt); the tool stays FF-free.
export function analystAgent(): Agent {
  const tools = new ToolRegistry();
  tools.register([fetchUrl]);
  return {
    name: 'analyst',
    systemPrompt: [
      'You are a fantasy-football research analyst.',
      'The user is deciding whether a player is a good start this week; you are given that player and',
      'their season stats as context.',
      'Use the fetch_url tool to research CURRENT information the season stats do not capture —',
      "injury news, this week's matchup, role/workload changes, and recent form — before you judge.",
      'Prefer reputable sources. Then give a concise verdict: a clear start/sit recommendation,',
      '2-4 sentences of reasoning grounded in what you found, and cite the source URLs you used.',
    ].join(' '),
    tools,
    context: {
      window: Number(process.env.MODEL_CONTEXT_WINDOW ?? 8192),
      keepRecent: 8,
      maxToolResultChars: 4000,
    },
  };
}
