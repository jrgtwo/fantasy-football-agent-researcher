import type { AgentEvent } from 'agent-harness/client';
import { describe, expect, it } from 'vitest';
import { foldRunEvent, initialRunState, runReducer } from './runReducer';

const ev = (event: AgentEvent) => ({ type: 'event' as const, runId: 'r1', event });

describe('runReducer', () => {
  it('appends token text to the answer', () => {
    let s = runReducer(initialRunState, ev({ type: 'token', runId: 'r1', text: 'Start ' }));
    s = runReducer(s, ev({ type: 'token', runId: 'r1', text: 'him.' }));
    expect(s.answer).toBe('Start him.');
  });

  it('sets a consent prompt on consent.requested, clears it on consent.decided', () => {
    let s = runReducer(
      initialRunState,
      ev({ type: 'consent.requested', runId: 'r1', callId: 'c1', name: 'fetch_url', args: { url: 'x' } }),
    );
    expect(s.consent).toEqual({ runId: 'r1', callId: 'c1', name: 'fetch_url', args: { url: 'x' } });
    s = runReducer(s, ev({ type: 'consent.decided', runId: 'r1', callId: 'c1', allow: true }));
    expect(s.consent).toBeNull();
  });

  it('records a trace line when a tool finishes', () => {
    const s = runReducer(
      initialRunState,
      ev({ type: 'tool.finished', runId: 'r1', callId: 'c1', name: 'fetch_url', ok: true, result: { status: 200 }, ms: 12 }),
    );
    expect(s.trace.some((l) => l.text.includes('fetch_url'))).toBe(true);
  });

  it('captures run errors', () => {
    const s = runReducer(initialRunState, ev({ type: 'run.error', runId: 'r1', error: 'boom' }));
    expect(s.status).toBe('error');
    expect(s.error).toBe('boom');
  });

  it('accumulates thinking text separately from the answer', () => {
    let s = runReducer(initialRunState, ev({ type: 'thinking', runId: 'r1', text: 'let me ' }));
    s = runReducer(s, ev({ type: 'thinking', runId: 'r1', text: 'think.' }));
    expect(s.thinking).toBe('let me think.');
    expect(s.answer).toBe('');
  });

  it('stores the final result on run.finished', () => {
    const s = runReducer(initialRunState, ev({ type: 'run.finished', runId: 'r1', result: 'the verdict' }));
    expect(s.status).toBe('done');
    expect(s.result).toBe('the verdict');
  });

  it('reset returns to the initial state', () => {
    const dirty = runReducer(initialRunState, ev({ type: 'token', runId: 'r1', text: 'x' }));
    expect(runReducer(dirty, { type: 'reset' })).toEqual(initialRunState);
  });
});

describe('foldRunEvent', () => {
  it('folds a token event directly (no action wrapper)', () => {
    const s = foldRunEvent(initialRunState, 'rX', { type: 'token', runId: 'rX', text: 'hi' });
    expect(s.answer).toBe('hi');
  });

  it('records the runId on a consent prompt', () => {
    const s = foldRunEvent(initialRunState, 'rX', {
      type: 'consent.requested', runId: 'rX', callId: 'c9', name: 'web_search', args: {},
    });
    expect(s.consent).toEqual({ runId: 'rX', callId: 'c9', name: 'web_search', args: {} });
  });
});
