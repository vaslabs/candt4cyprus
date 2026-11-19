/**
 * The paper's three automation-tax schemes (Casas & Torres 2026, §3.3 and §5), and the
 * endogenous rate that keeps social-security contributions at a target share of GDP.
 *
 *   Scheme 1 'robotIncome'      τ^d   base (R_d − δ_d)·D   (on top of τ^k; eq. 20, 33)
 *   Scheme 2 'robotInvestment'  τ^id  base I_d = δ_d·D    (ad valorem on robot purchases)
 *   Scheme 3 'robotSS'          τ^ssz base R_d·D          (employer contribution on robot rental)
 *
 * The three bases are different and must not be confused: a 20% robot SS contribution is
 * 20% of the rental value of robots used (R_d·D), not 20% of revenue, profit or output.
 * Only one scheme is active at a time (paper §3.3).
 */
import { brent, scanBrackets } from '../core/numericalSolver';
import { solveSteadyStateDual, type SolveOptions } from '../paper/steadyState';
import type { PaperParameters, SteadyStateResult, TaxRates } from '../paper/types';

export type RobotTaxScheme = 'none' | 'robotIncome' | 'robotInvestment' | 'robotSS';
export const ROBOT_TAX_SCHEMES = ['robotIncome', 'robotInvestment', 'robotSS'] as const;

export const SCHEME_INFO: Record<RobotTaxScheme, { symbol: string; label: string; base: string }> = {
  none: { symbol: '—', label: 'No specific taxation of autonomous capital', base: '—' },
  robotIncome: { symbol: 'τ^d', label: 'Autonomous-capital income tax (scheme 1)', base: '(R_d − δ_d)·D' },
  robotInvestment: {
    symbol: 'τ^id',
    label: 'Ad-valorem tax on autonomous-capital investment (scheme 2)',
    base: 'I_d',
  },
  robotSS: {
    symbol: 'τ^ssz',
    label: 'Employer social-security contribution on autonomous capital (scheme 3)',
    base: 'R_d·D',
  },
};

/** Set exactly one robot tax (all others zero). */
export function withRobotTax(p: PaperParameters, scheme: RobotTaxScheme, rate: number): PaperParameters {
  const taxes: TaxRates = { ...p.taxes, robotIncome: 0, robotInvestment: 0, robotSS: 0 };
  return { ...p, taxes: scheme === 'none' ? taxes : { ...taxes, [scheme]: rate } };
}

/**
 * Upper end of the scanned rate interval. τ^d must keep τ^k + τ^d < 1 (eq. 26); the other two are
 * capped at 500%. A band of width PROHIBITIVE_BAND below the τ^d cap is excluded: as τ^k + τ^d → 1
 * robots are taxed out of existence (R_d → ∞, D → 0), the economy returns to the no-automation
 * baseline, and SS/Y approaches the target only asymptotically. A "root" there is an artefact of
 * the limit, not a policy rate (MODEL_DEVIATIONS D6).
 */
export const PROHIBITIVE_BAND = 1e-4;
export function rateUpperBound(p: PaperParameters, scheme: RobotTaxScheme): number {
  if (scheme === 'robotIncome') return 1 - p.taxes.capital - PROHIBITIVE_BAND;
  return 5;
}

/** SS/Y of the no-automation, no-robot-tax economy: the paper's policy target (Fig. 1 intercept). */
export function baselineSsTarget(p: PaperParameters): number {
  const r = solveSteadyStateDual(withRobotTax({ ...p, adoption: 0 }, 'none', 0));
  if (!r.ok) throw new Error(`No baseline steady state at adoption 0: ${r.detail}`);
  return r.ssToGdp;
}

export type RequiredTaxResult =
  | {
      readonly status: 'solved';
      readonly scheme: RobotTaxScheme;
      readonly rate: number;
      readonly target: number;
      /** Further roots of SS/Y(τ) = target above the reported (smallest) one (MODEL_DEVIATIONS D6). */
      readonly additionalRoots: readonly number[];
      /**
       * False when the untaxed economy has no finite steady state at this adoption level, i.e. a
       * robot tax is needed for a steady state to exist at all. The root may then lie on a
       * declining (over-financing → target) branch; interpret with care.
       */
      readonly untaxedSteadyStateExists: boolean;
      readonly steadyState: Extract<SteadyStateResult, { ok: true }>;
    }
  | {
      /** SS/Y already ≥ target without any robot tax. */
      readonly status: 'not-needed';
      readonly scheme: RobotTaxScheme;
      readonly rate: 0;
      readonly target: number;
      readonly steadyState: Extract<SteadyStateResult, { ok: true }>;
    }
  | {
      /** No admissible rate reaches the target; reports the best SS/Y found on the scan grid. */
      readonly status: 'unattainable';
      readonly scheme: RobotTaxScheme;
      readonly target: number;
      readonly maxSsToGdp: number;
      readonly atRate: number;
    }
  | {
      /** No finite steady state for any scanned rate. */
      readonly status: 'no-steady-state';
      readonly scheme: RobotTaxScheme;
      readonly target: number;
      readonly detail: string;
    };

