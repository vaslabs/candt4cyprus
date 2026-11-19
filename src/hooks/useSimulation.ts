import { useCallback, useEffect, useRef, useState } from 'react';
import { CancelledError, simulationClient, type Job } from '../workers/client';
import type { ResultFor, SimRequest } from '../workers/workerProtocol';

export type SimState<T> =
  | { readonly status: 'idle'; readonly result: null }
  | {
      readonly status: 'running';
      readonly result: null;
      readonly progress: { done: number; total: number } | null;
    }
  | { readonly status: 'done'; readonly result: T; readonly at: number }
  | { readonly status: 'error'; readonly result: null; readonly message: string }
  | { readonly status: 'cancelled'; readonly result: null };

/**
 * Run a worker request explicitly (no recomputation on every slider move). Starting a new run
 * cancels the previous one; a failed or cancelled run never leaves stale results on screen.
 */
export function useSimulation<K extends SimRequest['kind']>() {
  const [state, setState] = useState<SimState<ResultFor<K>>>({ status: 'idle', result: null });
  const job = useRef<Job<ResultFor<K>> | null>(null);
  const run = useCallback((request: Extract<SimRequest, { kind: K }>) => {
    job.current?.cancel();
    setState({ status: 'running', result: null, progress: null });
    const j = simulationClient().run(request, (done, total) =>
      setState({ status: 'running', result: null, progress: { done, total } }),
    );
    job.current = j;
    j.promise.then(
      (result) => {
        if (job.current === j) setState({ status: 'done', result, at: Date.now() });
      },
      (e: unknown) => {
        if (job.current !== j) return;
        setState(
          e instanceof CancelledError
            ? { status: 'cancelled', result: null }
            : { status: 'error', result: null, message: e instanceof Error ? e.message : String(e) },
        );
      },
    );
  }, []);
  const cancel = useCallback(() => job.current?.cancel(), []);
  useEffect(() => () => job.current?.cancel(), []);
  return { state, run, cancel };
}
