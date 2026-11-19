/**
 * Sensitivity and scenario calculations for the exploratory policies (step 6 review).
 *
 * Several mechanisms named by the reviewer CANNOT be represented structurally in the
 * representative-firm Level 2 model: firm heterogeneity, SME vs large-firm treatment,
 * low-margin/loss-making firms, avoidance and profit shifting. They are handled here as separate,
 * clearly labelled scenario calculations (SBS cells, Level 3 firms). Coverage factors are NOT a
 * behavioural model; the coverage sweep below demonstrates why.
 */
import type { PaperParameters } from '../paper/types';
import { solveSteadyStateDual } from '../paper/steadyState';
import { comparePolicies, type ComparisonOptions, type PolicyOutcome } from './comparisons';
import { solveShortRun } from './shortRun';
import { DEFAULT_POLICY_CONFIG, type ActiveScheme, withPolicy } from '../policies/registry';
import { sbsCell, sectorLabourShare } from '../data/sbs';
import { compareFirm, firmAccounts, type FirmInputs, type FirmPolicyConfig } from '../firm/firmModel';
import type { CyprusStatutoryRules } from '../cyprus/types';

// ------------------------------------------------------------------ Level 2: E coverage

/**
 * E's welfare cost per € raised as coverage varies. In the representative-firm model (τ, c) ≡ (τc, 1),
 * so the cost per € is invariant to coverage: coverage only rescales the statutory rate.
 */
export function valueAddedCoverageSweep(
  p: PaperParameters,
  adoption: number,
  target: number,
  coverages: readonly number[],
) {
  return coverages.map((c) => {
    const [, e] = comparePolicies(p, adoption, {
      target,
      schemes: ['valueAdded'],
      config: { ...DEFAULT_POLICY_CONFIG, valueAddedCoverage: c },
    });
    return {
      coverage: c,
      rate: e?.rate ?? null,
      costPerRevenue: e?.costPerRevenue ?? null,
      status: e?.status ?? 'no-steady-state',
    };
  });
}

// ------------------------------------------------------------------ Level 2: where does E's rank change?

export interface RankPoint {
  readonly label: string;
  readonly bestScheme: string | null;
  readonly eCost: number | null;
  readonly dCost: number | null;
  readonly eRank: number | null;
  readonly rows: PolicyOutcome[];
}

function rankOf(rows: PolicyOutcome[], code: string): number | null {
  const solved = rows
    .filter((r) => r.status === 'solved' && r.costPerRevenue !== null)
    .sort((a, b) => (a.costPerRevenue ?? 0) - (b.costPerRevenue ?? 0));
  const i = solved.findIndex((r) => r.code === code);
  return i < 0 ? null : i + 1;
}

export function rankPoint(label: string, rows: PolicyOutcome[]): RankPoint {
  const solved = rows
    .filter((r) => r.status === 'solved' && r.costPerRevenue !== null)
    .sort((a, b) => (a.costPerRevenue ?? 0) - (b.costPerRevenue ?? 0));
  return {
    label,
    bestScheme: solved[0]?.code ?? null,
    eCost: rows.find((r) => r.code === 'E')?.costPerRevenue ?? null,
    dCost: rows.find((r) => r.code === 'D')?.costPerRevenue ?? null,
    eRank: rankOf(rows, 'E'),
    rows,
  };
}

/** Structural parameter sweep (long run): elasticities and adoption, for a given calibrated base. */
export function structuralSweep(
  p: PaperParameters,
  grid: { elasticityKL: readonly number[]; elasticityAuto: readonly number[]; adoption: readonly number[] },
  opts: ComparisonOptions = {},
): RankPoint[] {
  const out: RankPoint[] = [];
  for (const eKL of grid.elasticityKL)
    for (const eA of grid.elasticityAuto)
      for (const a of grid.adoption) {
        const q = { ...p, elasticityKL: eKL, elasticityAuto: eA };
        if (!solveSteadyStateDual(withPolicy({ ...q, adoption: a }, 'none', 0)).ok) continue;
        // Each re-parameterised economy is compared against ITS OWN zero-adoption SS/Y (other calibrated
        // parameters held fixed); reusing the base target would mix two different economies.
        const own = solveSteadyStateDual(withPolicy({ ...q, adoption: 0 }, 'none', 0));
        if (!own.ok) continue;
        out.push(
          rankPoint(
            `ε_KL=${eKL}, σ_auto=${eA}, adoption=${a}`,
            comparePolicies(q, a, { ...opts, target: own.ssToGdp }),
          ),
        );
      }
  return out;
}

/**
 * Capital mobility: compare instruments with capital FIXED at the pre-reform level (short run)
 * against the long run (capital supply perfectly elastic through the Euler equations).
 */
export function shortRunComparison(
  p: PaperParameters,
  adoption: number,
  target: number,
  schemes?: readonly ActiveScheme[],
): PolicyOutcome[] {
  const pre = solveSteadyStateDual(withPolicy({ ...p, adoption }, 'none', 0));
  if (!pre.ok) return [];
  const fixed = { K: pre.levels.K, D: pre.levels.D };
  const list = (schemes ?? [
    'robotIncome',
    'robotInvestment',
    'robotSS',
    'valueAdded',
    'capitalReturnLevy',
  ]) as ActiveScheme[];
  return comparePolicies(p, adoption, {
    target,
    schemes: list,
    solver: (q, o) => solveShortRun(q, fixed, o),
  });
}

