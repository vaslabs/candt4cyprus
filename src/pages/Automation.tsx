import { useScenario } from '../state/scenarioStore';
import { useSimulation } from '../hooks/useSimulation';
import { ScenarioControls } from '../components/ScenarioControls';
import { RunStatus } from '../components/RunStatus';
import { ChartCard } from '../components/charts/ChartCard';
import { Callout, Card, CardBody, CardHeader } from '../components/ui/core';
import { ProvenanceBadge } from '../components/provenance/ProvenanceBadge';
import { PageHeader } from '../components/PageHeader';
import { fmt, pct } from '../lib/format';

const GRID = Array.from({ length: 50 }, (_, i) => i / 100);

export default function Automation() {
  const scenario = useScenario((s) => s.current);
  const { state, run, cancel } = useSimulation<'automation'>();
  const r = state.status === 'done' ? state.result : null;
  const okPts = r?.curve.filter((p) => p.ok) ?? [];
  const base = r?.curve[0];
  const idx = (k: 'Y' | 'L' | 'W' | 'K') => okPts.map((p) => ((p[k] ?? NaN) / (base?.[k] ?? NaN)) * 100);
  const label = `${scenario.preset === 'cyprus' ? 'Cyprus 2026' : 'Paper Table 1'}, Technology ${scenario.technology}`;
  return (
    <>
      <PageHeader
        title="Automation simulator"
        lead="How rising automation changes output, working time, wages, capital, labour's share and social-security contributions in the model's long-run steady state, with no new tax."
      />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card>
          <CardHeader title="Settings" subtitle="Nothing recomputes until you run." />
          <CardBody className="space-y-5">
            <ScenarioControls />
            <RunStatus
              state={state}
              onCancel={cancel}
              onRun={() => run({ kind: 'automation', scenario, adoptions: GRID })}
            />
          </CardBody>
        </Card>
        <div className="space-y-6">
          {r && (
            <>
              <Card>
                <CardHeader
                  title={`Steady state at adoption ${scenario.adoption.toFixed(2)}`}
                  subtitle={label}
                  actions={<ProvenanceBadge kind="simulated" />}
                />
                <CardBody>
                  {r.current.ok ? (
                    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="automation-current">
                      {[
                        ['Output Y (index)', fmt(((r.current.Y ?? 0) / (base?.Y ?? 1)) * 100, 1)],
                        ['Working time L', fmt(r.current.L, 3)],
                        ['Wage W (index)', fmt(((r.current.W ?? 0) / (base?.W ?? 1)) * 100, 1)],
                        ['SS contributions / output', pct(r.current.ssToY, 2)],
                        ['Gross labour share', pct(r.current.grossLabourShare)],
                        ['Net labour share', pct(r.current.netLabourShare)],
                        [
                          'Traditional capital K (index)',
                          fmt(((r.current.K ?? 0) / (base?.K ?? 1)) * 100, 1),
                        ],
                        ['Autonomous capital D / K', fmt((r.current.D ?? 0) / (r.current.K ?? 1), 3)],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-xs text-slate-500">{k}</dt>
                          <dd className="tabular text-lg font-semibold">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <Callout tone="warn" title="No finite steady state at this adoption level">
                      Beyond adoption {fmt(r.boundary, 3)}, autonomous capital alone can produce at a cost
                      below the zero-profit price, and the model economy grows without bound. This is a
                      property of the model, not a solver failure.
                    </Callout>
                  )}
                  {r.calibration && (
                    <p className="mt-4 text-xs text-slate-500">
                      Calibrated for Cyprus: β {fmt(r.calibration.beta, 4)}, γ {fmt(r.calibration.gamma, 3)},
                      capital weight {fmt(r.calibration.capitalWeight, 3)}, effective SI rate{' '}
                      {pct(r.calibration.effectiveSiRate, 2)} per side (a model coefficient; statutory rate
                      8.8%). <ProvenanceBadge kind="calibrated" />
                    </p>
                  )}
                </CardBody>
              </Card>
              <ChartCard
                title="Social-security contributions as a share of output"
                kind="simulated"
                units="% of factor-cost output"
                baseline={`Target = zero-adoption ratio ${pct(r.target, 2)}${scenario.preset === 'cyprus' ? ' (equals the Fund’s 2023 contributions excl. state)' : ''}`}
                scenario={label}
                source="Casas–Torres steady state, semi-analytic dual solver (cross-checked against the Newton solver and SciPy)"
                interpretation="Without new taxes, automation erodes payroll-based financing. The gap between the line and the target is what a new instrument would need to raise."
                warnings={[
                  `No finite steady state beyond adoption ${fmt(r.boundary, 3)}; points there are omitted, not interpolated.`,
                ]}
                data={[
                  {
                    type: 'scatter',
                    mode: 'lines',
                    name: 'SS / output',
                    x: okPts.map((p) => p.adoption),
                    y: okPts.map((p) => (p.ssToY ?? NaN) * 100),
                  },
                  {
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Target',
                    x: [0, 0.49],
                    y: [r.target * 100, r.target * 100],
                    line: { dash: 'dash', color: '#64748b' },
                  },
                ]}
                layout={{
                  xaxis: { title: { text: 'Adoption parameter (CES weight)' } },
                  yaxis: { title: { text: '% of output' }, rangemode: 'tozero' },
                }}
                csvRows={r.curve.map((p) => ({
                  adoption: p.adoption,
                  ok: p.ok,
                  reason: p.reason ?? '',
                  ssToY: p.ssToY ?? null,
                }))}
              />
              <ChartCard
                title="Output, working time, wages and capital"
                kind="simulated"
                units="index, zero adoption = 100"
                baseline="Same economy without autonomous capital"
                scenario={label}
                source="Steady-state levels from the dual solver"
                interpretation="Working time L is total hours per person in a representative household. A fall means fewer hours worked; the model does not separate shorter hours from unemployment."
                warnings={[
                  'Near the existence boundary, output and capital grow without limit; levels there reflect the model’s AK-type regime.',
                ]}
                data={(['Y', 'L', 'W', 'K'] as const).map((k) => ({
                  type: 'scatter',
                  mode: 'lines',
                  name: { Y: 'Output Y', L: 'Working time L', W: 'Wage W', K: 'Traditional capital K' }[k],
                  x: okPts.map((p) => p.adoption),
                  y: idx(k),
                }))}
                layout={{
                  xaxis: { title: { text: 'Adoption parameter' } },
                  yaxis: { title: { text: 'Index' }, type: 'log' },
                }}
                csvRows={okPts.map((p) => ({
                  adoption: p.adoption,
                  Y: p.Y ?? null,
                  L: p.L ?? null,
                  W: p.W ?? null,
                  K: p.K ?? null,
                  D: p.D ?? null,
                }))}
              />
              <ChartCard
                title="Gross and net labour income shares"
                kind="simulated"
                units="share of output"
                baseline="Zero adoption"
                scenario={label}
                source="Gross: W·L/Y (paper eq. 7/16). Net: labour cost over output net of depreciation (definition D3, not specified in the paper)"
                interpretation="Automation moves income from labour to capital. Net shares deduct depreciation, which is large for fast-depreciating autonomous capital."
                data={[
                  {
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Gross labour share',
                    x: okPts.map((p) => p.adoption),
                    y: okPts.map((p) => p.grossLabourShare ?? NaN),
                  },
                  {
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Net labour share',
                    x: okPts.map((p) => p.adoption),
                    y: okPts.map((p) => p.netLabourShare ?? NaN),
                  },
                ]}
                layout={{
                  xaxis: { title: { text: 'Adoption parameter' } },
                  yaxis: { title: { text: 'Share' }, range: [0, 1] },
                }}
                csvRows={okPts.map((p) => ({
                  adoption: p.adoption,
                  gross: p.grossLabourShare ?? null,
                  net: p.netLabourShare ?? null,
                }))}
              />
            </>
          )}
          {!r && (
            <Callout>
              Choose settings and press “Run simulation”. Calculations run in a background worker, so the page
              stays responsive.
            </Callout>
          )}
        </div>
      </div>
    </>
  );
}
