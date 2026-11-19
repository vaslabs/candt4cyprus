/**
 * Locating the adoption level beyond which no finite steady state exists (MODEL_SPEC §5).
 *
 * The boundary is defined analytically by the existence margin (min of CES-stage slacks and C/Y)
 * from the dual reduction. This module brackets the first sign change on a grid and refines it
 * with Brent's method. Because the margin is a closed-form function of parameters, the result
 * is a property of the model, not of any iterative solver's behaviour.
 */
import { brent, scanBrackets } from '../core/numericalSolver';
import { existenceMargin } from './steadyState';
import type { PaperParameters } from './types';

export type BoundaryResult =
  | { readonly kind: 'none-in-range'; readonly upper: number; readonly marginAtUpper: number }
  | { readonly kind: 'boundary'; readonly adoption: number; readonly bracketWidth: number }
  | { readonly kind: 'infeasible-at-start'; readonly marginAtStart: number };

export function existenceBoundary(
  p: PaperParameters,
  lower = 0,
  upper = 0.999,
  gridIntervals = 400,
): BoundaryResult {
  const m = (a: number) => existenceMargin({ ...p, adoption: a });
  const m0 = m(lower);
  if (!(m0 > 0)) return { kind: 'infeasible-at-start', marginAtStart: m0 };
  const brackets = scanBrackets(m, lower, upper, gridIntervals);
  const first = brackets[0];
  if (!first) return { kind: 'none-in-range', upper, marginAtUpper: m(upper) };
  const r = brent(m, first.lo, first.hi, { xTolerance: 1e-14 });
  if (r.status !== 'converged') {
    // The bracket itself is a rigorous enclosure; report its midpoint and width.
    return { kind: 'boundary', adoption: (first.lo + first.hi) / 2, bracketWidth: first.hi - first.lo };
  }
  return { kind: 'boundary', adoption: r.root, bracketWidth: r.bracketWidth };
}
