/**
 * Numerical routines used by the economic model: dense LU, condition estimate, finite-difference
 * Jacobian, damped Newton with backtracking line search, Brent's method, and bracket scanning.
 *
 * None of these routines throw on non-convergence. They return a typed result carrying
 * diagnostics, so callers can report failures explicitly and never substitute fabricated values.
 */

export type Vector = readonly number[];
export type Matrix = readonly (readonly number[])[];

// ---------------------------------------------------------------- linear algebra

export interface LuFactorization {
  readonly lu: number[][];
  readonly perm: number[];
  readonly singular: boolean;
}

/** LU decomposition with partial pivoting (Doolittle, in place on a copy). */
export function luFactor(a: Matrix): LuFactorization {
  const n = a.length;
  const lu = a.map((row) => [...row]);
  const perm = Array.from({ length: n }, (_, i) => i);
  let singular = false;
  for (let k = 0; k < n; k++) {
    let p = k;
    let max = Math.abs(lu[k]![k]!);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(lu[i]![k]!);
      if (v > max) {
        max = v;
        p = i;
      }
    }
    if (max === 0 || !Number.isFinite(max)) {
      singular = true;
      continue;
    }
    if (p !== k) {
      [lu[k], lu[p]] = [lu[p]!, lu[k]!];
      [perm[k], perm[p]] = [perm[p]!, perm[k]!];
    }
    const rowK = lu[k]!;
    for (let i = k + 1; i < n; i++) {
      const rowI = lu[i]!;
      const f = rowI[k]! / rowK[k]!;
      rowI[k] = f;
      for (let j = k + 1; j < n; j++) rowI[j] = rowI[j]! - f * rowK[j]!;
    }
  }
  return { lu, perm, singular };
}

export function luSolve(f: LuFactorization, b: Vector): number[] {
  const n = b.length;
  const { lu, perm } = f;
  const y = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let s = b[perm[i]!]!;
    for (let j = 0; j < i; j++) s -= lu[i]![j]! * y[j]!;
    y[i] = s;
  }
  const x = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i]!;
    for (let j = i + 1; j < n; j++) s -= lu[i]![j]! * x[j]!;
    x[i] = s / lu[i]![i]!;
  }
  return x;
}

export function norm1Matrix(a: Matrix): number {
  let max = 0;
  const n = a.length;
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.abs(a[i]![j]!);
    max = Math.max(max, s);
  }
  return max;
}

/**
 * 1-norm condition number κ₁(A) = ‖A‖₁·‖A⁻¹‖₁, computed exactly by forming A⁻¹ column by
 * column (cheap for the ≤ 10×10 systems in this project). Returns Infinity if singular.
 */
export function conditionNumber1(a: Matrix, f: LuFactorization = luFactor(a)): number {
  if (f.singular) return Infinity;
  const n = a.length;
  let invNorm = 0;
  for (let j = 0; j < n; j++) {
    const e = new Array<number>(n).fill(0);
    e[j] = 1;
    const col = luSolve(f, e);
    let s = 0;
    for (const v of col) s += Math.abs(v);
    invNorm = Math.max(invNorm, s);
  }
  const k = norm1Matrix(a) * invNorm;
  return Number.isFinite(k) ? k : Infinity;
}

export function normInf(v: Vector): number {
  let m = 0;
  for (const x of v) m = Math.max(m, Math.abs(x));
  return m;
}

function norm2Sq(v: Vector): number {
  let s = 0;
  for (const x of v) s += x * x;
  return s;
}

// ---------------------------------------------------------------- Jacobian

export type VectorFunction = (x: Vector) => number[];

/** Central-difference Jacobian J[i][j] = ∂F_i/∂x_j, step h_j = h·max(1, |x_j|). */
export function numericalJacobian(fn: VectorFunction, x: Vector, h = 1e-6): number[][] {
  const n = x.length;
  const cols: number[][] = [];
  for (let j = 0; j < n; j++) {
    const step = h * Math.max(1, Math.abs(x[j]!));
    const xp = [...x];
    const xm = [...x];
    xp[j] = x[j]! + step;
    xm[j] = x[j]! - step;
    const fp = fn(xp);
    const fm = fn(xm);
    cols.push(fp.map((v, i) => (v - fm[i]!) / (2 * step)));
  }
  const m = cols[0]?.length ?? 0;
  return Array.from({ length: m }, (_, i) => cols.map((c) => c[i]!));
}

