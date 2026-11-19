/**
 * Plotly wrapper. plotly.js is loaded lazily (code-split) the first time a chart renders, so the
 * first page does not pay for the charting library.
 */
import { useEffect, useRef, useState } from 'react';
import type { Data, Layout } from 'plotly.js-basic-dist-min';
import { resolvedDark, useSettings } from '../../state/settingsStore';

type PlotlyModule = typeof import('plotly.js-basic-dist-min');
let plotlyPromise: Promise<PlotlyModule> | null = null;
export const loadPlotly = (): Promise<PlotlyModule> =>
  (plotlyPromise ??= import('plotly.js-basic-dist-min').then((m) => {
    // The UMD bundle may arrive as a default export or as the namespace itself.
    const mod = m as unknown as { default?: PlotlyModule } & PlotlyModule;
    return mod.default ?? mod;
  }));

export interface PlotProps {
  readonly data: Data[];
  readonly layout?: Partial<Layout>;
  readonly height?: number;
  readonly ariaLabel: string;
  readonly onReady?: (el: HTMLDivElement) => void;
}

export function Plot({ data, layout, height = 340, ariaLabel, onReady }: PlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useSettings((s) => s.theme);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const el = ref.current;
    if (!el) return;
    const dark = resolvedDark(theme);
    const fg = dark ? '#e2e8f0' : '#0f172a';
    const grid = dark ? '#334155' : '#e2e8f0';
    loadPlotly()
      .then((Plotly) => {
        if (!alive) return;
        return Plotly.react(
          el,
          data,
          {
            autosize: true,
            height,
            margin: { l: 56, r: 16, t: 24, b: 48 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { family: 'system-ui, sans-serif', size: 12, color: fg },
            // Legend above the plot so it can never collide with the x-axis title on narrow screens.
            legend: { orientation: 'h', x: 0, xanchor: 'left', y: 1.02, yanchor: 'bottom' },
            ...layout,
            xaxis: { gridcolor: grid, zeroline: false, automargin: true, ...layout?.xaxis },
            yaxis: { gridcolor: grid, zeroline: false, automargin: true, ...layout?.yaxis },
          },
          { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] },
        );
      })
      .then(() => alive && el && onReady?.(el))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [data, layout, height, theme, onReady]);
  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el) void loadPlotly().then((P) => P.purge(el));
    };
  }, []);
  return (
    <figure aria-label={ariaLabel} className="w-full">
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          Chart failed to render: {error}
        </p>
      ) : (
        <div ref={ref} style={{ minHeight: height }} data-testid="plot" />
      )}
    </figure>
  );
}
