import { useMemo } from 'react';
import { Link } from 'react-router';
import { fundSeries, contributionsExclState } from '../economics/cyprus/fundAccounts';
import { loadCyprusDataset } from '../economics/cyprus/defaults';
import { ChartCard } from '../components/charts/ChartCard';
import { Callout, Card, CardBody, CardHeader, DataTable } from '../components/ui/core';
import { ProvenanceBadge, ProvenanceLegend } from '../components/provenance/ProvenanceBadge';
import { PageHeader } from '../components/PageHeader';
import { eurM, pct } from '../lib/format';

const GDP: Record<number, number> = {
  2020: 22373.6,
  2022: 29696.6,
  2023: 33144.3,
  2024: 36298.1,
  2025: 38314.1,
};

function Kpi({
  label,
  value,
  note,
  kind,
}: {
  label: string;
  value: string;
  note: string;
  kind: 'observed' | 'calibrated';
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <ProvenanceBadge kind={kind} />
        </div>
        <p className="tabular mt-1 text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{note}</p>
      </CardBody>
    </Card>
  );
}

export default function Overview() {
  const { series, dataset, sources } = useMemo(() => {
    const { dataset, sources } = loadCyprusDataset();
    return { series: fundSeries(), dataset, sources };
  }, []);
  const v = (id: string) => dataset.parameters.find((p) => p.id === id);
  const last = series[series.length - 1];
  if (!last) return <p role="alert">Social Insurance Fund accounts could not be loaded.</p>;
  const srcUrl = (id: string) => sources.find((s) => s.id === id)?.url ?? undefined;
  const statutory = [
    'si.employeeRate',
    'si.employerRate',
    'si.stateRate',
    'si.ceilingMonthly',
    'si.ceilingWeekly',
    'si.selfEmployedRate',
    'ghs.employeeRate',
    'ghs.employerRate',
    'ghs.annualCeiling',
    'funds.socialCohesionRate',
    'funds.redundancyRate',
    'funds.hrdRate',
    'funds.centralHolidayRate',
    'tax.corporateRate',
    'tax.vatStandardRate',
  ];
  return (
    <>
      <PageHeader
        title="Cyprus Social Insurance and automation"
        lead={
          <>
            As AI and automation raise output while possibly lowering labour&apos;s share of income, which
            ways of financing the Social Insurance Fund could protect its revenue at the lowest economic cost?
            This tool sets out evidence and assumptions transparently. It does not give a predetermined
            answer.
          </>
        }
      >
        <ProvenanceLegend />
      </PageHeader>

      <section aria-labelledby="kpi" className="mb-6">
        <h2 id="kpi" className="sr-only">
          Key indicators
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi
            label="Nominal GDP 2025"
            value={eurM(v('macro.gdp2025')?.value, 0)}
            note="CYSTAT revised estimate, released 20 Oct 2026"
            kind="observed"
          />
          <Kpi
            label="Real GDP growth 2025"
            value={pct(v('macro.realGrowth2025')?.value)}
            note="Chain-linked (2019), CYSTAT"
            kind="observed"
          />
          <Kpi
            label="Unemployment, Q2 2026"
            value={pct(v('labour.unemploymentQ2_2026')?.value)}
            note={`Employed persons: ${(v('labour.employmentQ2_2026')?.value ?? 0).toLocaleString('en-GB')} (LFS)`}
            kind="observed"
          />
          <Kpi
            label={`Fund contributions excl. state, ${last.year}${last.preliminary ? ' (prelim.)' : ''}`}
            value={eurM(contributionsExclState(last))}
            note={`${pct(contributionsExclState(last) / (GDP[last.year] ?? NaN))} of GDP. SIS final accounts`}
            kind="observed"
          />
          <Kpi
            label={`State contribution, ${last.year}`}
            value={eurM(last.receipts.state)}
            note="General-government contribution to the Fund (a budget transfer)"
            kind="observed"
          />
          <Kpi
            label={`Fund reserve, end-${last.year}`}
            value={eurM(last.reserveClosing, 0)}
            note="An accounting reserve held mostly as deposits with the government, not liquid investments"
            kind="observed"
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Social Insurance Fund receipts and expenditure"
          kind="observed"
          units="€ million per year"
          baseline="Final accounts; 2025 preliminary"
          scenario="Observed data (no model)"
          source="Social Insurance Services statistical bulletins, final accounts of the Fund (extracted and hash-verified)"
          interpretation="Bars stack receipts by source and the line shows total expenditure. Since 2021 the Fund has run growing surpluses, which interest on its reserve increasingly supports."
          warnings={[
            'The employee/employer split is not published; general-government “social contributions” (€4.9bn in 2025) are a wider aggregate and are not used here.',
          ]}
          data={[
            {
              type: 'bar',
              name: 'Employed (private + public)',
              x: series.map((y) => y.year),
              y: series.map((y) => y.receipts.employedPrivate + y.receipts.employedPublic),
            },
            {
              type: 'bar',
              name: 'Self-employed & voluntary',
              x: series.map((y) => y.year),
              y: series.map((y) => y.receipts.selfEmployed + y.receipts.voluntary),
            },
            {
              type: 'bar',
              name: 'State contribution',
              x: series.map((y) => y.year),
              y: series.map((y) => y.receipts.state),
            },
            {
              type: 'bar',
              name: 'Interest & other',
              x: series.map((y) => y.year),
              y: series.map((y) => y.receipts.interest + y.receipts.other),
            },
            {
              type: 'scatter',
              mode: 'lines+markers',
              name: 'Total expenditure',
              x: series.map((y) => y.year),
              y: series.map((y) => y.expenditure.total),
              line: { color: '#0f172a' },
            },
          ]}
          layout={{ barmode: 'stack', yaxis: { title: { text: '€ million' } } }}
          csvRows={series.map((y) => ({
            year: y.year,
            preliminary: y.preliminary,
            ...y.receipts,
            expenditure: y.expenditure.total,
            balance: y.balance,
            reserve: y.reserveClosing,
            edition: y.editionId,
          }))}
        />
        <Card>
          <CardHeader
            title="What finances the Social Insurance Fund"
            subtitle="Statutory rules for 2026 (exact rules are applied in the company simulator)"
          />
          <CardBody>
            <DataTable
              caption="Statutory contribution rules 2026"
              dense
              columns={[
                { key: 'label', label: 'Rule' },
                { key: 'value', label: 'Value', align: 'right' },
                { key: 'kind', label: 'Status' },
              ]}
              rows={statutory.map((id) => {
                const p = v(id);
                const val = p?.value ?? null;
                const isRate = p?.units.startsWith('fraction') ?? false;
                const url = p?.sourceIds[0] ? srcUrl(p.sourceIds[0]) : undefined;
                return {
                  label: url ? (
                    <a className="underline decoration-dotted" href={url} target="_blank" rel="noreferrer">
                      {p?.label ?? id}
                    </a>
                  ) : (
                    (p?.label ?? id)
                  ),
                  value: val === null ? '—' : isRate ? pct(val, 2) : `€${val.toLocaleString('en-GB')}`,
                  kind: <ProvenanceBadge kind="observed" />,
                };
              })}
            />
            <p className="mt-3 text-xs text-slate-500">
              The Social Insurance Fund receives employee, employer, self-employed and state contributions
              only. GHS, Social Cohesion, Redundancy, HRD and Holiday funds are separate bodies. The 5.2%
              state contribution is paid by government and is not part of employers&apos; labour cost.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Callout title="What the model can and cannot say">
          The simulations are long-run steady states of a calibrated model. They are not forecasts. The
          adoption parameter is a modelling weight, not the share of businesses using AI. No Cyprus estimate
          of AI adoption or AI-generated profits exists.
        </Callout>
        <Callout tone="warn" title="Data gaps">
          The state&apos;s accumulated obligation to the Fund is reported inconsistently (€10.6bn–€13.9bn) and
          is left unset. Prorated 13th salaries and post-termination payments follow provisional rules. See{' '}
          <Link to="/methodology" className="underline">
            Methodology &amp; sources
          </Link>
          .
        </Callout>
      </div>
    </>
  );
}
