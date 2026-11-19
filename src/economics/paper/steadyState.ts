/**
 * Solver 1: semi-analytic steady state via the dual (unit-cost) reduction. See MODEL_SPEC §5.
 *
 *  1. Household Euler equations fix R_k, R_d (prices of capital services).
 *  2. Zero profit with output price 1 fixes the remaining factor price (labour cost p_L) through
 *     the nested unit-cost function; existence ⇔ every CES stage has positive slack.
 *  3. Shephard's lemma gives all inputs per unit of output.
 *  4. Labour supply (24) is linear in L given those ratios, which fixes the scale.
 */
import { capitalReturns, hoursFromLabourSupply } from './households';
import { technologyModel } from './technology';
import { eq33Revenue, factorShares, governmentAccounts, householdBudgetResidual } from './government';
import type {
  ConvergenceInfo,
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
): SteadyStateResult {
  const government = governmentAccounts(p, levels);
  const shares = factorShares(p, levels);
  const t = p.taxes;
  const labourCostShare = shares.grossLabour * (1 + t.employerSS);
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
      eulerResidual:
        labourCostShare +
        shares.grossTraditionalCapital +
        (1 + t.robotSS) * shares.grossAutonomousCapital -
        1,
      resourceResidual: (levels.C + levels.I - levels.Y) / levels.Y,
      householdBudgetResidual: householdBudgetResidual(p, levels, eq33Revenue(p, levels)),
    },
    meta,
  };
}

const noSteadyState = (message: string): ConvergenceInfo => ({
  status: 'no-steady-state',
  residualNorm: NaN,
  iterations: 0,
  jacobianCondition: NaN,
  message,
});

export function solveSteadyStateDual(p: PaperParameters, opts: SolveOptions = {}): SteadyStateResult {
  const returns = capitalReturns(p);
  if (!returns.ok) {
    return {
      ok: false,
      reason: 'invalid-capital-returns',
      detail: returns.detail,
      meta: makeMeta(p, 'dual', noSteadyState(returns.detail), opts),
    };
  }
  const { Rk, Rd } = returns;
  const pD = (1 + p.taxes.robotSS) * Rd;
  const tech = technologyModel(p);
  const dual = tech.dual(p, Rk, pD);
  if (!dual.ok && dual.failure.reason === 'price-out-of-range') {
    const detail = `Steady state exists (slack ${dual.failure.slack}) but the ${dual.stage}-stage price is outside double range.`;
    const conv: ConvergenceInfo = { ...noSteadyState(detail), status: 'failed' };
    return { ok: false, reason: 'numerical-range', detail, meta: makeMeta(p, 'dual', conv, opts) };
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
      reason,
      detail,
      slack: dual.failure.slack,
      meta: makeMeta(p, 'dual', noSteadyState(detail), opts),
    };
  }

  const { ky, dy, ly, xy } = dual.ratios;
  const W = dual.pL / (1 + p.taxes.employerSS);
  const cy = 1 - p.deltaK * ky - p.deltaD * dy;
  if (!(cy > 0)) {
    const detail = `Steady-state replacement investment exceeds output (C/Y = ${cy}).`;
    return {
      ok: false,
      reason: 'non-positive-consumption',
      detail,
      slack: cy,
      meta: makeMeta(p, 'dual', noSteadyState(detail), opts),
    };
  }
  const L = hoursFromLabourSupply(p, W, cy, ly);
  const Y = L / ly;
  const K = ky * Y;
  const D = dy * Y;
  const Ik = p.deltaK * K;
  const Id = p.deltaD * D;
  const levels: SteadyStateLevels = { Y, C: cy * Y, K, D, L, X: xy * Y, W, I: Ik + Id, Rk, Rd, Ik, Id };
  const convergence: ConvergenceInfo = {
    status: 'analytic',
    residualNorm: NaN,
    iterations: 0,
    jacobianCondition: NaN,
    message: 'Closed-form dual reduction (no iteration).',
  };
  return assembleResult(p, levels, makeMeta(p, 'dual', convergence, opts), {
    outer: dual.outerSlack,
    inner: dual.innerSlack,
  });
}

/**
 * Existence margin used to locate the boundary: min over CES stage slacks and C/Y.
 * > 0 ⇔ a finite steady state exists. −Infinity if capital returns are undefined.
 */
export function existenceMargin(p: PaperParameters): number {
  const returns = capitalReturns(p);
  if (!returns.ok) return -Infinity;
  const pD = (1 + p.taxes.robotSS) * returns.Rd;
  const dual = technologyModel(p).dual(p, returns.Rk, pD);
  if (!dual.ok) return dual.failure.slack;
  const cy = 1 - p.deltaK * dual.ratios.ky - p.deltaD * dual.ratios.dy;
  return Math.min(dual.outerSlack, dual.innerSlack, cy);
}
