import { useScenario } from '../state/scenarioStore';
import { useSimulation } from '../hooks/useSimulation';
import { ScenarioControls } from '../components/ScenarioControls';
import { RunStatus } from '../components/RunStatus';
import { ChartCard } from '../components/charts/ChartCard';
import { SliderField } from '../components/Field';
import { Callout, Card, CardBody, CardHeader, DataTable, Select, Switch } from '../components/ui/core';
import { ProvenanceBadge } from '../components/provenance/ProvenanceBadge';
import { PageHeader } from '../components/PageHeader';
import { fmt, pct, signedPct } from '../lib/format';
import { POLICY_INFO } from '../economics/policies/registry';
import type { PolicyOutcome } from '../economics/simulation/comparisons';

const name = (r: PolicyOutcome) => (r.scheme === 'none' ? 'No new instrument' : POLICY_INFO[r.scheme].label);
const statusCell = (r: PolicyOutcome) => {
  const cls =
    r.status === 'unattainable' || r.status === 'no-steady-state' || r.status === 'baseline-missing'
      ? 'font-semibold text-red-700 dark:text-red-400'
      : '';
  return <span className={cls}>{r.status}</span>;
};
const kindOf = (r: PolicyOutcome) =>
  r.scheme === 'none'
    ? 'simulated'
    : POLICY_INFO[r.scheme].origin === 'exploratory'
      ? 'hypothetical'
      : 'simulated';

