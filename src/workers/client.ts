/**
 * Simulation client: one dedicated worker; cancellation terminates and recreates it, so a
 * cancelled computation stops immediately even inside a long synchronous loop.
 */
import type { ResultFor, SimRequest, WorkerOut } from './workerProtocol';

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CancelledError';
  }
}

export interface Job<T> {
  readonly promise: Promise<T>;
  readonly cancel: () => void;
}

type Factory = () => Worker;
const defaultFactory: Factory = () =>
  new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' });

export class SimulationClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    {
      resolve: (v: unknown) => void;
      reject: (e: unknown) => void;
      onProgress?: (d: number, t: number) => void;
    }
  >();
  constructor(private readonly factory: Factory = defaultFactory) {}

  private ensure(): Worker {
    if (!this.worker) {
      const w = this.factory();
      w.onmessage = (ev: MessageEvent<WorkerOut>) => {
        const m = ev.data;
        const p = this.pending.get(m.id);
        if (!p) return;
        if (m.type === 'progress') p.onProgress?.(m.done, m.total);
        else {
          this.pending.delete(m.id);
          if (m.type === 'result') p.resolve(m.result);
          else p.reject(new Error(m.message));
        }
      };
      w.onerror = (ev) => {
        for (const p of this.pending.values()) p.reject(new Error(ev.message || 'worker error'));
        this.pending.clear();
        this.worker?.terminate();
        this.worker = null;
      };
      this.worker = w;
    }
    return this.worker;
  }

  run<K extends SimRequest['kind']>(
    request: Extract<SimRequest, { kind: K }>,
    onProgress?: (done: number, total: number) => void,
  ): Job<ResultFor<K>> {
    const id = this.nextId++;
    const promise = new Promise<ResultFor<K>>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        ...(onProgress ? { onProgress } : {}),
      });
      this.ensure().postMessage({ id, request });
    });
    const cancel = () => {
      const p = this.pending.get(id);
      if (!p) return;
      this.pending.delete(id);
      p.reject(new CancelledError());
      // Terminate to stop the computation now; reject anything else in flight and start fresh.
      this.worker?.terminate();
      this.worker = null;
      for (const other of this.pending.values()) other.reject(new CancelledError());
      this.pending.clear();
    };
    return { promise, cancel };
  }
}

let shared: SimulationClient | null = null;
export const simulationClient = (): SimulationClient => (shared ??= new SimulationClient());
