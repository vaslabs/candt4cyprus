/**
 * Two-input CES aggregator, its dual unit-cost function, and helpers.
 *
 * Primal (paper eqs (1), (2), (10), (11)):
 *     F(x1, x2) = [ a·x1^r + (1−a)·x2^r ]^(1/r),   r = (s−1)/s,  s = elasticity of substitution
 *
 * Dual unit cost (cost of producing one unit of F at input prices p1, p2):
 *     c(p1, p2) = [ a^s·p1^(1−s) + (1−a)^s·p2^(1−s) ]^(1/(1−s))
 *               = [ a·(p1/a)^k + (1−a)·(p2/(1−a))^k ]^(1/k),   k = 1 − s
 *
 * Both are weighted power means M_q(z1, z2; a) = [a·z1^q + (1−a)·z2^q]^(1/q), with the
 * geometric mean z1^a·z2^(1−a) as the q → 0 limit (Cobb–Douglas, s = 1). We evaluate M_q
 * in a form that stays accurate as q → 0 instead of switching branches abruptly:
 *     M_q = exp( log1p( a·expm1(q ln z1) + (1−a)·expm1(q ln z2) ) / q )
 *
 * Units: inputs and prices are in arbitrary consistent model units; F is homogeneous of
 * degree 1 in (x1, x2) and c is homogeneous of degree 1 in (p1, p2).
 */

/** Exponents with |q| below this are treated as exactly 0 (geometric mean). */
const ZERO_EXPONENT = 1e-12;

export interface CesSpec {
  /** Distribution weight on input 1, 0 ≤ a ≤ 1. */
  readonly weight1: number;
  /** Elasticity of substitution s > 0 (s = 1 is Cobb–Douglas). */
  readonly elasticity: number;
}

export function assertCesSpec(spec: CesSpec): void {
  const { weight1: a, elasticity: s } = spec;
  if (!(a >= 0 && a <= 1)) throw new RangeError(`CES weight must be in [0,1], got ${a}`);
  if (!(s > 0 && Number.isFinite(s))) throw new RangeError(`CES elasticity must be finite and > 0, got ${s}`);
}

/**
 * Weighted power mean of two positive numbers. A term with zero weight is ignored entirely
 * (so its value may be +Infinity, as happens for dual prices p/a with a = 0).
 */
export function powerMean(z1: number, z2: number, a: number, q: number): number {
  if (a === 0) return z2;
  if (a === 1) return z1;
  const l1 = Math.log(z1);
  const l2 = Math.log(z2);
  if (Math.abs(q) < ZERO_EXPONENT) return Math.exp(a * l1 + (1 - a) * l2);
  // For large |q·ln z| expm1 overflows; fall back to a log-sum-exp form.
  const t1 = q * l1;
  const t2 = q * l2;
  if (Math.max(Math.abs(t1), Math.abs(t2)) > 1) {
    const m = Math.max(t1, t2);
    const s = a * Math.exp(t1 - m) + (1 - a) * Math.exp(t2 - m);
    return Math.exp((m + Math.log(s)) / q);
  }
  return Math.exp(Math.log1p(a * Math.expm1(t1) + (1 - a) * Math.expm1(t2)) / q);
}

export function primalExponent(s: number): number {
  return (s - 1) / s;
}

/** CES output F(x1, x2). Inputs must be ≥ 0; a zero input with positive weight is allowed when s > 1. */
export function cesOutput(spec: CesSpec, x1: number, x2: number): number {
  const { weight1: a, elasticity: s } = spec;
  const r = primalExponent(s);
  // Zero inputs: with r > 0 they contribute 0; with r ≤ 0 any used zero input gives F = 0.
  if ((x1 === 0 && a > 0) || (x2 === 0 && a < 1)) {
    if (r <= 0) return 0;
    const term = (x1 > 0 ? a * x1 ** r : 0) + (x2 > 0 ? (1 - a) * x2 ** r : 0);
    return term ** (1 / r);
  }
  return powerMean(x1, x2, a, r);
}

/**
 * Marginal products (∂F/∂x1, ∂F/∂x2) = (a·(F/x1)^(1/s), (1−a)·(F/x2)^(1/s)).
 * This is the form used in the paper's FOCs, e.g. eq. (6): R_k = (1−θ)·Y^(1/ρ)·K^(−1/ρ).
 */
