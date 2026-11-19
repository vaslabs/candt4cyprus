/// <reference lib="webworker" />
import { handle } from './handlers';
import type { WorkerIn, WorkerOut } from './workerProtocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: WorkerOut) => ctx.postMessage(m);

ctx.onmessage = (ev: MessageEvent<WorkerIn>) => {
  const { id, request } = ev.data;
  try {
    let last = 0;
    const result = handle(request, {
      progress: (done, total) => {
        const now = Date.now();
        if (now - last > 50 || done === total) {
          last = now;
          post({ id, type: 'progress', done, total });
        }
      },
    });
    post({ id, type: 'result', result });
  } catch (e) {
    post({ id, type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
};
