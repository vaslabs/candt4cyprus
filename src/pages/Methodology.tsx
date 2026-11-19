import { useMemo, useState } from 'react';
import { loadCyprusDataset } from '../economics/cyprus/defaults';
import {
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
import { ProvenanceBadge, type Provenance } from '../components/provenance/ProvenanceBadge';
import { PageHeader } from '../components/PageHeader';

const catKind = (c: string): Provenance =>
  c === 'statutory' || c === 'measured' ? 'observed' : c === 'calibrated' ? 'calibrated' : 'assumed';

const DEVIATIONS = [
  [
    'D1',
    'Tech A weight θ = 0.35 placed on capital (matches Table 1 and Figs 1, 8); printed eq. (1) selectable.',
  ],
  [
    'D2',
    'Labour supply (24) as printed by default; “figure replication” removes tax wedges to reproduce Fig. 6–7 levels.',
  ],
  [
    'D3',
    'Net income shares are undefined in the paper; standard definition used; the discrepancy (0.862 vs ≈0.84) is reported.',
  ],
  ['D4', 'Elasticity 1 handled as the Cobb–Douglas limit, continuous through s = 1.'],
  ['D5', 'Robot-tax revenue counted as social-security financing (paper Fig. 5).'],
  [
    'D6',
    'Smallest root reported, other roots listed; rates within 1e-4 of the prohibitive limit are excluded.',
  ],
  [
    'C1–C2',
    'No replication correction carried into the Cyprus model; weight calibrated directly; eq. (24) as printed.',
  ],
  [
    'C3–C5',
    'Model SS = Fund contributions excluding the state share; other employer schemes are part of labour cost.',
  ],
  [
    'C4',
    'Effective SI rate 0.0610 per side is a calibrated coefficient reproducing the 2023 Fund accounts; statutory 8.8% kept in the payroll engine.',
  ],
  [
    'C11',
    'β = 0.975 primary assumption (does not match K/Y); β = 0.922 K/Y-matching alternative. Neither is an empirical estimate.',
  ],
  [
    'C12',
    'Technology B default, Technology A mandatory comparison; neither is empirically established for Cyprus.',
  ],
  [
    'C13',
    'SI ceiling: indexed, fixed nominal (fixed point over CYSTAT bands), or a labelled fixed-rate approximation.',
  ],
] as const;

export default function Methodology() {
  const { dataset, sources } = useMemo(() => loadCyprusDataset(), []);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'all' | 'statutory' | 'measured' | 'assumption'>('all');
  const params = dataset.parameters.filter(
    (p) =>
      (cat === 'all' || p.category === cat) &&
      (q === '' || `${p.id} ${p.label} ${p.coverage}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <>
      <PageHeader
        title="Methodology and sources"
        lead="How the model works, what each number is, and where it comes from. Every published figure links to its source, reference year and verification status."
      />
      <Tabs defaultValue="model">
        <TabsList aria-label="Methodology sections">
          <TabsTrigger value="model">Model</TabsTrigger>
          <TabsTrigger value="levels">Analytical levels</TabsTrigger>
          <TabsTrigger value="deviations">Deviations</TabsTrigger>
          <TabsTrigger value="sources">Sources ({sources.length})</TabsTrigger>
          <TabsTrigger value="params">Parameters ({dataset.parameters.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="model" className="mt-4 space-y-4">
          <Card>
            <CardHeader
              title="The Casas–Torres (2026) model"
              subtitle="Hacienda Pública Española 256(1), 69–104, DOI 10.7866/HPE-RPE.26.1.3"
            />
            <CardBody className="space-y-3 text-sm leading-relaxed">
              <p>
                A representative household chooses consumption and working time. It owns two capital stocks:
                traditional capital K and autonomous capital D (robots and AI). Firms are competitive and use
                constant-returns nested CES technologies:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Technology A:</strong> Y = CES<sub>ρ</sub>(K, X) with X = CES<sub>υ</sub>(D, L).
                  Robots substitute for labour and complement capital.
                </li>
                <li>
                  <strong>Technology B:</strong> Y = CES<sub>σ</sub>(D, X) with X = CES<sub>ε</sub>(K, L).
                  Robots substitute for both.
                </li>
              </ul>
              <p>
                The government taxes consumption, labour, capital and social security, and returns all revenue
                lump-sum. The policy question is which tax on autonomous capital (on income B, investment C or
                as an employer SS contribution D), or which exploratory instrument (value added E, labour
                share F, excess profit G), keeps social-security contributions at a target share of output as
                automation rises.
              </p>
              <p>
                <strong>Numerical method.</strong> Two independent solvers are used: a semi-analytic dual
                (unit-cost) reduction, and Newton&apos;s method on the paper&apos;s full 10-equation system.
                They agree to 1e-9 and are cross-checked against an independent Python/SciPy implementation.
                Existence of a steady state is established analytically, and solver failures are never
                reported as non-existence. Required tax rates come from a bracketed root search, and
                additional roots are reported.
              </p>
              <p>
                <strong>Replication.</strong> 17 of 21 published benchmarks are reproduced within tolerances
                fixed in advance. The 4 that are not are documented, not tuned away: Tech A low-adoption
                transients, net-share rankings, and the “35% of capital” phrase.
              </p>
            </CardBody>
          </Card>
        </TabsContent>
        <TabsContent value="levels" className="mt-4">
          <Card>
            <CardBody className="space-y-2 text-sm">
              <p>
                <strong>Level 1, paper replication:</strong> the published equations and calibration
                (OECD-average artificial economy).
              </p>
              <p>
                <strong>Level 2, Cyprus macro simulation:</strong> verified Cyprus statistics plus calibrated
                coefficients and stated assumptions. Its SS/Y target equals the Fund&apos;s observed 2023
                contributions (excluding the state share) relative to factor-cost output.
              </p>
              <p>
                <strong>Level 3, company-level exploration:</strong> exact statutory payroll rules applied to
                constructed, hypothetical firms. These results are not aggregated to national revenue, and
                Level 3 is not implied by the macro model.
              </p>
            </CardBody>
          </Card>
        </TabsContent>
        <TabsContent value="deviations" className="mt-4">
          <Card>
            <CardBody>
              <DataTable
                caption="Model deviations"
                columns={[
                  { key: 'id', label: 'ID' },
                  { key: 'text', label: 'Choice and justification' },
                ]}
                rows={DEVIATIONS.map(([id, text]) => ({ id, text }))}
              />
              <p className="mt-3 text-xs text-slate-500">
                Full register: docs/MODEL_DEVIATIONS.md in the repository.
              </p>
            </CardBody>
          </Card>
        </TabsContent>
        <TabsContent value="sources" className="mt-4">
          <Card>
            <CardBody>
              <DataTable
                caption="Source register"
                dense
                columns={[
                  { key: 'title', label: 'Source' },
                  { key: 'publisher', label: 'Publisher' },
                  { key: 'kind', label: 'Kind' },
                  { key: 'date', label: 'Published' },
                  { key: 'accessed', label: 'Accessed' },
                ]}
                rows={sources.map((s) => ({
                  title: s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-dotted">
                      {s.title}
                    </a>
                  ) : (
                    s.title
                  ),
                  publisher: s.publisher,
                  kind: s.kind,
                  date: s.publicationDate ?? 'not shown',
                  accessed: s.accessed,
                }))}
              />
            </CardBody>
          </Card>
        </TabsContent>
        <TabsContent value="params" className="mt-4">
          <Card>
            <CardHeader
              title="Parameter dataset (Cyprus 2026)"
              subtitle="Statutory and measured values are verified and sourced; assumptions carry sensitivity ranges"
              actions={
                <div className="flex flex-wrap gap-2">
                  <label htmlFor="pq" className="sr-only">
                    Search parameters
                  </label>
                  <input
                    id="pq"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search…"
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                  <div className="w-44">
                    <Select
                      id="pcat"
                      label="Category"
                      value={cat}
                      onChange={setCat}
                      options={[
                        { value: 'all', label: 'All categories' },
                        { value: 'statutory', label: 'Statutory' },
                        { value: 'measured', label: 'Measured' },
                        { value: 'assumption', label: 'Assumptions' },
                      ]}
                    />
                  </div>
                </div>
              }
            />
            <CardBody>
              <DataTable
                caption="Parameters"
                dense
                columns={[
                  { key: 'label', label: 'Parameter' },
                  { key: 'value', label: 'Value', align: 'right' },
                  { key: 'units', label: 'Units' },
                  { key: 'year', label: 'Year' },
                  { key: 'status', label: 'Status' },
                  { key: 'verification', label: 'Verification' },
                  { key: 'range', label: 'Range' },
                ]}
                rows={params.map((p) => ({
                  label: (
                    <span title={`${p.explanation}${p.evidence ? ` Evidence: ${p.evidence}` : ''}`}>
                      {p.label}
                      <span className="block text-xs text-slate-500">{p.id}</span>
                    </span>
                  ),
                  value:
                    p.value === null
                      ? 'missing'
                      : p.value.toLocaleString('en-GB', { maximumFractionDigits: 4 }),
                  units: p.units,
                  year: p.referenceYear,
                  status: <ProvenanceBadge kind={catKind(p.category)} />,
                  verification: p.verification,
                  range: p.sensitivityRange ? `${p.sensitivityRange[0]}–${p.sensitivityRange[1]}` : '',
                }))}
              />
            </CardBody>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
