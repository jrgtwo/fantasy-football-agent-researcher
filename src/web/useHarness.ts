import { HarnessClient, type ClientToolDecl } from 'agent-harness/client';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { initialRunState, runReducer } from './runReducer';

// Dev defaults — match the sidecar's (serve.ts). Hardcoded for the probe.
const WS_URL = 'ws://127.0.0.1:4000';
const TOKEN = 'dev-token';

/** An app-side (client) tool the agent can invoke: run it against the UI, return a result/error. */
export type ToolInvokeHandler = (req: {
  runId: string;
  callId: string;
  name: string;
  args: unknown;
}) => Promise<{ result?: unknown; error?: string }>;

export interface UseHarnessOptions {
  /** Client-side tools declared to the harness on connect (handlers run in the browser). */
  clientTools?: ClientToolDecl[];
  /** Runs an invoked client tool against the UI; its outcome is sent back over the wire. */
  onToolInvoke?: ToolInvokeHandler;
}

// Owns the harness client connection and feeds its event stream into the runReducer. Exposes an
// evaluate(prompt) that starts a run and decideConsent(allow) for the Approve/Deny prompt. When
// clientTools + onToolInvoke are given, it also services the agent's callbacks into the UI.
export function useHarness(options: UseHarnessOptions = {}) {
  const [run, dispatch] = useReducer(runReducer, initialRunState);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<HarnessClient | null>(null);
  const runIdRef = useRef<string>('');
  // Kept fresh every render so the once-constructed client always calls the latest handler
  // (avoids a stale closure over App's state setters).
  const onToolInvokeRef = useRef<ToolInvokeHandler | undefined>(options.onToolInvoke);
  onToolInvokeRef.current = options.onToolInvoke;
  const clientToolsRef = useRef<ClientToolDecl[] | undefined>(options.clientTools);

  useEffect(() => {
    const client = new HarnessClient(WS_URL, TOKEN, {
      clientTools: clientToolsRef.current,
      handlers: {
        onEvent: (runId, event) => dispatch({ type: 'event', runId, event }),
        onError: (err) =>
          dispatch({
            type: 'event',
            runId: runIdRef.current,
            event: { type: 'run.error', runId: runIdRef.current, error: `${err.code}: ${err.message}` },
          }),
        onToolInvoke: (req) => {
          const handler = onToolInvokeRef.current;
          if (!handler) {
            client.respondTool(req.runId, req.callId, undefined, `no handler for client tool "${req.name}"`);
            return;
          }
          handler(req)
            .then((r) => client.respondTool(req.runId, req.callId, r.result, r.error))
            .catch((e: unknown) =>
              client.respondTool(req.runId, req.callId, undefined, e instanceof Error ? e.message : String(e)),
            );
        },
      },
    });
    clientRef.current = client;
    client
      .connect()
      .then(() => setConnected(true))
      .catch(() => setConnected(false));
    return () => client.close();
  }, []);

  const evaluate = useCallback((prompt: string) => {
    if (!clientRef.current) return;
    dispatch({ type: 'reset' });
    runIdRef.current = clientRef.current.startRun(prompt, { agent: 'analyst' });
  }, []);

  const decideConsent = useCallback(
    (allow: boolean) => {
      if (run.consent && clientRef.current) {
        clientRef.current.decideConsent(run.consent.runId, run.consent.callId, allow);
      }
    },
    [run.consent],
  );

  return { run, connected, evaluate, decideConsent };
}