export interface RequiredTaxOptions extends SolveOptions {
  /** Target SS/Y. Default: baselineSsTarget(p). */
  readonly target?: number;
  /** Grid intervals for root bracketing over [0, upper]. */
  readonly scanIntervals?: number;
}

/**
 * Smallest τ ≥ 0 with SS(τ)/Y(τ) = target for the given scheme, holding everything else fixed.
 * Robot taxes raise the cost of autonomous capital, so a taxed steady state can exist at adoption
 * levels where the untaxed one does not; points without a steady state are skipped by the scan,
 * never interpolated.
 */
export function solveRequiredRobotTax(
  p: PaperParameters,
  scheme: Exclude<RobotTaxScheme, 'none'>,
  opts: RequiredTaxOptions = {},
): RequiredTaxResult {
  const target = opts.target ?? baselineSsTarget(p);
  const solve = (tau: number) => solveSteadyStateDual(withRobotTax(p, scheme, tau), opts);
  const gap = (tau: number) => {
    const r = solve(tau);
    return r.ok ? r.ssToGdp - target : NaN;
  };

  const r0 = solve(0);
  if (r0.ok && r0.ssToGdp >= target) {
    return { status: 'not-needed', scheme, rate: 0, target, steadyState: r0 };
  }
  const upper = rateUpperBound(p, scheme);
  const n = opts.scanIntervals ?? 400;
  const brackets = scanBrackets(gap, 0, upper, n);
  const first = brackets[0];
  if (!first) {
    let best = -Infinity;
    let atRate = NaN;
    for (let i = 0; i <= n; i++) {
      const tau = (upper * i) / n;
      const g = gap(tau);
      if (Number.isFinite(g) && g + target > best) {
        best = g + target;
        atRate = tau;
      }
    }
    if (!Number.isFinite(best)) {
      return {
        status: 'no-steady-state',
        scheme,
        target,
        detail: 'No finite steady state at any scanned rate.',
      };
    }
    return { status: 'unattainable', scheme, target, maxSsToGdp: best, atRate };
  }
  const refine = (b: { lo: number; hi: number }) => {
    if (b.lo === b.hi) return b.lo;
    const r = brent(gap, b.lo, b.hi, { xTolerance: 1e-13 });
    return r.status === 'converged' ? r.root : NaN;
  };
  const rate = refine(first);
  const ss = solve(rate);
  if (!Number.isFinite(rate) || !ss.ok) {
    return { status: 'no-steady-state', scheme, target, detail: 'Root refinement failed inside a bracket.' };
  }
  return {
    status: 'solved',
    scheme,
    rate,
    target,
    additionalRoots: brackets.slice(1).map(refine).filter(Number.isFinite),
    untaxedSteadyStateExists: r0.ok,
    steadyState: ss,
  };
}

export interface SweepPoint {
  readonly adoption: number;
  readonly scheme: RobotTaxScheme;
  readonly rate: number | null;
  readonly status: RequiredTaxResult['status'] | 'baseline';
  readonly result: SteadyStateResult | null;
  /** Shares of SS paid by labour and robot sources (Fig. 5). */
  readonly labourSourceShare: number | null;
  readonly robotSourceShare: number | null;
}

/**
 * Adoption sweep for one scheme with the endogenous rate (or the untaxed economy for 'none').
 * The target is fixed once from the adoption-0 baseline, as in the paper.
 */
export function sweepAdoption(
  p: PaperParameters,
  scheme: RobotTaxScheme,
  adoptions: readonly number[],
  opts: RequiredTaxOptions = {},
): SweepPoint[] {
  const target = opts.target ?? baselineSsTarget(p);
  return adoptions.map((adoption) => {
    const pa = { ...p, adoption };
    if (scheme === 'none') {
      const r = solveSteadyStateDual(withRobotTax(pa, 'none', 0), opts);
      return point(adoption, scheme, 0, 'baseline', r);
    }
    const req = solveRequiredRobotTax(pa, scheme, { ...opts, target });
    if (req.status === 'solved' || req.status === 'not-needed') {
      return point(adoption, scheme, req.rate, req.status, req.steadyState);
    }
    return {
      adoption,
      scheme,
      rate: null,
      status: req.status,
      result: null,
      labourSourceShare: null,
      robotSourceShare: null,
    };
  });
}

function point(
  adoption: number,
  scheme: RobotTaxScheme,
  rate: number,
  status: SweepPoint['status'],
  r: SteadyStateResult,
): SweepPoint {
  if (!r.ok)
    return {
      adoption,
      scheme,
      rate: null,
      status,
      result: r,
      labourSourceShare: null,
      robotSourceShare: null,
    };
  const g = r.government;
  return {
    adoption,
    scheme,
    rate,
    status,
    result: r,
    labourSourceShare: g.ssLabour / g.ssTotal,
    robotSourceShare: g.ssRobot / g.ssTotal,
  };
}
