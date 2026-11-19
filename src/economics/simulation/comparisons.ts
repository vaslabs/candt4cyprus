/**
 * Steady-state policy comparison (Level 2). For each instrument the rate is chosen so that SS/Y
 * returns to the target; outcomes are compared with the economy WITHOUT any new instrument at the
 * same adoption level. Long-run steady states only: no transition, no growth, no forecasts.
 */
import type { PaperParameters, SteadyStateResult } from '../paper/types';
import { solveSteadyStateDual } from '../paper/steadyState';
import {
  ALL_SCHEMES,
  DEFAULT_POLICY_CONFIG,
  POLICY_INFO,
  solveRequiredRate,
  withPolicy,
  type ActiveScheme,
  type PolicyConfig,
} from '../policies/registry';
import type { RequiredTaxOptions } from '../policies/robotTaxes';

type Ok = Extract<SteadyStateResult, { ok: true }>;

export interface PolicyOutcome {
  readonly scheme: ActiveScheme | 'none';
  readonly code: string;
  readonly status:
    'solved' | 'not-needed' | 'unattainable' | 'no-steady-state' | 'baseline' | 'baseline-missing';
  readonly rate: number | null;
  readonly ssToY: number | null;
  readonly Y: number | null;
  readonly C: number | null;
  readonly I: number | null;
  readonly L: number | null;
  readonly grossLabourShare: number | null;
  readonly netLabourShare: number | null;
  readonly grossCapitalShare: number | null;
  /** Contributions legally paid by employers/firms (employer SS + robot SS + E + F) / Y. */
  readonly employerBurden: number | null;
  /** Revenue of the new instrument / Y. */
  readonly instrumentRevenue: number | null;
  /** Percentage change vs the no-new-instrument economy at the same adoption. */
  readonly dY: number | null;
  readonly dC: number | null;
  readonly dI: number | null;
  readonly dL: number | null;
  /**
   * Steady-state consumption-equivalent welfare change vs the no-new-instrument economy:
   * λ with γ ln(1+λ) = U_policy − U_reference (log utility, eq. 19). Comparison of steady states,
   * not a transition welfare measure.
   */
  readonly welfareCE: number | null;
  /** −λ·C_ref / instrument revenue: steady-state welfare cost per unit of revenue raised. */
  readonly costPerRevenue: number | null;
}

const NULLS = {
  rate: null,
  ssToY: null,
  Y: null,
  C: null,
  I: null,
  L: null,
  grossLabourShare: null,
  netLabourShare: null,
  grossCapitalShare: null,
  employerBurden: null,
  instrumentRevenue: null,
  dY: null,
  dC: null,
  dI: null,
  dL: null,
  welfareCE: null,
  costPerRevenue: null,
} as const;

function utility(p: PaperParameters, r: Ok): number {
  return p.gamma * Math.log(r.levels.C) + (1 - p.gamma) * Math.log(1 - r.levels.L);
}

function describe(
  p: PaperParameters,
  scheme: ActiveScheme | 'none',
  rate: number | null,
  status: PolicyOutcome['status'],
  r: Ok,
  ref: Ok | null,
): PolicyOutcome {
  const g = r.government;
  const Y = r.levels.Y;
  const instrument =
    scheme === 'none'
      ? 0
      : scheme === 'robotIncome'
        ? g.robotIncomeTax
        : scheme === 'robotInvestment'
          ? g.robotInvestmentTax
          : scheme === 'robotSS'
            ? g.robotSS
            : scheme === 'valueAdded'
              ? g.valueAddedContribution
              : scheme === 'labourShare'
                ? g.labourShareContribution
                : g.excessProfitContribution;
  const pct = (a: number, b: number) => (a / b - 1) * 100;
  const lambda = ref ? Math.exp((utility(p, r) - utility(p, ref)) / p.gamma) - 1 : null;
  return {
    scheme,
    code: scheme === 'none' ? 'A' : POLICY_INFO[scheme].code,
    status,
    rate,
    ssToY: r.ssToGdp,
    Y,
    C: r.levels.C,
    I: r.levels.I,
    L: r.levels.L,
    grossLabourShare: r.shares.grossLabour,
    netLabourShare: r.shares.netLabour,
    grossCapitalShare: r.shares.grossTraditionalCapital + r.shares.grossAutonomousCapital,
    employerBurden: (g.employerSS + g.robotSS + g.valueAddedContribution + g.labourShareContribution) / Y,
    instrumentRevenue: instrument / Y,
    dY: ref ? pct(Y, ref.levels.Y) : null,
    dC: ref ? pct(r.levels.C, ref.levels.C) : null,
    dI: ref ? pct(r.levels.I, ref.levels.I) : null,
    dL: ref ? pct(r.levels.L, ref.levels.L) : null,
    welfareCE: lambda,
    costPerRevenue: ref && lambda !== null && instrument > 0 ? (-lambda * ref.levels.C) / instrument : null,
  };
}

export interface ComparisonOptions extends RequiredTaxOptions {
  readonly config?: PolicyConfig;
  readonly schemes?: readonly ActiveScheme[];
}

/** Compare all instruments at one adoption level (target fixed by the caller or adoption-0 baseline). */
export function comparePolicies(
  base: PaperParameters,
  adoption: number,
  opts: ComparisonOptions = {},
): PolicyOutcome[] {
  const cfg = opts.config ?? DEFAULT_POLICY_CONFIG;
  const p = { ...base, adoption };
  const solver = opts.solver ?? solveSteadyStateDual;
  const refR = solver(withPolicy(p, 'none', 0, cfg), opts);
  const ref = refR.ok ? refR : null;
  const out: PolicyOutcome[] = [
    ref
      ? describe(p, 'none', 0, 'baseline', ref, ref)
      : { scheme: 'none', code: 'A', status: 'baseline-missing', ...NULLS },
  ];
  for (const scheme of opts.schemes ?? ALL_SCHEMES) {
    const r = solveRequiredRate(p, scheme, cfg, opts);
    if (r.status === 'solved' || r.status === 'not-needed') {
      out.push(describe(p, scheme, r.rate, r.status, r.steadyState, ref));
    } else {
      out.push({ scheme, code: POLICY_INFO[scheme].code, status: r.status, ...NULLS });
    }
  }
  return out;
}
