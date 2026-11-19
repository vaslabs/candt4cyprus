/**
 * Effect of the statutory SI ceiling on the effective contribution rate when wages change.
 *
 * The Level 2 model uses an effective rate τ_eff (calibrated top-down). The share of the wage bill
 * below the per-person ceiling depends on wages relative to the ceiling:
 *  - 'indexed': the ceiling moves with wages (Cyprus adjusts it annually), so the insurable share,
 *    and hence τ_eff, stays constant. The fixed-rate result is exact under this assumption.
 *  - 'fixedNominal': the ceiling stays at its 2026 euro value while steady-state wages scale by
 *    k = W/W₀. Every earnings band is scaled by k (relative distribution unchanged, an ASSUMPTION),
 *    and τ_eff(k) = τ_eff,0 · s(k)/s(1). Because W itself depends on τ_eff, this is a fixed point,
 *    solved with Brent's method.
 * When feedback is not applied, results carry ceilingTreatment = 'fixed-effective-rate
 * (approximation)'.
 */
import { brent } from '../core/numericalSolver';
import { solveSteadyStateDual, type SolveOptions } from '../paper/steadyState';
import type { PaperParameters, SteadyStateResult } from '../paper/types';
import { insurableShareFromBands, type EarningsBand } from './earningsDistribution';

export type CeilingTreatment = 'indexed' | 'fixedNominal' | 'fixed-effective-rate (approximation)';

export interface CeilingContext {
  readonly treatment: CeilingTreatment;
  /** Baseline (calibration) wage W₀ in model units. */
  readonly baselineWage: number;
  readonly bands: readonly EarningsBand[];
  readonly meanMonthly: number;
  readonly monthlyCeiling: number;
}

export function insurableShareAtWageScale(ctx: CeilingContext, k: number): number {
  const scaled = ctx.bands.map((b) => ({
    from: b.from * k,
    to: b.to === null ? null : b.to * k,
    share: b.share,
  }));
  return insurableShareFromBands(scaled, ctx.meanMonthly * k, ctx.monthlyCeiling);
}

export type CeilingSolveResult = SteadyStateResult & {
  readonly ceiling: {
    readonly treatment: CeilingTreatment;
    readonly wageScale: number;
    readonly effectiveRate: number;
    readonly insurableShare: number;
  };
};

/**
 * Solve the steady state with the chosen ceiling treatment. `p.taxes.employerSS` and
 * `.employeeSS` are interpreted as the BASELINE effective rates (wage scale 1).
 */
export function solveWithCeiling(
  p: PaperParameters,
  ctx: CeilingContext,
  opts: SolveOptions = {},
): CeilingSolveResult {
  const s1 = insurableShareAtWageScale(ctx, 1);
  const base = { sse: p.taxes.employerSS, ssw: p.taxes.employeeSS };
  const withRate = (factor: number): PaperParameters => ({
    ...p,
    taxes: { ...p.taxes, employerSS: base.sse * factor, employeeSS: base.ssw * factor },
  });
  const wrap = (r: SteadyStateResult, k: number, factor: number): CeilingSolveResult =>
    ({
      ...r,
      ceiling: {
        treatment: ctx.treatment,
        wageScale: k,
        effectiveRate: base.sse * factor,
        insurableShare: s1 * factor,
      },
    }) as CeilingSolveResult;

  if (ctx.treatment !== 'fixedNominal') {
    const r = solveSteadyStateDual(p, opts);
    return wrap(r, r.ok ? r.levels.W / ctx.baselineWage : NaN, 1);
  }
  // Fixed point in the rate factor f: f = s(W(f)/W₀)/s(1).
  const gap = (f: number) => {
    const r = solveSteadyStateDual(withRate(f), opts);
    if (!r.ok) return NaN;
    return insurableShareAtWageScale(ctx, r.levels.W / ctx.baselineWage) / s1 - f;
  };
  const root = brent(gap, 0.05, 1.5, { xTolerance: 1e-12 });
  if (root.status !== 'converged') {
    const r = solveSteadyStateDual(p, opts);
    if (!r.ok) return wrap(r, NaN, 1);
    return wrap(
      {
        ok: false,
        reason: 'solver-failed',
        detail: `ceiling fixed point did not converge (${root.status})`,
        meta: r.meta,
      },
      NaN,
      NaN,
    );
  }
  const r = solveSteadyStateDual(withRate(root.root), opts);
  return wrap(r, r.ok ? r.levels.W / ctx.baselineWage : NaN, root.root);
}
