/**
 * Production technologies A and B (paper §3.1). Each technology exposes:
 *  - a primal form (output from inputs, eqs (1)–(2) / (10)–(11)),
 *  - the paper's literal first-order conditions (eqs (4)–(6) / (13)–(15)), used by the full
 *    10-equation solver,
 *  - a dual form (unit-cost reduction), used by the semi-analytic solver.
 * The literal FOC formulas are deliberately written out independently of ces.ts's marginal
 * products, so that the two solvers share as little code as possible.
 */
import {
  cesInversePrice2,
  cesOutput,
  cesUnitDemands,
  type CesSpec,
  type InversePriceResult,
} from '../core/ces';
import type { PaperParameters } from './types';

export interface MarginalProducts {
  readonly mpK: number;
  readonly mpD: number;
  readonly mpL: number;
}

export interface UnitRatios {
  /** Inputs per unit of output. */
  readonly ky: number;
  readonly dy: number;
  readonly ly: number;
  readonly xy: number;
}

export type DualOutcome =
  | {
      readonly ok: true;
      /** Labour cost (1+τ^sse)W. */
      readonly pL: number;
      /** Unit cost of the intermediate aggregate X. */
      readonly cX: number;
      readonly ratios: UnitRatios;
      readonly outerSlack: number;
      readonly innerSlack: number;
    }
  | {
      readonly ok: false;
      readonly stage: 'outer' | 'inner';
      readonly failure: Extract<InversePriceResult, { ok: false }>;
      readonly outerSlack: number;
      readonly innerSlack: number;
    };

export interface TechnologyModel {
  readonly outerSpec: (p: PaperParameters) => CesSpec;
  readonly innerSpec: (p: PaperParameters) => CesSpec;
  output(p: PaperParameters, K: number, D: number, L: number): { Y: number; X: number };
  focs(p: PaperParameters, Y: number, X: number, K: number, D: number, L: number): MarginalProducts;
  /** Dual reduction given capital cost Rk and robot cost pD = (1+τ^ssz)R_d (output price = 1). */
  dual(p: PaperParameters, Rk: number, pD: number): DualOutcome;
}

/** Tech A: weight on K in eq. (1) under the selected variant (MODEL_DEVIATIONS D1). */
export function techACapitalWeight(p: PaperParameters): number {
  return p.variant.techAWeight === 'capitalWeight' ? p.capitalShareParam : 1 - p.capitalShareParam;
}

/**
 * Technology A: Y = CES_ρ(K, X; weight w_K), X = CES_υ(D, L; weight φ).
 */
export const technologyA: TechnologyModel = {
  outerSpec: (p) => ({ weight1: techACapitalWeight(p), elasticity: p.elasticityKL }),
  innerSpec: (p) => ({ weight1: p.adoption, elasticity: p.elasticityAuto }),
  output(p, K, D, L) {
    const X = cesOutput(this.innerSpec(p), D, L);
    return { Y: cesOutput(this.outerSpec(p), K, X), X };
  },
  focs(p, Y, X, K, D, L) {
    const rho = p.elasticityKL;
    const ups = p.elasticityAuto;
    const phi = p.adoption;
    const thetaX = 1 - techACapitalWeight(p); // the paper's θ in eqs (4)–(6)
    const common = thetaX * Y ** (1 / rho) * X ** (1 / ups - 1 / rho);
    return {
      mpD: phi * common * D ** (-1 / ups), // (4)
      mpL: (1 - phi) * common * L ** (-1 / ups), // (5)
      mpK: (1 - thetaX) * Y ** (1 / rho) * K ** (-1 / rho), // (6)
    };
  },
  dual(p, Rk, pD) {
    const outer = this.outerSpec(p);
    const inner = this.innerSpec(p);
    // 1 = c_ρ(R_k, c_X)  →  c_X
    const cXr = cesInversePrice2(outer, 1, Rk);
    if (!cXr.ok) return { ok: false, stage: 'outer', failure: cXr, outerSlack: cXr.slack, innerSlack: NaN };
    const cX = cXr.price;
    // c_X = c_υ(p_D, p_L)  →  p_L
    const pLr = cesInversePrice2(inner, cX, pD);
    if (!pLr.ok)
      return { ok: false, stage: 'inner', failure: pLr, outerSlack: cXr.slack, innerSlack: pLr.slack };
    const pL = pLr.price;
    const [ky, xy] = cesUnitDemands(outer, Rk, cX);
    const [dx, lx] = cesUnitDemands(inner, pD, pL);
    return {
      ok: true,
      pL,
      cX,
      ratios: { ky, xy, dy: dx * xy, ly: lx * xy },
      outerSlack: cXr.slack,
      innerSlack: pLr.slack,
    };
  },
};

/**
 * Technology B: Y = CES_σ(D, X; weight μ), X = CES_ε(K, L; weight α).
 */
export const technologyB: TechnologyModel = {
  outerSpec: (p) => ({ weight1: p.adoption, elasticity: p.elasticityAuto }),
  innerSpec: (p) => ({ weight1: p.capitalShareParam, elasticity: p.elasticityKL }),
  output(p, K, D, L) {
    const X = cesOutput(this.innerSpec(p), K, L);
    return { Y: cesOutput(this.outerSpec(p), D, X), X };
  },
  focs(p, Y, X, K, D, L) {
    const sig = p.elasticityAuto;
    const eps = p.elasticityKL;
    const mu = p.adoption;
    const alpha = p.capitalShareParam;
    const common = (1 - mu) * Y ** (1 / sig) * X ** (1 / eps - 1 / sig);
    return {
      mpK: alpha * common * K ** (-1 / eps), // (13)
      mpL: (1 - alpha) * common * L ** (-1 / eps), // (14)
      mpD: mu * Y ** (1 / sig) * D ** (-1 / sig), // (15)
    };
  },
  dual(p, Rk, pD) {
    const outer = this.outerSpec(p);
    const inner = this.innerSpec(p);
    // 1 = c_σ(p_D, c_X)  →  c_X
    const cXr = cesInversePrice2(outer, 1, pD);
    if (!cXr.ok) return { ok: false, stage: 'outer', failure: cXr, outerSlack: cXr.slack, innerSlack: NaN };
    const cX = cXr.price;
    // c_X = c_ε(R_k, p_L)  →  p_L
    const pLr = cesInversePrice2(inner, cX, Rk);
    if (!pLr.ok)
      return { ok: false, stage: 'inner', failure: pLr, outerSlack: cXr.slack, innerSlack: pLr.slack };
    const pL = pLr.price;
    const [dy, xy] = cesUnitDemands(outer, pD, cX);
    const [kx, lx] = cesUnitDemands(inner, Rk, pL);
    return {
      ok: true,
      pL,
      cX,
      ratios: { dy, xy, ky: kx * xy, ly: lx * xy },
      outerSlack: cXr.slack,
      innerSlack: pLr.slack,
    };
  },
};

export function technologyModel(p: PaperParameters): TechnologyModel {
  return p.technology === 'A' ? technologyA : technologyB;
}
