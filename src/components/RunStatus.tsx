import { Loader2, Play, Square } from 'lucide-react';
import type { SimState } from '../hooks/useSimulation';
import { Button, Callout } from './ui/core';

/** Run / cancel controls with live status (announced to screen readers). */
export function RunStatus({
  state,
  onRun,
  onCancel,
  label = 'Run simulation',
}: {
  state: SimState<unknown>;
  onRun: () => void;
  onCancel: () => void;
  label?: string;
}) {
  const running = state.status === 'running';
  const prog = running && state.progress ? ` (${state.progress.done}/${state.progress.total})` : '';
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onRun} disabled={running} data-testid="run">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
          {label}
        </Button>
        {running && (
          <Button variant="outline" onClick={onCancel} data-testid="cancel">
            <Square className="h-4 w-4" aria-hidden /> Cancel
          </Button>
        )}
        <span
          role="status"
          aria-live="polite"
          className="text-sm text-slate-600 dark:text-slate-400"
          data-testid="run-status"
        >
          {state.status === 'idle' && 'Not run yet. Adjust the settings, then run.'}
          {running && `Computing in a background worker${prog}…`}
          {state.status === 'done' && `Done at ${new Date(state.at).toLocaleTimeString()}.`}
          {state.status === 'cancelled' && 'Cancelled. No results shown.'}
          {state.status === 'error' && 'Failed. No results shown.'}
        </span>
      </div>
      {state.status === 'error' && (
        <Callout tone="error" title="The computation failed">
          {state.message}
        </Callout>
      )}
    </div>
  );
}
