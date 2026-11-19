import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  cesInversePrice2,
  cesMarginalProducts,
  cesOutput,
  cesUnitCost,
  cesUnitDemands,
  powerMean,
  type CesSpec,
} from '../../src/economics/core/ces';
import { elasticity, positive, relErr, weight } from '../support/arbitraries';

const spec = fc.record({ weight1: weight, elasticity }) as fc.Arbitrary<CesSpec>;

describe('CES known values', () => {
  it('Cobb–Douglas: F(4,1; a=.5) = 2 and dual cost (p/a)^a (p/(1-a))^(1-a)', () => {
    const cd: CesSpec = { weight1: 0.5, elasticity: 1 };
    expect(cesOutput(cd, 4, 1)).toBeCloseTo(2, 14);
    expect(cesUnitCost(cd, 1, 1)).toBeCloseTo(2, 14);
  });
  it('s = 2: F = [a√x1 + (1−a)√x2]²', () => {
    const s: CesSpec = { weight1: 0.3, elasticity: 2 };
    expect(cesOutput(s, 4, 9)).toBeCloseTo((0.3 * 2 + 0.7 * 3) ** 2, 13);
  });
  it('s = 0.5: F = [a/x1 + (1−a)/x2]^(−1)', () => {
    const s: CesSpec = { weight1: 0.4, elasticity: 0.5 };
    expect(cesOutput(s, 2, 5)).toBeCloseTo(1 / (0.4 / 2 + 0.6 / 5), 13);
  });
  it('degenerate weights drop the unused input', () => {
    expect(cesOutput({ weight1: 0, elasticity: 2 }, 123, 7)).toBe(7);
    expect(cesUnitCost({ weight1: 0, elasticity: 2 }, 5, 3)).toBe(3);
    expect(cesUnitDemands({ weight1: 0, elasticity: 2 }, 5, 3)).toEqual([0, 1]);
  });
  it('zero input with substitutes (s>1) still produces; with complements gives 0', () => {
    expect(cesOutput({ weight1: 0.3, elasticity: 2 }, 0, 9)).toBeCloseTo((0.7 * 3) ** 2, 13);
    expect(cesOutput({ weight1: 0.3, elasticity: 0.5 }, 0, 9)).toBe(0);
  });
});