// ---------------------------------------------------------------- Newton

export interface NewtonOptions {
  readonly tolerance?: number; // on ‖F‖∞
  readonly stepTolerance?: number; // on ‖Δx‖∞ (relative to 1 + ‖x‖∞)
  readonly maxIterations?: number;
  readonly jacobianStep?: number;
  /** Smallest damping factor tried by the backtracking line search. */
  readonly minDamping?: number;
}

export type NewtonStatus =
  'converged' | 'max-iterations' | 'singular-jacobian' | 'line-search-failed' | 'non-finite';

export interface NewtonResult {
  readonly status: NewtonStatus;
  readonly converged: boolean;
  readonly x: number[];
  readonly residual: number[];
  readonly residualNorm: number;
  readonly iterations: number;
  /** κ₁ of the Jacobian at the final iterate (Infinity if singular). */
  readonly jacobianCondition: number;
  readonly history: readonly number[];
}

/**
 * Damped Newton–Raphson. Each step solves J·Δ = −F and backtracks λ ∈ {1, ½, ¼, …} until
 * ‖F(x + λΔ)‖² < (1 − 1e-4·λ)·‖F(x)‖² (Armijo on the merit function ½‖F‖²).
 */
export function dampedNewton(fn: VectorFunction, x0: Vector, opts: NewtonOptions = {}): NewtonResult {
  const tol = opts.tolerance ?? 1e-12;
  const stepTol = opts.stepTolerance ?? 1e-14;
  const maxIt = opts.maxIterations ?? 100;
  const h = opts.jacobianStep ?? 1e-6;
  const minDamping = opts.minDamping ?? 1e-10;

  let x = [...x0];
  let f = fn(x);
  const history: number[] = [normInf(f)];
  let cond = NaN;

  const finish = (status: NewtonStatus, it: number): NewtonResult => {
    if (Number.isNaN(cond)) {
      const j = numericalJacobian(fn, x, h);
      cond = conditionNumber1(j);
    }
    const rn = normInf(f);
    return {
      status,
      converged: status === 'converged',
      x,
      residual: f,
      residualNorm: rn,
      iterations: it,
      jacobianCondition: cond,
      history,
    };
  };

  if (!f.every(Number.isFinite)) return finish('non-finite', 0);

  for (let it = 0; it < maxIt; it++) {
    if (normInf(f) <= tol) return finish('converged', it);
    const jac = numericalJacobian(fn, x, h);
    const lu = luFactor(jac);
    if (lu.singular) {
      cond = Infinity;
      return finish('singular-jacobian', it);
    }
    const delta = luSolve(
      lu,
      f.map((v) => -v),
    );
    if (!delta.every(Number.isFinite)) {
      cond = Infinity;
      return finish('singular-jacobian', it);
    }
    const phi0 = norm2Sq(f);
    let lambda = 1;
    let accepted = false;
    while (lambda >= minDamping) {
      const xt = x.map((v, i) => v + lambda * delta[i]!);
      const ft = fn(xt);
      if (ft.every(Number.isFinite) && norm2Sq(ft) < (1 - 1e-4 * lambda) * phi0) {
        x = xt;
        f = ft;
        accepted = true;
        break;
      }
      lambda /= 2;
    }
    history.push(normInf(f));
    if (!accepted) {
      cond = conditionNumber1(jac, lu);
      return finish(normInf(f) <= tol ? 'converged' : 'line-search-failed', it + 1);
    }
    if (normInf(f) <= tol) {
      cond = conditionNumber1(jac, lu);
      return finish('converged', it + 1);
    }
    if (lambda * normInf(delta) <= stepTol * (1 + normInf(x))) {
      cond = conditionNumber1(jac, lu);
      return finish(normInf(f) <= tol ? 'converged' : 'line-search-failed', it + 1);
    }
  }
  return finish('max-iterations', maxIt);
}

