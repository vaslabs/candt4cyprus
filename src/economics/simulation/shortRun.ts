/**
 * Short-run scenario with capital held fixed (capital-mobility sensitivity, NOT a steady state).
 *
 * K and D are fixed at their pre-reform steady-state levels; investment only replaces depreciation.
 * Firms still price factors competitively, and households choose hours by eq. (24). The Euler
 * equations (25)–(26) do NOT hold: capital owners simply receive whatever return the fixed stock earns.
 * In this scenario, taxes on capital income or robot use (B, C, D, G) do not change the allocation;
 * only instruments that change labour's cost or net output price (E, F) or the labour-supply wedge do.
 * It brackets the long-run case (perfectly elastic capital supply via the Euler equations).
 */
import { brent } from '../core/numericalSolver';
import { labourSupplyWedges } from '../paper/households';
import { technologyModel } from '../paper/technology';
import { assembleResult, firmWedges, makeMeta, type SolveOptions } from '../paper/steadyState';
import type { ConvergenceInfo, PaperParameters, SteadyStateLevels, SteadyStateResult } from '../paper/types';

export interface FixedCapital {
  readonly K: number;
  readonly D: number;
}

export function solveShortRun(
  p: PaperParameters,
  fixed: FixedCapital,
  opts: SolveOptions = {},
): SteadyStateResult {
  const fail = (detail: string): SteadyStateResult => ({
    ok: false,
    reason: 'solver-failed',
    detail,
    meta: makeMeta(
      p,
      'short-run-fixed-capital',
      { status: 'failed', residualNorm: NaN, iterations: 0, jacobianCondition: NaN, message: detail },
      opts,
    ),
  });
  if (p.extensions?.labourShare && p.extensions.labourShare.rate > 0) {
    return fail(
      'Short-run scenario supports E, G and robot taxes; policy F regimes are resolved only in the long-run solver.',
    );
  }
  const tech = technologyModel(p);
  const { price, labourMultiplier } = firmWedges(p, 0);
  if (!(price > 0)) return fail(`net output price ${price} ≤ 0`);
  const w = labourSupplyWedges(p);
  const g = p.gamma / (1 - p.gamma);
  const at = (L: number) => {
    const { Y, X } = tech.output(p, fixed.K, fixed.D, L);
    const mp = tech.focs(p, Y, X, fixed.K, fixed.D, L);
    const W = (price * mp.mpL) / labourMultiplier;
    const C = Y - p.deltaK * fixed.K - p.deltaD * fixed.D;
    return { Y, X, W, C, mp };
  };
  // Labour supply residual: wc·C − γ/(1−γ)·(1−L)·W·ww, increasing in L.
  const resid = (L: number) => {
    const s = at(L);
    return w.consumption * s.C - g * (1 - L) * s.W * w.wage;
  };
  const root = brent(resid, 1e-9, 1 - 1e-9, { xTolerance: 1e-14 });
  if (root.status !== 'converged') return fail(`labour market did not clear (${root.status})`);
  const L = root.root;
  const s = at(L);
  if (!(s.C > 0)) return fail('non-positive consumption with fixed capital');
  const Rk = price * s.mp.mpK;
  const Rd = fixed.D > 0 ? (price * s.mp.mpD) / (1 + p.taxes.robotSS) : 0;
  const levels: SteadyStateLevels = {
    Y: s.Y,
    C: s.C,
    K: fixed.K,
    D: fixed.D,
    L,
    X: s.X,
    W: s.W,
    I: p.deltaK * fixed.K + p.deltaD * fixed.D,
    Rk,
    Rd,
    Ik: p.deltaK * fixed.K,
    Id: p.deltaD * fixed.D,
  };
  const conv: ConvergenceInfo = {
    status: 'converged',
    residualNorm: Math.abs(root.fRoot),
    iterations: root.iterations,
    jacobianCondition: NaN,
    message: 'Short-run equilibrium with capital fixed (Brent on hours).',
  };
  return assembleResult(
    p,
    levels,
    makeMeta(p, 'short-run-fixed-capital', conv, opts),
    { outer: NaN, inner: NaN },
    undefined,
    price,
  );
}