describe('CES properties', () => {
  it('power mean lies between min and max of its arguments', () => {
    fc.assert(
      fc.property(
        positive(),
        positive(),
        weight,
        fc.double({ min: -5, max: 5, noNaN: true }),
        (z1, z2, a, q) => {
          const m = powerMean(z1, z2, a, q);
          const tol = 1e-12 * Math.max(z1, z2);
          return m >= Math.min(z1, z2) - tol && m <= Math.max(z1, z2) + tol;
        },
      ),
    );
  });

  it('is homogeneous of degree 1', () => {
    fc.assert(
      fc.property(spec, positive(), positive(), positive(-2, 2), (s, x1, x2, l) => {
        return relErr(cesOutput(s, l * x1, l * x2), l * cesOutput(s, x1, x2)) < 1e-12;
      }),
    );
  });

  it("satisfies Euler's theorem: MP1·x1 + MP2·x2 = F", () => {
    fc.assert(
      fc.property(spec, positive(), positive(), (s, x1, x2) => {
        const [m1, m2] = cesMarginalProducts(s, x1, x2);
        return relErr(m1 * x1 + m2 * x2, cesOutput(s, x1, x2)) < 1e-11;
      }),
    );
  });

  it('marginal products agree with finite differences of F', () => {
    fc.assert(
      fc.property(spec, positive(-1, 1), positive(-1, 1), (s, x1, x2) => {
        const [m1, m2] = cesMarginalProducts(s, x1, x2);
        const h1 = 1e-6 * x1;
        const h2 = 1e-6 * x2;
        const d1 = (cesOutput(s, x1 + h1, x2) - cesOutput(s, x1 - h1, x2)) / (2 * h1);
        const d2 = (cesOutput(s, x1, x2 + h2) - cesOutput(s, x1, x2 - h2)) / (2 * h2);
        // Central differences of F carry rounding error ~eps·F/h; compare on the scale F/x_i.
        const f = cesOutput(s, x1, x2);
        return Math.abs(m1 - d1) < 1e-6 * (f / x1) && Math.abs(m2 - d2) < 1e-6 * (f / x2);
      }),
    );
  });

  it('duality: unit demands produce exactly one unit and cost exactly c', () => {
    fc.assert(
      fc.property(spec, positive(), positive(), (s, p1, p2) => {
        const c = cesUnitCost(s, p1, p2);
        const [d1, d2] = cesUnitDemands(s, p1, p2);
        return relErr(cesOutput(s, d1, d2), 1) < 1e-10 && relErr(p1 * d1 + p2 * d2, c) < 1e-10;
      }),
    );
  });

  it('cost minimisation: any other input bundle producing one unit costs at least c', () => {
    fc.assert(
      fc.property(spec, positive(), positive(), positive(), positive(), (s, p1, p2, z1, z2) => {
        const f = cesOutput(s, z1, z2);
        const cost = (p1 * z1 + p2 * z2) / f; // scale bundle to produce one unit (CRS)
        return cost >= cesUnitCost(s, p1, p2) * (1 - 1e-12);
      }),
    );
  });

  it('first-order conditions: at unit demands MP_i = p_i / c', () => {
    fc.assert(
      fc.property(spec, positive(-2, 2), positive(-2, 2), (s, p1, p2) => {
        const c = cesUnitCost(s, p1, p2);
        const [d1, d2] = cesUnitDemands(s, p1, p2);
        const [m1, m2] = cesMarginalProducts(s, d1, d2);
        return relErr(m1, p1 / c) < 1e-9 && relErr(m2, p2 / c) < 1e-9;
      }),
    );
  });

  it('is continuous through the Cobb–Douglas limit s → 1', () => {
    fc.assert(
      fc.property(
        weight,
        positive(-2, 2),
        positive(-2, 2),
        fc.double({ min: 1e-9, max: 1e-6, noNaN: true }),
        (a, x1, x2, eps) => {
          const cd = cesOutput({ weight1: a, elasticity: 1 }, x1, x2);
          const lo = cesOutput({ weight1: a, elasticity: 1 - eps }, x1, x2);
          const hi = cesOutput({ weight1: a, elasticity: 1 + eps }, x1, x2);
          // |dF/ds| at s=1 is O((ln x1 − ln x2)²) ≤ ~100 here; allow 1e3·eps.
          return relErr(lo, cd) < 1e3 * eps && relErr(hi, cd) < 1e3 * eps;
        },
      ),
    );
  });

  it('inverse price recovers p2 whenever it exists', () => {
    fc.assert(
      fc.property(spec, positive(-2, 2), positive(-2, 2), (s, p1, p2) => {
        const c = cesUnitCost(s, p1, p2);
        const inv = cesInversePrice2(s, c, p1);
        // Conditioning: d ln p2 / d ln c = 1 / (cost share of input 2). Recovering p2 is
        // intrinsically ill-conditioned when input 2's share is tiny, so the error bound must
        // scale with 1/share (backward stability), not be a fixed relative tolerance.
        const [, d2] = cesUnitDemands(s, p1, p2);
        const share2 = (p2 * d2) / c;
        return inv.ok && relErr(inv.price, p2) < 1e-8 + 1e-14 / share2;
      }),
    );
  });

  it('inverse price failure is genuine: no finite p2 reaches the target unit cost', () => {
    fc.assert(
      fc.property(spec, positive(-2, 2), positive(-2, 2), (s, p1, c) => {
        const inv = cesInversePrice2(s, c, p1);
        if (inv.ok) return relErr(cesUnitCost(s, p1, inv.price), c) < 1e-8;
        // c(p1, ·) is increasing in p2; its supremum (p2 → ∞) must not exceed the target.
        // For s>1 sup = (p1/a)·a^(1/(1−s)); for s<1 the infimum (p2 → 0) must be above target.
        const a = s.weight1;
        const k = 1 - s.elasticity;
        const limit = (p1 / a) * a ** (1 / k);
        return inv.slack <= 0 && (k < 0 ? limit <= c * (1 + 1e-9) : limit >= c * (1 - 1e-9));
      }),
    );
  });
});
