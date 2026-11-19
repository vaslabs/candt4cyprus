/**
 * Solver 1: semi-analytic steady state via the dual (unit-cost) reduction. See MODEL_SPEC §5.
 *
 *  1. Household Euler equations fix R_k, R_d (prices of capital services).
 *  2. Zero profit with output price 1 fixes the remaining factor price (labour cost p_L) through
 *     the nested unit-cost function; existence ⇔ every CES stage has positive slack.
 *  3. Shephard's lemma gives all inputs per unit of output.
 *  4. Labour supply (24) is linear in L given those ratios, which fixes the scale.
 */
import { brent } from '../core/numericalSolver';
import { capitalReturns, hoursFromLabourSupply } from './households';
import { technologyModel } from './technology';
import {
  eq33Revenue,
  factorShares,
  governmentAccounts,
  householdBudgetResidual,
  policyRevenues,
} from './government';
import type {
  ConvergenceInfo,
  LabourShareRegime,
  PolicyRegimes,
  PaperParameters,
  RunMetadata,
  SolverName,
  SteadyStateLevels,
  SteadyStateResult,
} from './types';

export interface SolveOptions {
  readonly calibrationPreset?: string;
}

export function makeMeta(
  p: PaperParameters,
  solver: SolverName,
  convergence: ConvergenceInfo,
  opts: SolveOptions,
): RunMetadata {
  return {
    technology: p.technology,
    equationVariant: p.variant,
    calibrationPreset: opts.calibrationPreset ?? 'custom',
    solver,
    convergence,
  };
}

/** Assemble accounts, shares and accounting diagnostics for a candidate steady state. */
export function assembleResult(
  p: PaperParameters,
  levels: SteadyStateLevels,
  meta: RunMetadata,
  slacks: { outer: number; inner: number },
  regimes: PolicyRegimes = INACTIVE_REGIMES,
  firmNetPrice = 1,
): SteadyStateResult {
  const government = governmentAccounts(p, levels);
  const shares = factorShares(p, levels);
  const t = p.taxes;
  const labourCostShare = shares.grossLabour * (1 + t.employerSS);
  const pol = policyRevenues(p, levels);
  return {
    ok: true,
    levels,
    government,
    shares,
    ssToGdp: government.ssTotal / levels.Y,
    diagnostics: {
      outerSlack: slacks.outer,
      innerSlack: slacks.inner,
      labourCostShare,
      // Zero profit: factor payments + contributions paid by firms (E, F) exhaust output.
      eulerResidual:
        labourCostShare +
        shares.grossTraditionalCapital +
        (1 + t.robotSS) * shares.grossAutonomousCapital +
        (pol.valueAdded + pol.labourShare) / levels.Y -
        1,
      resourceResidual: (levels.C + levels.I - levels.Y) / levels.Y,
      householdBudgetResidual: householdBudgetResidual(p, levels, eq33Revenue(p, levels)),
      regimes,
      firmNetPrice,
    },
    meta,
  };
}

export const INACTIVE_REGIMES: PolicyRegimes = {
  labourShare: 'inactive',
  excessProfitK: 'inactive',
  excessProfitD: 'inactive',
};

/**
 * Firm-side wedges from policies E and F. `lambda` ∈ [0,1] is the active fraction of the
 * labour-share contribution's marginal incentive (1 = binding, 0 = non-binding, interior = kink).
 *   net output price p = 1 − τ_E c_E − λ τ_F c_F s̄
 *   labour-cost multiplier m = (1+τ^sse)(1 − λ τ_F c_F)
 */
export function firmWedges(p: PaperParameters, lambda: number): { price: number; labourMultiplier: number } {
  const E = p.extensions?.valueAdded;
  const F = p.extensions?.labourShare;
  const e = E ? E.rate * E.coverage : 0;
  const f = F ? lambda * F.rate * F.coverage : 0;
  return { price: 1 - e - f * (F?.benchmark ?? 0), labourMultiplier: (1 + p.taxes.employerSS) * (1 - f) };
}

const noSteadyState = (message: string): ConvergenceInfo => ({
  status: 'no-steady-state',
  residualNorm: NaN,
  iterations: 0,
  jacobianCondition: NaN,
  message,
});

type CoreOutcome =
  | {
      readonly ok: true;
      readonly levels: SteadyStateLevels;
      readonly slacks: { outer: number; inner: number };
      readonly labourCostShare: number;
    }
  | { readonly ok: false; readonly failure: Extract<SteadyStateResult, { ok: false }> };

