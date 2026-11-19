/**
 * Proposition 3 (MODEL_SPEC §5a): closed-form required robot-tax rates under Technology A.
 *
 * In Tech A, R_k alone fixes the unit cost c_X of the effective-labour aggregate and hence its
 * cost share s_X = c_X·X/Y, which is independent of adoption φ, the elasticity υ, and every robot
 * tax. Labour cost plus robot cost exhaust s_X. With a ≡ (τ^sse+τ^ssw)/(1+τ^sse) the SS
 * yield per unit of labour cost, the baseline target is a·s_X, and holding SS/Y at that target
 * requires the robot source to yield `a` per unit of robot cost:
 *
 *   scheme 3: τ^ssz/(1+τ^ssz) = a          ⇒ τ^ssz = (τ^sse+τ^ssw)/(1−τ^ssw)
 *   scheme 1: τ^d (R_d−δ_d) = a R_d         ⇒ τ^d  = a(1/β−1+(1−τ^k)δ_d) / (1/β−1+aδ_d)
 *   scheme 2: τ^id δ_d = a R_d              ⇒ τ^id = a(1/β−1+(1−τ^k)δ_d) / ((1−τ^k)δ_d − a(1/β−1+δ_d))
 *
 * (R_d depends on the robot tax through eq. 26, which makes schemes 1 and 2 linear in τ.)
 *
 * Conditions: Tech A (either D1 variant), target = adoption-0 SS/Y, a steady state exists.
 * These formulas are used only as independent test oracles, never inside the solver.
 */
import type { PaperParameters } from '../paper/types';

export function techAClosedFormRates(p: PaperParameters): {
  robotIncome: number;
  robotInvestment: number;
  robotSS: number;
} {
  const { employerSS: sse, employeeSS: ssw, capital: tk } = p.taxes;
  const a = (sse + ssw) / (1 + sse);
  const r = 1 / p.beta - 1;
  const dd = p.deltaD;
  return {
    robotSS: (sse + ssw) / (1 - ssw),
    robotIncome: (a * (r + (1 - tk) * dd)) / (r + a * dd),
    robotInvestment: (a * (r + (1 - tk) * dd)) / ((1 - tk) * dd - a * (r + dd)),
  };
}
