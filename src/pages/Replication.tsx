import { useMemo, useState } from 'react';
import { useSimulation } from '../hooks/useSimulation';
import { RunStatus } from '../components/RunStatus';
import { ChartCard } from '../components/charts/ChartCard';
import { Callout, Card, CardBody, CardHeader, DataTable, Select } from '../components/ui/core';
import { PageHeader } from '../components/PageHeader';
import { fmt } from '../lib/format';
import type { EquationVariant } from '../economics/paper/types';

const SCHEMES = {
  robotIncome: 'Robot income tax τ^d (Fig. 2)',
  robotInvestment: 'Robot investment tax τ^id (Fig. 3)',
  robotSS: 'Robot SS contribution τ^ssz (Fig. 4)',
} as const;

export default function Replication() {
  const [variant, setVariant] = useState<EquationVariant>({
    techAWeight: 'capitalWeight',
    labourSupply: 'asPrinted',
  });
  const [scheme, setScheme] = useState<keyof typeof SCHEMES>('robotSS');
  const { state, run, cancel } = useSimulation<'replication'>();
  const r = state.status === 'done' ? state.result : null;
  const curves = useMemo(() => r?.curves ?? [], [r]);
  const pick = (t: 'A' | 'B', e: number, s: string) =>
    curves
      .find((c) => c.technology === t && c.elasticityAuto === e && c.scheme === s)
      ?.points.filter((p) => p.ok) ?? [];
  const passed = r?.benchmarks.filter((b) => b.pass).length ?? 0;
  return (
    <>
      <PageHeader
        title="Paper replication explorer"
        lead="Reproduce Casas & Torres (2026) with the published calibration (Table 1). Benchmarks are compared with tolerances fixed in advance; discrepancies are reported, not tuned away."
      />
      <Card className="mb-6">
        <CardHeader
          title="Equation variants"
          subtitle="Both alternatives are documented in MODEL_DEVIATIONS (D1, D2)."
        />
        <CardBody className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-1">
            <label htmlFor="rv1" className="text-sm font-medium">
              Technology A weight
            </label>
            <Select
              id="rv1"
              label="Technology A weight"
              value={variant.techAWeight}
              onChange={(v) => setVariant({ ...variant, techAWeight: v })}
              options={[
                { value: 'capitalWeight', label: '0.35 on capital (matches figures)' },
                { value: 'asPrinted', label: 'As printed in eq. (1)' },
              ]}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="rv2" className="text-sm font-medium">
              Labour supply (24)
            </label>
            <Select
              id="rv2"
              label="Labour supply variant"
              value={variant.labourSupply}
              onChange={(v) => setVariant({ ...variant, labourSupply: v })}
              options={[
                { value: 'asPrinted', label: 'As printed (tax wedges)' },
                { value: 'figureReplication', label: 'Figure replication (no wedges)' },
              ]}
            />
          </div>
          <RunStatus
            state={state}
            onCancel={cancel}
            onRun={() => run({ kind: 'replication', variant })}
            label="Run replication"
          />
        </CardBody>
      </Card>
      {r && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={`Benchmarks: ${passed} of ${r.benchmarks.length} pass`}
              subtitle="These benchmarks are computed with the default variants; the curves below use the variants you selected."
            />
            <CardBody>
              <DataTable
                caption="Replication benchmarks"
                dense
                columns={[
                  { key: 'id', label: 'ID' },
                  { key: 'claim', label: 'Published claim' },
                  { key: 'pub', label: 'Published', align: 'right' },
                  { key: 'comp', label: 'Computed' },
                  { key: 'tol', label: 'Tolerance' },
                  { key: 'res', label: 'Result' },
                ]}
                rows={r.benchmarks.map((b) => ({
                  id: b.id,
                  claim: (
                    <>
                      {b.claim}
                      {r.knownDiscrepancies[b.id] && (
                        <span className="block text-xs text-amber-700 dark:text-amber-300">
                          Documented discrepancy: {r.knownDiscrepancies[b.id]}
                        </span>
                      )}
                    </>
                  ),
                  pub: b.published,
                  comp: b.computed,
                  tol: b.tolerance,
                  res: (
                    <span
                      className={
                        b.pass
                          ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                          : 'font-semibold text-red-700 dark:text-red-400'
                      }
                    >
                      {b.pass ? 'PASS' : 'FAIL'}
                    </span>
                  ),
                }))}
              />
            </CardBody>
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard
              title="SS contributions / output without robot taxes (paper Fig. 1)"
              kind="simulated"
              units="share of output"
              baseline="Zero adoption ≈ 0.151"
              scenario="Paper Table 1, σ = υ = 2"
              source="Dual solver; existence boundary computed analytically"
              interpretation="Contributions fall as automation replaces labour. Technology A loses its steady state at adoption 0.435."
              data={(['A', 'B'] as const).map((t) => ({
                type: 'scatter',
                mode: 'lines',
                name: `Technology ${t}`,
                x: pick(t, 2, 'none').map((p) => p.adoption),
                y: pick(t, 2, 'none').map((p) => p.ssToY ?? NaN),
              }))}
              layout={{
                xaxis: { title: { text: 'Adoption parameter' } },
                yaxis: { title: { text: 'SS / Y' }, rangemode: 'tozero' },
              }}
              csvRows={(['A', 'B'] as const).flatMap((t) =>
                pick(t, 2, 'none').map((p) => ({
                  technology: t,
                  adoption: p.adoption,
                  ssToY: p.ssToY ?? null,
                })),
              )}
            />
            <Card>
              <CardHeader title="Required robot tax" subtitle="Choose the instrument" />
              <CardBody className="space-y-3">
                <Select
                  id="rsch"
                  label="Robot tax"
                  value={scheme}
                  onChange={setScheme}
                  options={(Object.keys(SCHEMES) as (keyof typeof SCHEMES)[]).map((k) => ({
                    value: k,
                    label: SCHEMES[k],
                  }))}
                />
                <ChartCard
                  title={SCHEMES[scheme]}
                  kind="simulated"
                  units="tax rate (fraction of its base)"
                  baseline="Rate that restores the zero-adoption SS/Y"
                  scenario="Paper Table 1; elasticities 1, 2, 3"
                  source="Bracketed root search on the steady state"
                  interpretation="Technology A rates are exactly constant (Proposition 3); the paper's low-adoption spikes are not reproduced (B11)."
                  warnings={[
                    'A robot SS contribution of 28% taxes the rental value of robots used, not revenue or profit.',
                  ]}
                  data={(['A', 'B'] as const).flatMap((t) =>
                    [1, 2, 3].map((e) => ({
                      type: 'scatter' as const,
                      mode: 'lines' as const,
                      name: `Tech ${t}, elasticity ${e}`,
                      line: { dash: t === 'A' ? 'solid' : 'dot' } as const,
                      x: pick(t, e, scheme).map((p) => p.adoption),
                      y: pick(t, e, scheme).map((p) => p.rate ?? NaN),
                    })),
                  )}
                  layout={{
                    xaxis: { title: { text: 'Adoption parameter' } },
                    yaxis: { title: { text: 'Rate' } },
                  }}
                  csvRows={(['A', 'B'] as const).flatMap((t) =>
                    [1, 2, 3].flatMap((e) =>
                      pick(t, e, scheme).map((p) => ({
                        technology: t,
                        elasticity: e,
                        adoption: p.adoption,
                        rate: p.rate ?? null,
                      })),
                    ),
                  )}
                />
              </CardBody>
            </Card>
            <ChartCard
              title="Share of SS paid by the robot source (paper Fig. 5)"
              kind="simulated"
              units="share of SS contributions"
              baseline="50% crossover"
              scenario={`${SCHEMES[scheme]}, elasticity 2`}
              source="Required-rate solutions"
              interpretation="The financing burden shifts from labour to autonomous capital; the crossover is near adoption 0.35–0.39."
              data={(['A', 'B'] as const).map((t) => ({
                type: 'scatter',
                mode: 'lines',
                name: `Technology ${t}`,
                x: pick(t, 2, scheme).map((p) => p.adoption),
                y: pick(t, 2, scheme).map((p) => p.robotSourceShare ?? NaN),
              }))}
              layout={{
                xaxis: { title: { text: 'Adoption parameter' } },
                yaxis: { title: { text: 'Robot share' }, range: [0, 1] },
              }}
              csvRows={(['A', 'B'] as const).flatMap((t) =>
                pick(t, 2, scheme).map((p) => ({
                  technology: t,
                  adoption: p.adoption,
                  robotShare: p.robotSourceShare ?? null,
                })),
              )}
            />
            <ChartCard
              title="Output and working time without robot taxes (paper Figs 6–7)"
              kind="simulated"
              units="index, zero adoption = 100 (single axis)"
              baseline={
                variant.labourSupply === 'figureReplication'
                  ? 'Figure-replication variant (levels match the published figures)'
                  : 'Printed eq. (24): levels below the published figures'
              }
              scenario="Paper Table 1, elasticity 2"
              source="Dual solver"
              interpretation="Output rises and working time falls as automation increases. Levels depend on the labour-supply variant; ratios and tax rates do not (Proposition 1)."
              data={(['A', 'B'] as const).flatMap((t) => {
                const pts = pick(t, 2, 'none');
                const y0 = pts[0]?.Y ?? NaN;
                const l0 = pts[0]?.L ?? NaN;
                return [
                  {
                    type: 'scatter' as const,
                    mode: 'lines' as const,
                    name: `Output Y, Tech ${t}`,
                    x: pts.map((p) => p.adoption),
                    y: pts.map((p) => ((p.Y ?? NaN) / y0) * 100),
                  },
                  {
                    type: 'scatter' as const,
                    mode: 'lines' as const,
                    name: `Working time L, Tech ${t}`,
                    line: { dash: 'dot' } as const,
                    x: pts.map((p) => p.adoption),
                    y: pts.map((p) => ((p.L ?? NaN) / l0) * 100),
                  },
                ];
              })}
              layout={{
                xaxis: { title: { text: 'Adoption parameter' } },
                yaxis: { title: { text: 'Index (log scale)' }, type: 'log' },
              }}
              csvRows={(['A', 'B'] as const).flatMap((t) =>
                pick(t, 2, 'none').map((p) => ({
                  technology: t,
                  adoption: p.adoption,
                  Y: p.Y ?? null,
                  L: p.L ?? null,
                })),
              )}
            />
          </div>
          <Callout title="Where the paper does not replicate">
            Tech A rates are constant at {fmt(0.2798, 4)} (τ<sup>ssz</sup>), {fmt(0.5588, 4)} (τ<sup>d</sup>)
            and {fmt(0.3789, 4)} (τ<sup>id</sup>) at every adoption level. A technical note asking the authors
            for clarification is in docs/notes/H1-note-for-authors.md.
          </Callout>
        </div>
      )}
    </>
  );
}