export function cesMarginalProducts(spec: CesSpec, x1: number, x2: number): [number, number] {
  const { weight1: a, elasticity: s } = spec;
  const f = cesOutput(spec, x1, x2);
  return [a * (f / x1) ** (1 / s), (1 - a) * (f / x2) ** (1 / s)];
}

/** Unit cost c(p1, p2); prices must be > 0. */
export function cesUnitCost(spec: CesSpec, p1: number, p2: number): number {
  const { weight1: a, elasticity: s } = spec;
  return powerMean(p1 / a, p2 / (1 - a), a, 1 - s);
}

/**
 * Conditional input demands per unit of output (Shephard's lemma):
 *     x_i / F = ∂c/∂p_i = w_i^s · (c / p_i)^s,   w_1 = a, w_2 = 1 − a.
 */
export function cesUnitDemands(spec: CesSpec, p1: number, p2: number): [number, number] {
  const { weight1: a, elasticity: s } = spec;
  const c = cesUnitCost(spec, p1, p2);
  return [a === 0 ? 0 : a ** s * (c / p1) ** s, a === 1 ? 0 : (1 - a) ** s * (c / p2) ** s];
}

export type InversePriceResult =
  | { readonly ok: true; readonly price: number }
  | {
      readonly ok: false;
      /**
       * 'input1-too-cheap': input 1 alone already produces at unit cost below c, so no positive
       * finite price of input 2 is consistent with zero profit (input 2 would be priced out
       * entirely or would need an infinite price).
       * 'input1-too-expensive': with s < 1 input 1 is essential and too dear for unit cost c.
       */
      readonly reason: 'input1-too-cheap' | 'input1-too-expensive' | 'input2-unused';
      /** Signed slack of the existence condition; ≤ 0 means infeasible. 0 is the exact boundary. */
      readonly slack: number;
    };

/**
 * Solve c(p1, p2) = c for p2, given c and p1. Zero-profit pricing pins down the remaining
 * factor price. Writing q1 = p1/a and k = 1 − s:
 *     (p2/(1−a))^k = (c^k − a·q1^k) / (1−a)
 * A finite positive p2 exists iff the right-hand side is > 0 (k ≠ 0). For k = 0 (Cobb–Douglas)
 * it always exists: p2 = (1−a)·(c / q1^a)^(1/(1−a)).
 *
 * The returned `slack` is (c^k − a·q1^k)/c^k = 1 − a·(q1/c)^k, so slack > 0 ⇔ existence
 * (valid for either sign of k because c^k > 0).
 */
export function cesInversePrice2(spec: CesSpec, unitCost: number, p1: number): InversePriceResult {
  const { weight1: a, elasticity: s } = spec;
  if (a === 1) return { ok: false, reason: 'input2-unused', slack: 0 };
  if (a === 0) return { ok: true, price: unitCost };
  const k = 1 - s;
  const lq1 = Math.log(p1 / a);
  const lc = Math.log(unitCost);
  if (Math.abs(k) < ZERO_EXPONENT) {
    return { ok: true, price: (1 - a) * Math.exp((lc - a * lq1) / (1 - a)) };
  }
  // Ratio form: c^k − a·q1^k > 0  ⇔  1 − a·(q1/c)^k > 0 ; expm1 keeps accuracy for small k.
  const e = Math.expm1(k * (lq1 - lc)); // (q1/c)^k − 1
  const slack = 1 - a * (1 + e); // = 1 − a·(q1/c)^k
  if (!(slack > 0)) {
    return { ok: false, reason: k < 0 ? 'input1-too-cheap' : 'input1-too-expensive', slack };
  }
  // (p2/(1−a))^k = c^k · slack/(1−a), and slack/(1−a) = 1 − a·e/(1−a). Using log1p avoids
  // the cancellation in forming 1 − a·(1+e) when k (hence e) is tiny, near Cobb–Douglas.
  const logP2 = Math.log(1 - a) + lc + Math.log1p((-a * e) / (1 - a)) / k;
  return { ok: true, price: Math.exp(logP2) };
}