// ------------------------------------------------------------------ SBS-cell scenarios (heterogeneity)

export const SBS_SECTIONS = ['C', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'] as const;
export const SIZE_CLASSES = ['0-9', '10-19', '20-49', '50-249', 'GE250'] as const;

export interface SectorScenarioRow {
  readonly nace: string;
  readonly valueAddedM: number | null;
  readonly labourShare: number | null;
  /** Gross operating surplus / value added (sector total). */
  readonly gosShare: number | null;
  /** E contribution as a share of the sector's gross operating surplus (low-margin exposure). */
  readonly eShareOfGos: number | null;
  /** Share of sector VA in firms at or above the SME threshold (E coverage if SMEs are exempt). */
  readonly vaShareAboveThreshold: number | null;
  /** F regime vs the generic 50% benchmark and vs the sector's own benchmark. */
  readonly fGeneric: 'binding' | 'non-binding' | 'n/a';
  readonly year: string;
  readonly note: string;
}

const sizeIndex = (s: string) => SIZE_CLASSES.indexOf(s as (typeof SIZE_CLASSES)[number]);

/**
 * Sector table from SBS (business economy only; NOT national revenue): exposure of E relative to
 * operating surplus, VA coverage under an SME threshold, and F's regime under the generic benchmark.
 * Size-class VA cells marked confidential are excluded and reported in `note`.
 */
export function sbsSectorScenario(
  eRate: number,
  smeThreshold: (typeof SIZE_CLASSES)[number],
  year = '2024',
  fBenchmark = 0.5,
): SectorScenarioRow[] {
  return SBS_SECTIONS.map((nace) => {
    const va = sbsCell('AV_MEUR', nace, 'TOTAL', year);
    const gos = sbsCell('GOS_MEUR', nace, 'TOTAL', year);
    const ls = sectorLabourShare(nace, year);
    let above = 0;
    let known = 0;
    const missing: string[] = [];
    for (const s of SIZE_CLASSES) {
      const c = sbsCell('AV_MEUR', nace, s, year);
      if (c.value === null) {
        missing.push(`${s} ${c.status}`);
        continue;
      }
      known += c.value;
      if (sizeIndex(s) >= sizeIndex(smeThreshold)) above += c.value;
    }
    const gosShare = va.value && gos.value !== null ? gos.value / va.value : null;
    return {
      nace,
      valueAddedM: va.value,
      labourShare: ls.value,
      gosShare,
      eShareOfGos: gosShare && gosShare > 0 ? eRate / gosShare : null,
      vaShareAboveThreshold: known > 0 && missing.length === 0 ? above / known : null,
      fGeneric: ls.value === null ? 'n/a' : ls.value < fBenchmark ? 'binding' : 'non-binding',
      year,
      note: missing.length ? `size-class VA unavailable: ${missing.join(', ')}` : '',
    };
  });
}

/** VA coverage of the SBS business economy when firms below a size threshold are exempt. */
export function smeExemptionCoverage(
  threshold: (typeof SIZE_CLASSES)[number],
  year = '2024',
): { coverage: number | null; note: string } {
  let above = 0;
  let total = 0;
  for (const s of SIZE_CLASSES) {
    const c = sbsCell('AV_MEUR', 'B-S_X_O_S94', s, year);
    if (c.value === null) return { coverage: null, note: `size class ${s} ${c.status}` };
    total += c.value;
    if (sizeIndex(s) >= sizeIndex(threshold)) above += c.value;
  }
  return {
    coverage: above / total,
    note: 'share of SBS business-economy value added (excludes government, agriculture, households)',
  };
}

// ------------------------------------------------------------------ Level 3 behavioural sweeps

export function firmElasticitySweep(
  firm: FirmInputs,
  cfg: FirmPolicyConfig,
  rules: CyprusStatutoryRules,
  values: readonly number[],
): { elasticity: number; valueAdded: number; labourShare: number; excessProfit: number }[] {
  return values.map((e) => {
    const c = compareFirm(
      firm,
      {
        ...cfg,
        valueAdded: { ...cfg.valueAdded, baseElasticity: e },
        labourShare: { ...cfg.labourShare, baseElasticity: e },
        excessProfit: { ...cfg.excessProfit, shiftingSemiElasticity: 2 * e },
      },
      rules,
    );
    return {
      elasticity: e,
      valueAdded: c.valueAdded.contribution,
      labourShare: c.labourShare.contribution,
      excessProfit: c.excessProfit.contribution,
    };
  });
}

/**
 * Variant of a firm with a chosen EBIT margin (EBIT / GVA), obtained by adjusting depreciation only
 * (labour, GVA and turnover unchanged). Negative margins give loss-making firms.
 */
export function withOperatingMargin(
  firm: FirmInputs,
  rules: CyprusStatutoryRules,
  margin: number,
): FirmInputs {
  const a = firmAccounts(firm, rules);
  const depreciation = a.operatingSurplus - margin * a.gva;
  if (!(depreciation >= 0))
    throw new RangeError(
      `margin ${margin} not reachable by adjusting depreciation (would need negative depreciation)`,
    );
  return { ...firm, name: `${firm.name}, EBIT margin ${(margin * 100).toFixed(0)}%`, depreciation };
}
