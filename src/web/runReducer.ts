import type { AgentEvent } from 'agent-harness/client';

export interface TraceLine {
  kind: string;
  text: string;
}

export interface ConsentPrompt {
  runId: string;
  callId: string;
  name: string;
  args: unknown;
}

export interface RunState {
  status: 'idle' | 'running' | 'done' | 'error';
  answer: string;
  thinking: string;
  result: unknown;
  trace: TraceLine[];
  consent: ConsentPrompt | null;
  error: string | null;
}

export const initialRunState: RunState = {
  status: 'idle',
  answer: '',
  thinking: '',
  result: null,
  trace: [],
  consent: null,
  error: null,
};

export type RunAction = { type: 'reset' } | { type: 'event'; runId: string; event: AgentEvent };

const short = (v: unknown): string => {
  const s = JSON.stringify(v);
  return s.length > 80 ? s.slice(0, 80) + '…' : s;
};

// Folds one run's event stream into render state. Shared by the single-run reducer and each
// per-player run in the rankings fan-out.
export function foldRunEvent(state: RunState, runId: string, e: AgentEvent): RunState {
  const push = (kind: string, text: string): RunState => ({ ...state, trace: [...state.trace, { kind, text }] });
  switch (e.type) {
    case 'run.started':
      return { ...state, status: 'running' };
    case 'token':
      return { ...state, answer: state.answer + e.text };
    case 'thinking':
      return { ...state, thinking: state.thinking + e.text };
    case 'tool.requested':
      return push('tool', `▸ ${e.name}(${short(e.args)})`);
    case 'consent.requested':
      return { ...state, consent: { runId, callId: e.callId, name: e.name, args: e.args } };
    case 'consent.decided':
      return { ...state, consent: null, trace: [...state.trace, { kind: 'consent', text: `consent ${e.allow ? 'approved' : 'denied'}` }] };
    case 'tool.started':
      return push('tool', `… ${e.name} running`);
    case 'tool.finished':
      return push('tool', e.ok ? `→ ${e.name} ok (${e.ms}ms)` : `→ ${e.name} error: ${e.error}`);
    case 'context.compacted':
      return push('ctx', `summarized ${e.summarized} older messages`);
    case 'run.finished':
      return { ...state, status: 'done', result: e.result };
    case 'run.error':
      return { ...state, status: 'error', error: e.error };
    default:
      // model.call.started/finished are not shown in v1's bare-bones trace.
      return state;
  }
}

export function runReducer(state: RunState, action: RunAction): RunState {
  if (action.type === 'reset') return initialRunState;
  return foldRunEvent(state, action.runId, action.event);
}