// ---------------------------------------------------------------- scalar root finding

export type ScalarFunction = (x: number) => number;

export interface BrentOptions {
  readonly xTolerance?: number;
  readonly maxIterations?: number;
}

export type BrentResult =
  | {
      readonly status: 'converged';
      readonly root: number;
      readonly fRoot: number;
      readonly iterations: number;
      readonly bracketWidth: number;
    }
  | { readonly status: 'not-bracketed'; readonly fa: number; readonly fb: number }
  | { readonly status: 'non-finite'; readonly at: number }
  | { readonly status: 'max-iterations'; readonly best: number; readonly fBest: number };

/**
 * Brent's method (inverse quadratic interpolation + secant + bisection) on [a, b] with
 * f(a)·f(b) ≤ 0. Converges when the bracket half-width ≤ 2·eps·|b| + xTolerance/2 or f(b) = 0.
 */
export function brent(f: ScalarFunction, lo: number, hi: number, opts: BrentOptions = {}): BrentResult {
  const xtol = opts.xTolerance ?? 1e-13;
  const maxIt = opts.maxIterations ?? 200;
  let a = lo;
  let b = hi;
  let fa = f(a);
  let fb = f(b);
  if (!Number.isFinite(fa)) return { status: 'non-finite', at: a };
  if (!Number.isFinite(fb)) return { status: 'non-finite', at: b };
  if (fa === 0) return { status: 'converged', root: a, fRoot: 0, iterations: 0, bracketWidth: 0 };
  if (fb === 0) return { status: 'converged', root: b, fRoot: 0, iterations: 0, bracketWidth: 0 };
  if (fa * fb > 0) return { status: 'not-bracketed', fa, fb };

  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;
  for (let it = 1; it <= maxIt; it++) {
    if (fb * fc > 0) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + 0.5 * xtol;
    const xm = 0.5 * (c - b);
    if (Math.abs(xm) <= tol1 || fb === 0) {
      return { status: 'converged', root: b, fRoot: fb, iterations: it, bracketWidth: Math.abs(c - b) };
    }
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa;
      let p: number;
      let q: number;
      if (a === c) {
        p = 2 * xm * s;
        q = 1 - s;
      } else {
        const qq = fa / fc;
        const r = fb / fc;
        p = s * (2 * xm * qq * (qq - r) - (b - a) * (r - 1));
        q = (qq - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q;
      p = Math.abs(p);
      if (2 * p < Math.min(3 * xm * q - Math.abs(tol1 * q), Math.abs(e * q))) {
        e = d;
        d = p / q;
      } else {
        d = xm;
        e = d;
      }
    } else {
      d = xm;
      e = d;
    }
    a = b;
    fa = fb;
    b += Math.abs(d) > tol1 ? d : xm > 0 ? tol1 : -tol1;
    fb = f(b);
    if (!Number.isFinite(fb)) return { status: 'non-finite', at: b };
  }
  return { status: 'max-iterations', best: b, fBest: fb };
}

export interface Bracket {
  readonly lo: number;
  readonly hi: number;
}

/**
 * Scan f on a uniform grid of `n` intervals over [lo, hi] and return every sub-interval with a
 * sign change, in increasing order. Points where f is non-finite are skipped (they break
 * brackets, not the scan). This is how callers find the *smallest* root and detect when there
 * are several (e.g. a Laffer-curve second root).
 */
export function scanBrackets(f: ScalarFunction, lo: number, hi: number, n: number): Bracket[] {
  const out: Bracket[] = [];
  let xPrev = lo;
  let fPrev = f(lo);
  for (let i = 1; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    const fx = f(x);
    if (Number.isFinite(fPrev) && Number.isFinite(fx)) {
      if (fPrev === 0) out.push({ lo: xPrev, hi: xPrev });
      else if (fPrev * fx < 0) out.push({ lo: xPrev, hi: x });
    }
    xPrev = x;
    fPrev = fx;
  }
  if (Number.isFinite(fPrev) && fPrev === 0) out.push({ lo: xPrev, hi: xPrev });
  return out;
}
