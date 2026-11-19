/**
 * Every chart states units, baseline, scenario, source/method, interpretation and warnings
 * (prompt PART 5), and offers PNG and CSV downloads.
 */
import { Download, FileSpreadsheet } from 'lucide-react';
import { useCallback, useRef, type ReactNode } from 'react';
import type { Data, Layout } from 'plotly.js-basic-dist-min';
import { Button, Card, CardBody, CardHeader } from '../ui/core';
import { ProvenanceBadge, type Provenance } from '../provenance/ProvenanceBadge';
import { Plot, loadPlotly } from './Plot';
import { downloadText, slug, toCsv, type CsvValue } from '../../lib/download';

export interface ChartCardProps {
  readonly title: string;
  readonly kind: Provenance;
  readonly units: string;
  readonly baseline: string;
  readonly scenario: string;
  readonly source: string;
  readonly interpretation: ReactNode;
  readonly warnings?: readonly string[];
  readonly data: Data[];
  readonly layout?: Partial<Layout>;
  readonly csvRows: readonly Record<string, CsvValue>[];
  readonly height?: number;
}

export function ChartCard(props: ChartCardProps) {
  const el = useRef<HTMLDivElement | null>(null);
  const onReady = useCallback((d: HTMLDivElement) => (el.current = d), []);
  const png = async () => {
    if (!el.current) return;
    const Plotly = await loadPlotly();
    await Plotly.downloadImage(el.current, {
      format: 'png',
      filename: slug(props.title),
      width: 1200,
      height: 700,
    });
  };
  return (
    <Card>
      <CardHeader
        title={props.title}
        subtitle={
          <>
            <span className="font-medium">Units:</span> {props.units} ·{' '}
            <span className="font-medium">Scenario:</span> {props.scenario}
          </>
        }
        actions={
          <>
            <ProvenanceBadge kind={props.kind} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void png()}
              aria-label={`Download ${props.title} as PNG`}
            >
              <Download className="h-4 w-4" aria-hidden /> PNG
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadText(`${slug(props.title)}.csv`, toCsv(props.csvRows), 'text/csv')}
              aria-label={`Download data for ${props.title} as CSV`}
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden /> CSV
            </Button>
          </>
        }
      />
      <CardBody>
        <Plot
          data={props.data}
          {...(props.layout ? { layout: props.layout } : {})}
          ariaLabel={props.title}
          height={props.height ?? 340}
          onReady={onReady}
        />
        <dl className="mt-3 grid gap-1 text-xs text-slate-600 dark:text-slate-400">
          <div>
            <dt className="inline font-semibold">Baseline: </dt>
            <dd className="inline">{props.baseline}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Source / method: </dt>
            <dd className="inline">{props.source}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">How to read it: </dt>
            <dd className="inline">{props.interpretation}</dd>
          </div>
          {props.warnings?.map((w) => (
            <div key={w} className="text-amber-800 dark:text-amber-300">
              <dt className="inline font-semibold">Caution: </dt>
              <dd className="inline">{w}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}