function solveCore(
  p: PaperParameters,
  lambda: number,
  opts: SolveOptions,
): CoreOutcome & {
  returns?: { excessProfitK: PolicyRegimes['excessProfitK']; excessProfitD: PolicyRegimes['excessProfitD'] };
} {
  const returns = capitalReturns(p);
  if (!returns.ok) {
    return {
      ok: false,
      failure: {
        ok: false,
        reason: 'invalid-capital-returns',
        detail: returns.detail,
        meta: makeMeta(p, 'dual', noSteadyState(returns.detail), opts),
      },
    };
  }
  const { Rk, Rd } = returns;
  const pD = (1 + p.taxes.robotSS) * Rd;
  const { price, labourMultiplier } = firmWedges(p, lambda);
  if (!(price > 0)) {
    const detail = `Firm net output price ${price} ≤ 0 (contribution rates too high).`;
    return {
      ok: false,
      failure: {
        ok: false,
        reason: 'stage-infeasible',
        detail,
        meta: makeMeta(p, 'dual', noSteadyState(detail), opts),
      },
    };
  }
  const tech = technologyModel(p);
  // CRS: c(R_k, p_D, m·W) = price  ⇔  c(R_k/price, p_D/price, m·W/price) = 1.
  const dual = tech.dual(p, Rk / price, pD / price);
  if (!dual.ok && dual.failure.reason === 'price-out-of-range') {
    const detail = `Steady state exists (slack ${dual.failure.slack}) but the ${dual.stage}-stage price is outside double range.`;
    const conv: ConvergenceInfo = { ...noSteadyState(detail), status: 'failed' };
    return {
      ok: false,
      failure: { ok: false, reason: 'numerical-range', detail, meta: makeMeta(p, 'dual', conv, opts) },
    };
  }
  if (!dual.ok) {
    // Input 1 of the failing stage is D in Tech A's inner nest and in Tech B's outer nest.
    const dIsInput1 =
      (p.technology === 'A' && dual.stage === 'inner') || (p.technology === 'B' && dual.stage === 'outer');
    const reason =
      dIsInput1 && dual.failure.reason === 'input1-too-cheap' ? 'robots-dominate' : 'stage-infeasible';
    const detail =
      reason === 'robots-dominate'
        ? `No finite steady state: autonomous capital alone can produce at unit cost below the zero-profit price ` +
          `(${dual.stage} CES stage slack ${dual.failure.slack.toExponential(3)} ≤ 0). The economy is AK-type.`
        : `No finite steady state: ${dual.stage} CES stage infeasible (${dual.failure.reason}, slack ${dual.failure.slack}).`;
    return {
      ok: false,
      failure: {
        ok: false,
        reason,
        detail,
        slack: dual.failure.slack,
        meta: makeMeta(p, 'dual', noSteadyState(detail), opts),
      },
    };
  }
  const { ky, dy, ly, xy } = dual.ratios;
  const W = (dual.pL * price) / labourMultiplier;
  const cy = 1 - p.deltaK * ky - p.deltaD * dy;
  if (!(cy > 0)) {
    const detail = `Steady-state replacement investment exceeds output (C/Y = ${cy}).`;
    return {
      ok: false,
      failure: {
        ok: false,
        reason: 'non-positive-consumption',
        detail,
        slack: cy,
        meta: makeMeta(p, 'dual', noSteadyState(detail), opts),
      },
    };
  }
  const L = hoursFromLabourSupply(p, W, cy, ly);
  const Y = L / ly;
  const K = ky * Y;
  const D = dy * Y;
  const Ik = p.deltaK * K;
  const Id = p.deltaD * D;
  return {
    ok: true,
    levels: { Y, C: cy * Y, K, D, L, X: xy * Y, W, I: Ik + Id, Rk, Rd, Ik, Id },
    slacks: { outer: dual.outerSlack, inner: dual.innerSlack },
    labourCostShare: (1 + p.taxes.employerSS) * W * ly,
    returns: { excessProfitK: returns.excessProfitK, excessProfitD: returns.excessProfitD },
  };
}

