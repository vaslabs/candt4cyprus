import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  brent,
  conditionNumber1,
  dampedNewton,
  luFactor,
  luSolve,
  normInf,
  numericalJacobian,
  scanBrackets,
} from '../../src/economics/core/numericalSolver';

/** Random n×n strictly diagonally dominant matrix (hence non-singular, modest κ). */
const ddMatrix = (n: number) =>
  fc
    .array(fc.array(fc.double({ min: -1, max: 1, noNaN: true }), { minLength: n, maxLength: n }), {
      minLength: n,
      maxLength: n,
    })
    .map((rows) =>
      rows.map((row, i) => {
        const off = row.reduce((s, v, j) => (j === i ? s : s + Math.abs(v)), 0);
        return row.map((v, j) => (j === i ? (v >= 0 ? 1 : -1) * (off + 1 + Math.abs(v)) : v));
      }),
    );
const vec = (n: number) =>
  fc.array(fc.double({ min: -10, max: 10, noNaN: true }), { minLength: n, maxLength: n });
const matVec = (a: number[][], x: readonly number[]) => a.map((r) => r.reduce((s, v, j) => s + v * x[j]!, 0));

describe('LU', () => {
  it('solves A·x = b to near machine precision for well-conditioned A', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }).chain((n) => fc.tuple(ddMatrix(n), vec(n))),
        ([a, b]) => {
          const x = luSolve(luFactor(a), b);
          const r = matVec(a, x).map((v, i) => v - b[i]!);
          return normInf(r) <= 1e-12 * (1 + normInf(b));
        },
      ),
    );
  });
  it('requires pivoting for a zero leading entry', () => {
    const x = luSolve(
      luFactor([
        [0, 1],
        [1, 0],
      ]),
      [2, 3],
    );
    expect(x[0]).toBeCloseTo(3, 15);
    expect(x[1]).toBeCloseTo(2, 15);
  });
  it('flags singular matrices', () => {
    expect(
      luFactor([
        [1, 2],
        [2, 4],
      ]).singular,
    ).toBe(true);
    expect(
      conditionNumber1([
        [1, 2],
        [2, 4],
      ]),
    ).toBe(Infinity);
  });
  it('condition number: κ(I)=1, κ(diag(1,1e-8))=1e8', () => {
    expect(
      conditionNumber1([
        [1, 0],
        [0, 1],
      ]),
    ).toBe(1);
    expect(
      conditionNumber1([
        [1, 0],
        [0, 1e-8],
      ]),
    ).toBeCloseTo(1e8, 0);
  });
});

describe('numerical Jacobian', () => {
  it('equals A for a linear map x ↦ A·x', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }).chain((n) => fc.tuple(ddMatrix(n), vec(n))),
        ([a, x]) => {
          const j = numericalJacobian((v) => matVec(a, v), x);
          return j.every((row, i) => row.every((v, k) => Math.abs(v - a[i]![k]!) < 1e-8));
        },
      ),
    );
  });
});

describe('damped Newton', () => {
  it('solves random mildly nonlinear systems A·x + 0.3·sin(x) = b', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }).chain((n) => fc.tuple(ddMatrix(n), vec(n))),
        ([a, b]) => {
          const fn = (x: readonly number[]) => matVec(a, x).map((v, i) => v + 0.3 * Math.sin(x[i]!) - b[i]!);
          const res = dampedNewton(fn, new Array(b.length).fill(0));
          return res.converged && normInf(fn(res.x)) <= 1e-12 && res.residualNorm <= 1e-12;
        },
      ),
    );
  });
  it('line search rescues a start where undamped Newton diverges (atan(x) = 0, x0 = 2)', () => {
    const fn = (v: readonly number[]) => [Math.atan(v[0]!)];
    const undamped = dampedNewton(fn, [2], { minDamping: 1, maxIterations: 20 });
    expect(undamped.converged).toBe(false);
    const res = dampedNewton(fn, [2]);
    expect(res.status).toBe('converged');
    expect(Math.abs(res.x[0]!)).toBeLessThan(1e-12);
  });
  it('known limitation: stalls in the Rosenbrock valley but never claims convergence', () => {
    const fn = (v: readonly number[]) => {
      const [x, y] = v as [number, number];
      return [-2 * (1 - x) - 400 * x * (y - x * x), 200 * (y - x * x)];
    };
    const res = dampedNewton(fn, [-1.2, 1], { maxIterations: 50 });
    expect(res.converged).toBe(res.residualNorm <= 1e-12);
  });
  it('never reports convergence for a system with no real root (x² + 1 = 0)', () => {
    const res = dampedNewton((v) => [v[0]! * v[0]! + 1], [0.5], { maxIterations: 50 });
    expect(res.converged).toBe(false);
    expect(res.residualNorm).toBeGreaterThanOrEqual(1);
  });
  it('reports non-finite starting residuals instead of iterating', () => {
    const res = dampedNewton((v) => [Math.log(v[0]!)], [-1]);
    expect(res.status).toBe('non-finite');
  });
  it('records a condition number at the solution', () => {
    const res = dampedNewton((v) => [v[0]! - 1, 1e-6 * (v[1]! - 2)], [0, 0]);
    expect(res.converged).toBe(true);
    expect(res.jacobianCondition).toBeCloseTo(1e6, -1);
  });
});

describe('Brent', () => {
  it('finds the root of (x − r)(1 + x²) to tolerance on any bracket containing r', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -50, max: 50, noNaN: true }),
        fc.double({ min: 0.01, max: 100, noNaN: true }),
        fc.double({ min: 0.01, max: 100, noNaN: true }),
        (r, dl, dh) => {
          const res = brent((x) => (x - r) * (1 + x * x), r - dl, r + dh, { xTolerance: 1e-12 });
          return res.status === 'converged' && Math.abs(res.root - r) <= 1e-10 * (1 + Math.abs(r));
        },
      ),
    );
  });
  it('is not fooled into reporting a root when the interval is not bracketed', () => {
    expect(brent((x) => x * x + 1, -1, 1).status).toBe('not-bracketed');
  });
  it('converges in few iterations on a smooth problem', () => {
    const res = brent((x) => Math.cos(x) - x, 0, 1);
    expect(res.status).toBe('converged');
    if (res.status === 'converged') {
      expect(res.root).toBeCloseTo(0.7390851332151607, 13);
      expect(res.iterations).toBeLessThan(15);
    }
  });
});

describe('scanBrackets', () => {
  it('finds every sign change of sin on [0.5, 10] in order', () => {
    const br = scanBrackets(Math.sin, 0.5, 10, 200);
    expect(br).toHaveLength(3);
    br.forEach((b, i) => {
      expect(b.lo).toBeLessThanOrEqual((i + 1) * Math.PI);
      expect(b.hi).toBeGreaterThanOrEqual((i + 1) * Math.PI);
    });
  });
  it('skips non-finite points without inventing brackets', () => {
    const br = scanBrackets((x) => (x > 0.4 && x < 0.6 ? NaN : x - 0.5), 0, 1, 10);
    expect(br).toHaveLength(0);
  });
});
