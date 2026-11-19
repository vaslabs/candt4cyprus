import { Copy, Download, RotateCcw, Save, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useScenario } from '../state/scenarioStore';
import { downloadText, slug } from '../lib/download';
import { Button } from './ui/core';

/** Scenario name, save / duplicate / import / export, and reset to the immutable presets. */
export function ScenarioBar() {
  const s = useScenario();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label htmlFor="scenario-name" className="sr-only">
        Scenario name
      </label>
      <input
        id="scenario-name"
        value={s.current.name}
        onChange={(e) => s.update({ name: e.target.value })}
        className="h-8 min-w-0 flex-1 basis-full rounded-md border border-transparent bg-transparent px-2 text-sm font-medium hover:border-slate-300 focus:border-slate-300 sm:basis-auto sm:max-w-xs dark:hover:border-slate-700"
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => (s.save(), setMsg('Saved in this browser.'))}
        aria-label="Save scenario"
      >
        <Save className="h-4 w-4" aria-hidden />
        <span className="hidden md:inline">Save</span>
      </Button>
      <Button size="sm" variant="ghost" onClick={() => s.duplicate()} aria-label="Duplicate scenario">
        <Copy className="h-4 w-4" aria-hidden />
        <span className="hidden md:inline">Duplicate</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          downloadText(`${slug(s.current.name)}.scenario.json`, s.exportJson(), 'application/json')
        }
        aria-label="Export scenario as JSON"
        data-testid="export"
      >
        <Download className="h-4 w-4" aria-hidden />
        <span className="hidden md:inline">Export</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => file.current?.click()}
        aria-label="Import scenario from JSON"
      >
        <Upload className="h-4 w-4" aria-hidden />
        <span className="hidden md:inline">Import</span>
      </Button>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        className="hidden"
        data-testid="import-file"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const r = s.importJson(await f.text());
          setMsg(r.ok ? `Imported “${useScenario.getState().current.name}”.` : `Import failed: ${r.error}`);
          e.target.value = '';
        }}
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => s.resetTo('cyprus')}
        aria-label="Reset to Cyprus 2026 defaults"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        <span className="hidden lg:inline">Cyprus</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => s.resetTo('paper')}
        aria-label="Reset to original paper values"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        <span className="hidden lg:inline">Paper</span>
      </Button>
      <span
        role="status"
        aria-live="polite"
        className="w-full truncate text-xs text-slate-500 empty:hidden sm:w-auto"
        data-testid="scenario-msg"
      >
        {msg}
      </span>
    </div>
  );
}