/**
 * Resolve the labour-share policy regime. With labour cost share s_L(λ) at activity λ:
 *   binding (λ=1) if s_L(1) < s̄; non-binding (λ=0) if s_L(0) ≥ s̄; otherwise a kink where firms
 *   bunch exactly at s̄, found by Brent on s_L(λ) − s̄. If BOTH corner regimes are self-consistent the
 *   result is reported as multiple equilibria (never silently chosen).
 */
function resolveLabourShare(
  p: PaperParameters,
  opts: SolveOptions,
): { lambda: number; regime: LabourShareRegime } | { failure: Extract<SteadyStateResult, { ok: false }> } {
  const F = p.extensions?.labourShare;
  if (!F || F.rate === 0 || F.coverage === 0) return { lambda: 0, regime: 'inactive' };
  const at = (lambda: number) => solveCore(p, lambda, opts);
  const b = at(1);
  const n = at(0);
  const bindingOk = b.ok && b.labourCostShare < F.benchmark;
  const nonBindingOk = n.ok && n.labourCostShare >= F.benchmark;
  if (bindingOk && nonBindingOk) {
    const detail = `Labour-share contribution admits two self-consistent regimes (s_L = ${b.ok ? b.labourCostShare.toFixed(4) : '?'} binding, ${n.ok ? n.labourCostShare.toFixed(4) : '?'} non-binding; s̄ = ${F.benchmark}).`;
    return {
      failure: {
        ok: false,
        reason: 'solver-failed',
        detail: `multiple equilibria: ${detail}`,
        meta: makeMeta(p, 'dual', { ...noSteadyState(detail), status: 'failed' }, opts),
      },
    };
  }
  if (bindingOk) return { lambda: 1, regime: 'binding' };
  if (nonBindingOk) return { lambda: 0, regime: 'non-binding' };
  if (!b.ok && !n.ok) return { failure: n.failure };
  const g = (lambda: number) => {
    const r = at(lambda);
    return r.ok ? r.labourCostShare - F.benchmark : NaN;
  };
  const root = brent(g, 0, 1, { xTolerance: 1e-14 });
  if (root.status !== 'converged') {
    const detail = `labour-share kink could not be resolved (${root.status})`;
    return {
      failure: {
        ok: false,
        reason: 'solver-failed',
        detail,
        meta: makeMeta(p, 'dual', { ...noSteadyState(detail), status: 'failed' }, opts),
      },
    };
  }
  return { lambda: root.root, regime: 'kink' };
}

export function solveSteadyStateDual(p: PaperParameters, opts: SolveOptions = {}): SteadyStateResult {
  const resolved = resolveLabourShare(p, opts);
  if ('failure' in resolved) return resolved.failure;
  const core = solveCore(p, resolved.lambda, opts);
  if (!core.ok) return core.failure;
  const convergence: ConvergenceInfo = {
    status: 'analytic',
    residualNorm: NaN,
    iterations: 0,
    jacobianCondition: NaN,
    message:
      resolved.regime === 'kink'
        ? 'Closed-form dual reduction with a 1-D kink search (Brent).'
        : 'Closed-form dual reduction (no iteration).',
  };
  const regimes: PolicyRegimes = {
    labourShare: resolved.regime,
    excessProfitK: core.returns?.excessProfitK ?? 'inactive',
    excessProfitD: core.returns?.excessProfitD ?? 'inactive',
  };
  return assembleResult(
    p,
    core.levels,
    makeMeta(p, 'dual', convergence, opts),
    core.slacks,
    regimes,
    firmWedges(p, resolved.lambda).price,
  );
}

/**
 * Existence margin used to locate the boundary: min over CES stage slacks and C/Y.
 * > 0 ⇔ a finite steady state exists. −Infinity if capital returns are undefined.
 */
export function existenceMargin(p: PaperParameters): number {
  const returns = capitalReturns(p);
  if (!returns.ok) return -Infinity;
  const resolved = resolveLabourShare(p, {});
  const { price } = firmWedges(p, 'failure' in resolved ? 0 : resolved.lambda);
  if (!(price > 0)) return -Infinity;
  const pD = (1 + p.taxes.robotSS) * returns.Rd;
  const dual = technologyModel(p).dual(p, returns.Rk / price, pD / price);
  if (!dual.ok) return dual.failure.slack;
  const cy = 1 - p.deltaK * dual.ratios.ky - p.deltaD * dual.ratios.dy;
  return Math.min(dual.outerSlack, dual.innerSlack, cy);
}
