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
  /** Capital accumulation: traditional and autonomous capital stocks. */
  readonly K: number | null;
  readonly D: number | null;
  readonly dK: number | null;
  /** Policy F regime (binding / non-binding / kink) where relevant. */
  readonly labourShareRegime: string | null;
  /** Policy G revenue split: on genuine rents vs on capital returns above the allowance (/ Y). */
  readonly gOnRents: number | null;
  readonly gOnCapitalReturns: number | null;
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
  K: null,
  D: null,
  dK: null,
  labourShareRegime: null,
  gOnRents: null,
  gOnCapitalReturns: null,
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
                : g.excessProfitContribution; // G and G′ share the same revenue line
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
    K: r.levels.K,
    D: r.levels.D,
    dK: ref ? pct(r.levels.K, ref.levels.K) : null,
    labourShareRegime: r.diagnostics.regimes.labourShare,
    gOnRents: g.excessProfitOnRents / Y,
    gOnCapitalReturns: g.excessProfitOnCapitalReturns / Y,
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

/**
 * Comparison objective.
 *  'restoreTarget' (default): the instrument raises additional SS revenue until SS/Y returns to the
 *    target (the zero-adoption ratio = observed 2023 Fund contributions in the Cyprus calibration).
 *  'revenueNeutralSwap': the instrument REPLACES a share ψ of employer SS and is set to keep SS/Y equal
 *    to its pre-reform value at the same adoption level (no additional revenue).
 */
export type ComparisonObjective =
  { readonly kind: 'restoreTarget' } | { readonly kind: 'revenueNeutralSwap'; readonly replacement: number };

export interface ComparisonOptions extends RequiredTaxOptions {
  readonly config?: PolicyConfig;
  readonly schemes?: readonly ActiveScheme[];
  readonly objective?: ComparisonObjective;
}

/** Compare all instruments at one adoption level (target fixed by the caller or adoption-0 baseline). */
export function comparePolicies(
  base: PaperParameters,
  adoption: number,
  opts: ComparisonOptions = {},
): PolicyOutcome[] {
  const objective = opts.objective ?? { kind: 'restoreTarget' };
  const baseCfg = opts.config ?? DEFAULT_POLICY_CONFIG;
  const cfg: PolicyConfig =
    objective.kind === 'revenueNeutralSwap'
      ? { ...baseCfg, payrollReplacement: objective.replacement }
      : baseCfg;
  const p = { ...base, adoption };
  const solver = opts.solver ?? solveSteadyStateDual;
  // Reference: the economy without any new instrument and without payroll replacement.
  const refR = solver(withPolicy(p, 'none', 0, { ...cfg, payrollReplacement: 0 }), opts);
  const ref = refR.ok ? refR : null;
  if (objective.kind === 'revenueNeutralSwap') {
    if (!ref) return [{ scheme: 'none', code: 'A', status: 'baseline-missing', ...NULLS }];
    opts = { ...opts, target: ref.ssToGdp };
  }
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
