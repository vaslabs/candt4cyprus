import { useMemo, useState } from 'react';
import { useSimulation } from '../hooks/useSimulation';
import { RunStatus } from '../components/RunStatus';
import { ChartCard } from '../components/charts/ChartCard';
import { Callout, Card, CardBody, CardHeader, DataTable, Select, Switch } from '../components/ui/core';
import { ProvenanceBadge } from '../components/provenance/ProvenanceBadge';
import { PageHeader } from '../components/PageHeader';
import { eur, pct } from '../lib/format';
import { ARCHETYPE_MODELS, DEFAULT_FIRM_POLICY, sbsBenchmarks } from '../economics/firm/archetypes';
import { salaryWith13th } from '../economics/cyprus/earningsAttribution';
import type { FirmInputs, FirmPolicyConfig } from '../economics/firm/firmModel';

interface Group {
  label: string;
  headcount: number;
  annualPay: number;
}
interface Form {
  name: string;
  sector: string;
  revenue: number;
  intermediate: number;
  outsourced: number;
  capital: number;
  depreciation: number;
  ai: number;
  losses: number;
  shifting: number;
  thirteenth: boolean;
  groups: Group[];
}

function fromArchetype(i: number): Form {
  const a = ARCHETYPE_MODELS[i] ?? ARCHETYPE_MODELS[0];
  if (!a) throw new Error('no archetypes available');
  const f = a.firm;
  return {
    name: f.name,
    sector: f.sector,
    revenue: f.revenue,
    intermediate: f.intermediateConsumption,
    outsourced: f.outsourcedLabourCosts,
    capital: f.capitalStock,
    depreciation: f.depreciation,
    ai: f.aiInvestment,
    losses: f.lossesBroughtForward,
    shifting: f.maxProfitShifting,
    thirteenth: a.spec.thirteenthSalary,
    groups: f.employees.map((g, j) => ({
      label: g.label,
      headcount: g.headcount,
      annualPay: Math.round((a.spec.payGroups[j]?.multiple ?? 1) * (a.provenance.meanWage?.value ?? 0)),
    })),
  };
}

function toFirm(f: Form): FirmInputs {
  return {
    name: f.name,
    sector: f.sector,
    hypothetical: true,
    revenue: f.revenue,
    intermediateConsumption: f.intermediate,
    outsourcedLabourCosts: f.outsourced,
    employees: f.groups.map((g) => ({
      label: g.label,
      headcount: Math.max(0, Math.round(g.headcount)),
      earnings: f.thirteenth
        ? salaryWith13th((g.annualPay * 12) / 13)
        : salaryWith13th(g.annualPay, { thirteenth: 'none' }),
    })),
    depreciation: f.depreciation,
    capitalStock: f.capital,
    aiInvestment: f.ai,
    lossesBroughtForward: f.losses,
    maxProfitShifting: f.shifting,
  };
}