export default function Policies() {
  const { current: s, updatePolicy, updateConfig } = useScenario();
  const { state, run, cancel } = useSimulation<'compare'>();
  const r = state.status === 'done' ? state.result : null;
  const solved = r?.rows.filter((x) => x.status === 'solved') ?? [];
  const cfg = s.policy.config;
  const swap = s.policy.objective.kind === 'revenueNeutralSwap';
  const fRow = r?.rows.find((x) => x.scheme === 'labourShare');
  const gRow = r?.rows.find((x) => x.scheme === 'excessProfit');
  const scen = `${s.preset === 'cyprus' ? 'Cyprus 2026' : 'Paper Table 1'}, Tech ${s.technology}, adoption ${s.adoption.toFixed(2)}`;
  return (
    <>
      <PageHeader
        title="Compare financing instruments"
        lead="The paper's three robot taxes (B–D) and four exploratory instruments (E–G′), each set to finance social security under the same objective. Results are long-run model comparisons, conditional on the assumptions shown."
      />
      <div className="grid gap-6 lg:grid-cols-[23rem_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Economy" />
            <CardBody>
              <ScenarioControls />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Policy design" subtitle="Instrument settings and objective" />
            <CardBody className="space-y-5">
              <div className="space-y-1">
                <label htmlFor="objective" className="text-sm font-medium">
                  Objective
                </label>
                <Select
                  id="objective"
                  label="Objective"
                  value={s.policy.objective.kind}
                  onChange={(v) =>
                    updatePolicy({
                      objective:
                        v === 'restoreTarget'
                          ? { kind: 'restoreTarget' }
                          : { kind: 'revenueNeutralSwap', replacement: 0.5 },
                    })
                  }
                  options={[
                    {
                      value: 'restoreTarget',
                      label: 'Restore the Fund financing target (additional revenue)',
                    },
                    { value: 'revenueNeutralSwap', label: 'Revenue-neutral swap (replace employer SS)' },
                  ]}
                />
              </div>
              {swap && (
                <SliderField
                  id="psi"
                  label="Share of employer SS replaced"
                  value={
                    s.policy.objective.kind === 'revenueNeutralSwap' ? s.policy.objective.replacement : 0
                  }
                  min={0}
                  max={1}
                  step={0.05}
                  units="fraction"
                  kind="assumed"
                  format={(v) => pct(v, 0)}
                  description="Revenue-neutral: SS/Y stays at its pre-reform value."
                  onChange={(v) =>
                    updatePolicy({ objective: { kind: 'revenueNeutralSwap', replacement: v } })
                  }
                />
              )}
              <SliderField
                id="covE"
                label="E: liable share of value added"
                value={cfg.valueAddedCoverage}
                min={0.2}
                max={1}
                step={0.01}
                units="fraction of GVA"
                kind="assumed"
                defaultValue={1}
                format={(v) => pct(v, 0)}
                description="Stands in for exemptions. In this model it only rescales the rate; it is not a behavioural model."
                onChange={(v) => updateConfig({ valueAddedCoverage: v })}
              />
              <SliderField
                id="benchF"
                label="F: labour-share benchmark"
                value={cfg.labourShareBenchmark}
                min={0.3}
                max={0.8}
                step={0.01}
                units="employee compensation / GVA"
                kind="assumed"
                defaultValue={0.5}
                format={(v) => pct(v, 0)}
                description="50% is illustrative. Observed SBS sector shares (2024) are descriptive references, not optimal thresholds."
                onChange={(v) => updateConfig({ labourShareBenchmark: v })}
              />
              <SliderField
                id="fracG"
                label="G′: allowance as a fraction of the normal return"
                value={cfg.capitalReturnLevyFraction}
                min={0}
                max={0.95}
                step={0.05}
                units="fraction"
                kind="assumed"
                defaultValue={0.5}
                format={(v) => v.toFixed(2)}
                description="G′ taxes part of ordinary capital returns. G (neutral) always uses each capital's full required return."
                onChange={(v) => updateConfig({ capitalReturnLevyFraction: v })}
              />
              <SliderField
                id="markup"
                label="Rents scenario: markup over marginal cost"
                value={s.policy.rentsMarkup}
                min={0}
                max={0.3}
                step={0.01}
                units="fraction"
                kind="assumed"
                defaultValue={0}
                format={(v) => pct(v, 0)}
                description="Exploratory extension (not in the paper). It creates genuine pure profits that G can tax."
                onChange={(v) => updatePolicy({ rentsMarkup: v })}
              />
              {s.preset === 'cyprus' && (
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="ceiling" className="text-sm font-medium">
                    SI ceiling fixed in nominal euros
                    <span className="block text-xs font-normal text-slate-500">
                      Off: ceiling indexed to wages (fixed effective rate is exact)
                    </span>
                  </label>
                  <Switch
                    id="ceiling"
                    label="SI ceiling fixed in nominal euros"
                    checked={s.policy.ceiling === 'fixedNominal'}
                    onChange={(v) => updatePolicy({ ceiling: v ? 'fixedNominal' : 'indexed' })}
                  />
                </div>
              )}
              <RunStatus
                state={state}
                onCancel={cancel}
                onRun={() => run({ kind: 'compare', scenario: s })}
                label="Compare instruments"
              />
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Callout title="What each instrument actually taxes">
            <ul className="list-disc space-y-0.5 pl-5">
              <li>
                <strong>B</strong>: autonomous-capital income net of depreciation. <strong>C</strong>:
                purchases of robots and AI (investment). <strong>D</strong>: an employer contribution on the
                rental value of robots used, so a 20% rate is 20% of robot rental cost, not of revenue or
                profit.
              </li>
              <li>
                <strong>E</strong>: firms&apos; gross value added, not turnover. <strong>F</strong>: the
                shortfall of employee compensation below a benchmark share of value added. <strong>G</strong>:
                returns above the normal return on capital, plus genuine rents. <strong>G′</strong>: part of
                the ordinary return.
              </li>
            </ul>
          </Callout>
          {r && (
            <>
              {fRow && fRow.status !== 'solved' && (
                <Callout tone="warn" title={`Policy F: ${fRow.status}`}>
                  At this benchmark F cannot reach the objective at any admissible rate. It encourages firms
                  to raise their labour share, which shrinks its own base. A non-binding threshold raises
                  nothing.
                </Callout>
              )}
              {fRow?.labourShareRegime === 'kink' && (
                <Callout tone="warn" title="Policy F: kink">
                  Firms bunch exactly at the benchmark, and the contribution raises no revenue.
                </Callout>
              )}
              {gRow && gRow.status !== 'solved' && (
                <Callout title="Policy G (neutral) raises nothing">
                  With each capital&apos;s required return as the allowance, and no economic rents
                  (competitive model), there is no excess profit to tax. Set a markup in the rents scenario to
                  explore genuine rents. G′ instead taxes ordinary returns.
                </Callout>
              )}
              <Card>
                <CardHeader
                  title="Revenue and status"
                  subtitle={`${scen}. Target SS/Y ${pct(swap ? r.rows[0]?.ssToY : r.target, 2)} of output`}
                  actions={<ProvenanceBadge kind="simulated" />}
                />
                <CardBody>
                  <DataTable
                    caption="Revenue and status by instrument"
                    columns={[
                      { key: 'code', label: '' },
                      { key: 'name', label: 'Instrument' },
                      { key: 'status', label: 'Status' },
                      { key: 'rate', label: 'Rate', align: 'right' },
                      { key: 'ss', label: 'SS / output', align: 'right' },
                      { key: 'rev', label: 'Instrument revenue / output', align: 'right' },
                      { key: 'extra', label: 'Notes' },
                    ]}
                    rows={r.rows.map((x) => ({
                      code: <span className="font-semibold">{x.code}</span>,
                      name: (
                        <span className="flex flex-wrap items-center gap-1">
                          {name(x)} <ProvenanceBadge kind={kindOf(x)} />
                        </span>
                      ),
                      status: statusCell(x),
                      rate: fmt(x.rate, 4),
                      ss: pct(x.ssToY, 2),
                      rev: pct(x.instrumentRevenue, 2),
                      extra:
                        x.scheme === 'labourShare'
                          ? `regime: ${x.labourShareRegime ?? '—'}`
                          : x.scheme === 'excessProfit' || x.scheme === 'capitalReturnLevy'
                            ? `on rents ${pct(x.gOnRents, 2)}, on capital returns ${pct(x.gOnCapitalReturns, 2)}`
                            : '',
                    }))}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardHeader
                  title="Real effects vs no new instrument"
                  subtitle="Percentage changes in the long-run steady state"
                />
                <CardBody>
                  <DataTable
                    caption="Real effects"
                    columns={[
                      { key: 'code', label: '' },
                      { key: 'dY', label: 'GDP', align: 'right' },
                      { key: 'dC', label: 'Consumption', align: 'right' },
                      { key: 'dI', label: 'Investment', align: 'right' },
                      { key: 'dK', label: 'Capital K', align: 'right' },
                      { key: 'dL', label: 'Working time', align: 'right' },
                    ]}
                    rows={r.rows.map((x) => ({
                      code: x.code,
                      dY: signedPct(x.dY),
                      dC: signedPct(x.dC),
                      dI: signedPct(x.dI),
                      dK: signedPct(x.dK),
                      dL: signedPct(x.dL),
                    }))}
                  />
                </CardBody>
              </Card>
              <div className="grid gap-6 2xl:grid-cols-2">
                <Card>
                  <CardHeader title="Distribution and burden" />
                  <CardBody>
                    <DataTable
                      caption="Distribution"
                      dense
                      columns={[
                        { key: 'code', label: '' },
                        { key: 'gl', label: 'Gross labour share', align: 'right' },
                        { key: 'nl', label: 'Net labour share', align: 'right' },
                        { key: 'gk', label: 'Capital share', align: 'right' },
                        { key: 'eb', label: 'Employer burden', align: 'right' },
                      ]}
                      rows={r.rows.map((x) => ({
                        code: x.code,
                        gl: pct(x.grossLabourShare),
                        nl: pct(x.netLabourShare),
                        gk: pct(x.grossCapitalShare),
                        eb: pct(x.employerBurden, 2),
                      }))}
                    />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader
                    title="Efficiency (one indicator among several)"
                    subtitle="Steady-state consumption-equivalent welfare. Not a measure of social desirability."
                  />
                  <CardBody>
                    <DataTable
                      caption="Efficiency"
                      dense
                      columns={[
                        { key: 'code', label: '' },
                        { key: 'ce', label: 'Welfare (CE)', align: 'right' },
                        { key: 'cpr', label: 'Welfare cost per € raised', align: 'right' },
                      ]}
                      rows={r.rows.map((x) => ({
                        code: x.code,
                        ce: x.welfareCE === null ? '—' : signedPct(x.welfareCE * 100),
                        cpr: fmt(x.costPerRevenue, 3),
                      }))}
                    />
                  </CardBody>
                </Card>
              </div>
              <ChartCard
                title="Change in GDP, investment and working time by instrument"
                kind="simulated"
                units="% change vs no new instrument"
                baseline="Same adoption level, no new instrument"
                scenario={scen}
                source="Dual solver with endogenous rates (bracketed root search)"
                interpretation="Bars further below zero mean larger long-run output, investment or hours losses for the same SS financing."
                warnings={[
                  'E ranks best on welfare cost per € in long-run representative-firm settings, but last when capital is fixed (see Sensitivity).',
                  'Near the existence boundary the reference economy grows without limit, which inflates percentage changes.',
                ]}
                data={(['dY', 'dI', 'dL'] as const).map((k) => ({
                  type: 'bar',
                  name: { dY: 'GDP', dI: 'Investment', dL: 'Working time' }[k],
                  x: solved.map((x) => x.code),
                  y: solved.map((x) => x[k] ?? NaN),
                }))}
                layout={{ barmode: 'group', yaxis: { title: { text: '% change' } } }}
                csvRows={r.rows.map((x) => ({
                  code: x.code,
                  status: x.status,
                  rate: x.rate,
                  dY: x.dY,
                  dC: x.dC,
                  dI: x.dI,
                  dK: x.dK,
                  dL: x.dL,
                  welfareCE: x.welfareCE,
                  costPerRevenue: x.costPerRevenue,
                }))}
              />
            </>
          )}
          {!r && <Callout>Set the economy and policy design, then press “Compare instruments”.</Callout>}
        </div>
      </div>
    </>
  );
}
