import { useState } from 'react';
import { useScenario } from '../state/scenarioStore';
import { useSimulation } from '../hooks/useSimulation';
import { ScenarioControls } from '../components/ScenarioControls';
import { RunStatus } from '../components/RunStatus';
import { ChartCard } from '../components/charts/ChartCard';
import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/core';
import { PageHeader } from '../components/PageHeader';
import { fmt, pct, signedPct } from '../lib/format';
import { POLICY_INFO, type ActiveScheme } from '../economics/policies/registry';
import type { ParameterRange } from '../economics/simulation/monteCarlo';

const ADOPTIONS = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45];
// Documented sensitivity ranges (src/data/cyprus2026.json) and the β range spanning both calibrations.
const RANGES: ParameterRange[] = [
  { key: 'elasticityKL', low: 0.5, high: 1.2 },
  { key: 'elasticityAuto', low: 1, high: 3 },
  { key: 'deltaD', low: 0.1, high: 0.33 },
  { key: 'beta', low: 0.922, high: 0.99 },
];

function MonteCarloTab() {
  const s = useScenario((x) => x.current);
  const [scheme, setScheme] = useState<ActiveScheme>('robotSS');
  const [draws, setDraws] = useState(100);
  const [seed, setSeed] = useState(20261119);
  const { state, run, cancel } = useSimulation<'monteCarlo'>();
  const r = state.status === 'done' ? state.result : null;
  const band = (
    rows: typeof r extends null ? never : NonNullable<typeof r>['ssToY'],
    scale: number,
    label: string,
  ) => {
    const ok = rows.filter((b) => b.p50 !== null);
    return [
      {
        type: 'scatter' as const,
        mode: 'lines' as const,
        x: ok.map((b) => b.adoption),
        y: ok.map((b) => (b.p90 ?? NaN) * scale),
        line: { width: 0 },
        showlegend: false,
        hoverinfo: 'skip' as const,
      },
      {
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: `${label} P10–P90`,
        x: ok.map((b) => b.adoption),
        y: ok.map((b) => (b.p10 ?? NaN) * scale),
        fill: 'tonexty' as const,
        line: { width: 0 },
        fillcolor: 'rgba(15,118,110,0.2)',
      },
      {
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: `${label} median`,
        x: ok.map((b) => b.adoption),
        y: ok.map((b) => (b.p50 ?? NaN) * scale),
        line: { color: '#0f766e' },
      },
    ];
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <Card>
        <CardHeader
          title="Uncertainty settings"
          subtitle="Uniform draws over the documented assumption ranges"
        />
        <CardBody className="space-y-4">
          <ul className="text-xs text-slate-600 dark:text-slate-400">
            {RANGES.map((r) => (
              <li key={r.key}>
                {r.key}: {r.low}–{r.high}
              </li>
            ))}
          </ul>
          <Select
            id="mcScheme"
            label="Instrument"
            value={scheme}
            onChange={setScheme}
            options={(
              ['robotIncome', 'robotInvestment', 'robotSS', 'valueAdded', 'capitalReturnLevy'] as const
            ).map((k) => ({ value: k, label: `${POLICY_INFO[k].code}: ${POLICY_INFO[k].label}` }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="draws" className="text-xs font-medium">
                Draws (1–2000)
              </label>
              <input
                id="draws"
                type="number"
                min={1}
                max={2000}
                value={draws}
                onChange={(e) => setDraws(Math.max(1, Math.min(2000, Number(e.target.value))))}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="seed" className="text-xs font-medium">
                Random seed
              </label>
              <input
                id="seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>
          {draws > 500 && (
            <Callout tone="warn">
              Large runs can take a minute in the browser. You can cancel at any time.
            </Callout>
          )}
          <RunStatus
            state={state}
            onCancel={cancel}
            onRun={() =>
              run({
                kind: 'monteCarlo',
                scenario: s,
                ranges: RANGES,
                adoptions: ADOPTIONS,
                scheme,
                draws,
                seed,
              })
            }
            label="Run Monte Carlo"
          />
        </CardBody>
      </Card>
      <div className="min-w-0 space-y-6">
        {r && (
          <>
            <ChartCard
              title="SS contributions / output without new instruments: uncertainty band"
              kind="simulated"
              units="% of output"
              baseline="Each draw re-solves (and, for Cyprus, recalibrates) the model"
              scenario={`${s.preset === 'cyprus' ? 'Cyprus 2026' : 'Paper'}, Tech ${s.technology}; ${r.draws} draws, seed ${r.seed}`}
              source="Monte Carlo over explicit uniform parameter ranges; empirical quantiles"
              interpretation="The band shows how much the result moves across the stated assumption ranges. It does not cover model uncertainty."
              warnings={[
                `Draws without a steady state at an adoption level are counted, not interpolated (max failed: ${Math.max(...r.ssToY.map((b) => b.failed))}).`,
              ]}
              data={band(r.ssToY, 100, 'SS/Y')}
              layout={{
                xaxis: { title: { text: 'Adoption parameter' } },
                yaxis: { title: { text: '% of output' }, rangemode: 'tozero' },
              }}
              csvRows={r.ssToY.map((b) => ({ ...b }))}
            />
            <ChartCard
              title={`Required rate of ${POLICY_INFO[scheme].code}: uncertainty band`}
              kind="simulated"
              units="rate (fraction of the instrument's base)"
              baseline="Rate restoring each draw's own zero-adoption SS/Y"
              scenario={`${r.draws} draws, seed ${r.seed}`}
              source="Monte Carlo; bracketed root search per draw"
              interpretation="Wider bands mean the required rate depends strongly on uncertain structural parameters."
              data={band(r.requiredRate, 1, 'Rate')}
              layout={{
                xaxis: { title: { text: 'Adoption parameter' } },
                yaxis: { title: { text: 'Rate' } },
              }}
              csvRows={r.requiredRate.map((b) => ({ ...b }))}
            />
          </>
        )}
        {state.status === 'cancelled' && (
          <Callout>Monte Carlo cancelled; no partial results are displayed.</Callout>
        )}
      </div>
    </div>
  );
}

function ValueAddedTab() {
  const s = useScenario((x) => x.current);
  const { state, run, cancel } = useSimulation<'sensitivity'>();
  const r = state.status === 'done' ? state.result : null;
  const pair = (code: string) => ({
    lr: r?.longRun.find((x) => x.code === code),
    sr: r?.shortRun.find((x) => x.code === code),
  });
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Policy E and capital mobility: where does the ranking change?"
          subtitle="Scenario calculations the representative-firm model cannot represent structurally"
        />
        <CardBody className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <ScenarioControls />
          <div className="space-y-3">
            <Callout>
              Coverage factors are not a behavioural model. Firm heterogeneity, SMEs, margins and avoidance
              are covered by separate SBS-cell and company-level calculations.
            </Callout>
            <RunStatus
              state={state}
              onCancel={cancel}
              onRun={() => run({ kind: 'sensitivity', scenario: s })}
              label="Run sensitivity analysis"
            />
          </div>
        </CardBody>
      </Card>
      {r && (
        <>
          <Card>
            <CardHeader
              title="Long run vs short run with capital fixed"
              subtitle="Welfare cost per € raised (lower is better)"
            />
            <CardBody>
              <DataTable
                caption="Capital mobility"
                columns={[
                  { key: 'code', label: '' },
                  { key: 'name', label: 'Instrument' },
                  { key: 'lr', label: 'Long run (elastic capital)', align: 'right' },
                  { key: 'sr', label: 'Short run (capital fixed)', align: 'right' },
                  { key: 'dl', label: 'Working time, short run', align: 'right' },
                ]}
                rows={['B', 'C', 'D', 'E', 'G′'].map((c) => {
                  const p = pair(c);
                  return {
                    code: c,
                    name: p.lr && p.lr.scheme !== 'none' ? POLICY_INFO[p.lr.scheme].label : '',
                    lr: fmt(p.lr?.costPerRevenue, 3),
                    sr: fmt(p.sr?.costPerRevenue, 3),
                    dl: signedPct(p.sr?.dL),
                  };
                })}
              />
              <p className="mt-3 text-sm">
                With capital fixed, taxes on capital or robots fall on a fixed factor and barely distort,
                while E still reduces working time. <strong>E's long-run advantage reverses</strong> when
                capital is immobile.
              </p>
            </CardBody>
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="E coverage (long run)" />
              <CardBody>
                <DataTable
                  caption="Coverage sweep"
                  dense
                  columns={[
                    { key: 'c', label: 'Coverage' },
                    { key: 'r', label: 'Rate', align: 'right' },
                    { key: 'k', label: 'Cost per €', align: 'right' },
                  ]}
                  rows={r.coverage.map((x) => ({
                    c: pct(x.coverage, 0),
                    r: fmt(x.rate, 4),
                    k: fmt(x.costPerRevenue, 4),
                  }))}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Identical cost per € at any coverage: coverage only rescales the statutory rate in a
                  representative-firm model.
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Structural parameters (long run)" />
              <CardBody>
                <p className="text-sm">
                  E ranked first in {r.structural.filter((x) => x.eRank === 1).length} of{' '}
                  {r.structural.filter((x) => x.eRank !== null).length} solvable points (ε<sub>KL</sub>{' '}
                  0.5–1.1, σ 1.5–3, two adoption levels).
                </p>
                <DataTable
                  caption="Structural sweep"
                  dense
                  columns={[
                    { key: 'l', label: 'Point' },
                    { key: 'b', label: 'Best' },
                    { key: 'e', label: 'E rank', align: 'right' },
                  ]}
                  rows={r.structural.map((x) => ({ l: x.label, b: x.bestScheme ?? '—', e: x.eRank ?? '—' }))}
                />
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader
              title="Sectors, SMEs and low margins (Eurostat SBS 2024, business economy only)"
              subtitle="Scenario calculation, not a revenue estimate"
            />
            <CardBody className="space-y-4">
              <DataTable
                caption="SME exemption coverage"
                dense
                columns={[
                  { key: 't', label: 'Exempt firms below' },
                  { key: 'c', label: 'Liable share of SBS value added', align: 'right' },
                ]}
                rows={r.smeCoverage.map((x) => ({
                  t:
                    x.threshold === '0-9'
                      ? 'no exemption'
                      : x.threshold.replace('GE250', '250').replace(/-.*/, '') + ' employees',
                  c: pct(x.coverage),
                }))}
              />
              <DataTable
                caption="Sector exposure"
                dense
                columns={[
                  { key: 'n', label: 'NACE' },
                  { key: 'ls', label: 'Labour share', align: 'right' },
                  { key: 'gos', label: 'GOS / VA', align: 'right' },
                  { key: 'e', label: 'E (2.5%) as % of operating surplus', align: 'right' },
                  { key: 'f', label: 'F at 50%' },
                  { key: 'note', label: 'Note' },
                ]}
                rows={r.sectors.map((x) => ({
                  n: x.nace,
                  ls: pct(x.labourShare),
                  gos: pct(x.gosShare),
                  e: pct(x.eShareOfGos),
                  f: x.fGeneric,
                  note: x.note,
                }))}
              />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

export default function Sensitivity() {
  return (
    <>
      <PageHeader
        title="Sensitivity and uncertainty"
        lead="Which assumptions drive the results? Uncertainty bands come from explicit parameter distributions with a reproducible seed. They are not decorative ranges."
      />
      <Tabs defaultValue="mc">
        <TabsList aria-label="Sensitivity analyses">
          <TabsTrigger value="mc">Monte Carlo bands</TabsTrigger>
          <TabsTrigger value="e">Policy E and capital mobility</TabsTrigger>
        </TabsList>
        <TabsContent value="mc" className="mt-4">
          <MonteCarloTab />
        </TabsContent>
        <TabsContent value="e" className="mt-4">
          <ValueAddedTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