function Num({
  id,
  label,
  value,
  onChange,
  step = 1000,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tabular h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      />
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export default function Business() {
  const [arch, setArch] = useState(0);
  const [form, setForm] = useState<Form>(() => fromArchetype(0));
  const [cfg, setCfg] = useState<FirmPolicyConfig>(DEFAULT_FIRM_POLICY);
  const [sectorBench, setSectorBench] = useState(false);
  const { state, run, cancel } = useSimulation<'firm'>();
  const r = state.status === 'done' ? state.result : null;
  const prov = (ARCHETYPE_MODELS[arch] ?? ARCHETYPE_MODELS[0])?.provenance ?? {};
  const bench = useMemo(() => sbsBenchmarks(['I55', 'M69', 'J62', 'I', 'J', 'M']), []);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const effCfg: FirmPolicyConfig = sectorBench
    ? { ...cfg, labourShare: { ...cfg.labourShare, benchmarks: bench } }
    : cfg;
  const acc = r?.accounts;
  const employerSi = acc ? acc.existingByRecipient.socialInsuranceFund : 0;
  return (
    <>
      <PageHeader
        title="Company contribution simulator"
        lead="Exact 2026 Cyprus payroll rules applied to a constructed company, compared with the exploratory contributions E, F and G. Results are illustrative and are not added up to national revenue."
      >
        <Callout tone="warn">
          The archetypes are constructed from Eurostat SBS sector statistics plus stated assumptions. They are
          not real businesses. Every value is editable.
        </Callout>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Company" />
            <CardBody className="space-y-3">
              <Select
                id="arch"
                label="Archetype"
                value={String(arch)}
                onChange={(v) => {
                  const i = Number(v);
                  setArch(i);
                  setForm(fromArchetype(i));
                }}
                options={ARCHETYPE_MODELS.map((a, i) => ({ value: String(i), label: a.spec.name }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Num
                  id="rev"
                  label="Revenue (turnover) €"
                  value={form.revenue}
                  onChange={(v) => set('revenue', v)}
                  hint="Not value added"
                />
                <Num
                  id="ic"
                  label="Intermediate consumption €"
                  value={form.intermediate}
                  onChange={(v) => set('intermediate', v)}
                  hint={`GVA = ${eur(form.revenue - form.intermediate)}`}
                />
                <Num
                  id="out"
                  label="Outsourced labour €"
                  value={form.outsourced}
                  onChange={(v) => set('outsourced', v)}
                />
                <Num
                  id="cap"
                  label="Capital stock €"
                  value={form.capital}
                  onChange={(v) => set('capital', v)}
                />
                <Num
                  id="dep"
                  label="Depreciation €"
                  value={form.depreciation}
                  onChange={(v) => set('depreciation', v)}
                />
                <Num id="ai" label="AI-related investment €" value={form.ai} onChange={(v) => set('ai', v)} />
                <Num
                  id="loss"
                  label="Losses brought forward €"
                  value={form.losses}
                  onChange={(v) => set('losses', v)}
                />
                <Num
                  id="shift"
                  label="Max profit shifting (0–1)"
                  value={form.shifting}
                  step={0.05}
                  onChange={(v) => set('shifting', Math.min(1, Math.max(0, v)))}
                  hint="Behavioural assumption"
                />
              </div>
              <div className="flex items-center justify-between">
                <label htmlFor="t13" className="text-sm">
                  13th salary (Reg. 8(3) attribution)
                </label>
                <Switch
                  id="t13"
                  label="13th salary"
                  checked={form.thirteenth}
                  onChange={(v) => set('thirteenth', v)}
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  Employees by pay group (annual pay incl. 13th)
                </legend>
                {form.groups.map((g, i) => (
                  <div key={i} className="grid grid-cols-[1fr_5rem_7rem] items-end gap-2">
                    <span className="truncate pb-2 text-xs">{g.label}</span>
                    <Num
                      id={`hc${i}`}
                      label="Headcount"
                      value={g.headcount}
                      step={1}
                      onChange={(v) =>
                        set(
                          'groups',
                          form.groups.map((x, j) => (j === i ? { ...x, headcount: v } : x)),
                        )
                      }
                    />
                    <Num
                      id={`pay${i}`}
                      label="Annual pay €"
                      value={g.annualPay}
                      onChange={(v) =>
                        set(
                          'groups',
                          form.groups.map((x, j) => (j === i ? { ...x, annualPay: v } : x)),
                        )
                      }
                    />
                  </div>
                ))}
              </fieldset>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Exploratory contributions" subtitle="Illustrative settings (assumptions)" />
            <CardBody className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Num
                  id="eRate"
                  label="E rate on GVA"
                  value={cfg.valueAdded.rate}
                  step={0.005}
                  onChange={(v) => setCfg({ ...cfg, valueAdded: { ...cfg.valueAdded, rate: v } })}
                />
                <Num
                  id="eMin"
                  label="E min employees"
                  value={cfg.valueAdded.minEmployees}
                  step={1}
                  onChange={(v) => setCfg({ ...cfg, valueAdded: { ...cfg.valueAdded, minEmployees: v } })}
                />
                <Num
                  id="eEl"
                  label="E base elasticity"
                  value={cfg.valueAdded.baseElasticity}
                  step={0.1}
                  onChange={(v) => setCfg({ ...cfg, valueAdded: { ...cfg.valueAdded, baseElasticity: v } })}
                />
                <Num
                  id="eRep"
                  label="E payroll replacement"
                  value={cfg.valueAdded.payrollReplacement}
                  step={0.1}
                  onChange={(v) =>
                    setCfg({ ...cfg, valueAdded: { ...cfg.valueAdded, payrollReplacement: v } })
                  }
                />
                <Num
                  id="fRate"
                  label="F rate on shortfall"
                  value={cfg.labourShare.rate}
                  step={0.05}
                  onChange={(v) => setCfg({ ...cfg, labourShare: { ...cfg.labourShare, rate: v } })}
                />
                <Num
                  id="fBench"
                  label="F generic benchmark"
                  value={cfg.labourShare.benchmarks.default ?? 0.5}
                  step={0.05}
                  onChange={(v) =>
                    setCfg({ ...cfg, labourShare: { ...cfg.labourShare, benchmarks: { default: v } } })
                  }
                />
                <Num
                  id="fMargin"
                  label="F min EBIT margin"
                  value={cfg.labourShare.minOperatingMargin}
                  step={0.05}
                  onChange={(v) =>
                    setCfg({ ...cfg, labourShare: { ...cfg.labourShare, minOperatingMargin: v } })
                  }
                />
                <Num
                  id="fOut"
                  label="F outsourcing counted"
                  value={cfg.labourShare.outsourcingCountedAsLabour}
                  step={0.1}
                  onChange={(v) =>
                    setCfg({ ...cfg, labourShare: { ...cfg.labourShare, outsourcingCountedAsLabour: v } })
                  }
                />
                <Num
                  id="gRate"
                  label="G rate"
                  value={cfg.excessProfit.rate}
                  step={0.05}
                  onChange={(v) => setCfg({ ...cfg, excessProfit: { ...cfg.excessProfit, rate: v } })}
                />
                <Num
                  id="gNr"
                  label="G normal return"
                  value={cfg.excessProfit.normalReturn}
                  step={0.01}
                  onChange={(v) => setCfg({ ...cfg, excessProfit: { ...cfg.excessProfit, normalReturn: v } })}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="sb" className="text-sm">
                  F: use SBS sector benchmark (
                  {pct(bench[form.sector] ?? bench[form.sector.charAt(0)] ?? 0.5)})
                </label>
                <Switch
                  id="sb"
                  label="Use SBS sector benchmark"
                  checked={sectorBench}
                  onChange={setSectorBench}
                />
              </div>
              <RunStatus
                state={state}
                onCancel={cancel}
                onRun={() => run({ kind: 'firm', firm: toFirm(form), config: effCfg })}
                label="Calculate"
              />
            </CardBody>
          </Card>
        </div>
        <div className="min-w-0 space-y-6">
          {acc && r && (
            <>
              <Card>
                <CardHeader
                  title="Company accounts"
                  subtitle={r.firm.name}
                  actions={
                    <span className="flex gap-1">
                      <ProvenanceBadge kind="derived" />
                      <ProvenanceBadge kind="assumed" />
                    </span>
                  }
                />
                <CardBody>
                  <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="firm-accounts">
                    {[
                      ['Gross value added', eur(acc.gva)],
                      ['Employee compensation', eur(acc.employeeCompensation)],
                      ['Labour share', pct(acc.labourShare)],
                      ['EBIT margin', pct(acc.operatingMargin)],
                      ['Payroll above SI ceiling', pct(acc.shareAboveSiCeiling)],
                      ['Employer statutory contributions', eur(acc.employerStatutory)],
                      ['State SI + GHS on payroll', eur(acc.stateContributions)],
                      ['Corporate tax (15%, illustrative)', eur(acc.corporateTax)],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs text-slate-500">{k}</dt>
                        <dd className="tabular text-lg font-semibold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs text-slate-500">
                    The Social Insurance ceiling (€5,742 a month, €68,904 a year) applies per employee and per
                    period, never to total payroll. Pay above it is not insurable, which is why high-pay firms
                    contribute less per € of payroll.
                  </p>
                </CardBody>
              </Card>
              <Card>
                <CardHeader
                  title="Existing statutory contributions by recipient"
                  subtitle="Employee + employer + state, € per year"
                  actions={<ProvenanceBadge kind="observed" />}
                />
                <CardBody>
                  <DataTable
                    caption="Contributions by recipient"
                    dense
                    columns={[
                      { key: 'r', label: 'Recipient' },
                      { key: 'v', label: '€ per year', align: 'right' },
                    ]}
                    rows={Object.entries(acc.existingByRecipient).map(([k, v]) => ({
                      r: k.replace(/([A-Z])/g, ' $1').toLowerCase(),
                      v: eur(v),
                    }))}
                  />
                </CardBody>
              </Card>
              <ChartCard
                title="Existing employer contributions vs exploratory contributions"
                kind="hypothetical"
                units="€ per year"
                baseline="Current 2026 statutory rules"
                scenario={r.firm.name}
                source="Statutory payroll engine (exact rules) and Level 3 policy formulas with stated behavioural assumptions"
                interpretation="E taxes value added regardless of profit. F applies only below the labour-share benchmark and above the margin threshold. G applies only above a normal return on capital."
                warnings={[
                  'Behavioural elasticities are assumptions without Cyprus estimates.',
                  'Company results must not be aggregated to national revenue.',
                ]}
                data={[
                  {
                    type: 'bar',
                    x: [
                      'Social Insurance Fund (all payers)',
                      'E: value added',
                      'F: labour share',
                      'G: excess profit',
                    ],
                    y: [
                      employerSi,
                      r.valueAdded.contribution,
                      r.labourShare.contribution,
                      r.excessProfit.contribution,
                    ],
                    marker: { color: ['#0f766e', '#be123c', '#be123c', '#be123c'] },
                  },
                ]}
                layout={{ yaxis: { title: { text: '€ per year' } } }}
                csvRows={[
                  { item: 'socialInsuranceFund', amount: employerSi },
                  {
                    item: 'E',
                    amount: r.valueAdded.contribution,
                    liable: r.valueAdded.liable,
                    reason: r.valueAdded.reason,
                  },
                  {
                    item: 'F',
                    amount: r.labourShare.contribution,
                    liable: r.labourShare.liable,
                    reason: r.labourShare.reason,
                  },
                  {
                    item: 'G',
                    amount: r.excessProfit.contribution,
                    liable: r.excessProfit.liable,
                    reason: r.excessProfit.reason,
                  },
                ]}
              />
              <Card>
                <CardHeader title="Why each contribution applies (or not)" />
                <CardBody>
                  <DataTable
                    caption="Liability"
                    dense
                    columns={[
                      { key: 'p', label: 'Policy' },
                      { key: 'l', label: 'Liable' },
                      { key: 'c', label: 'Contribution', align: 'right' },
                      { key: 'g', label: '% of GVA', align: 'right' },
                      { key: 'why', label: 'Reason' },
                    ]}
                    rows={(['valueAdded', 'labourShare', 'excessProfit'] as const).map((k) => ({
                      p: { valueAdded: 'E', labourShare: 'F', excessProfit: 'G' }[k],
                      l: r[k].liable ? 'yes' : 'no',
                      c: eur(r[k].contribution),
                      g: pct(r[k].contribution / acc.gva, 2),
                      why: r[k].reason,
                    }))}
                  />
                </CardBody>
              </Card>
            </>
          )}
          <Card>
            <CardHeader
              title="Where the archetype's numbers come from"
              subtitle="Observed / derived from Eurostat SBS, or assumed"
            />
            <CardBody>
              <DataTable
                caption="Archetype provenance"
                dense
                columns={[
                  { key: 'k', label: 'Field' },
                  { key: 'v', label: 'Value', align: 'right' },
                  { key: 'kind', label: 'Kind' },
                  { key: 's', label: 'Source' },
                ]}
                rows={Object.entries(prov).map(([k, v]) => ({
                  k,
                  v:
                    Math.abs(v.value) >= 1000
                      ? Math.round(v.value).toLocaleString('en-GB')
                      : v.value.toFixed(3),
                  kind: <ProvenanceBadge kind={v.kind} />,
                  s: `${v.kind}: ${v.source}${v.note ? ` (${v.note})` : ''}`,
                }))}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
