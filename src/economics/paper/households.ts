/**
 * Household side, steady state (paper §3.2 and Appendix).
 */
import type { PaperParameters } from './types';

export type CapitalReturns =
  | { readonly ok: true; readonly Rk: number; readonly Rd: number }
  | { readonly ok: false; readonly detail: string };

/**
 * Steady-state rental rates from the Euler equations (25)–(26), Appendix form:
 *   R_k = [1/β − 1 + (1−τ^k)δ_k] / (1−τ^k)
 *   R_d = [(1+τ^id)/β − 1 − τ^id(1−δ_d) + (1−τ^k−τ^d)δ_d] / (1−τ^k−τ^d)
 * Depreciation is deductible from both capital-income tax bases (footnote 6).
 */
export function capitalReturns(p: PaperParameters): CapitalReturns {
  const { beta, deltaK, deltaD } = p;
  const { capital: tk, robotIncome: td, robotInvestment: tid } = p.taxes;
  if (!(tk < 1)) return { ok: false, detail: `1 − τk must be > 0 (τk = ${tk})` };
  if (!(tk + td < 1)) return { ok: false, detail: `1 − τk − τd must be > 0 (τk + τd = ${tk + td})` };
  const Rk = (1 / beta - 1 + (1 - tk) * deltaK) / (1 - tk);
  const Rd = ((1 + tid) / beta - 1 - tid * (1 - deltaD) + (1 - tk - td) * deltaD) / (1 - tk - td);
  if (!(Rk > 0 && Rd > 0)) return { ok: false, detail: `non-positive rental rate (Rk=${Rk}, Rd=${Rd})` };
  return { ok: true, Rk, Rd };
}

/**
 * Tax wedges in labour supply (24): (wc)·C = γ/(1−γ)·(1−L)·W·(ww).
 * 'asPrinted': wc = 1+τ^c, ww = 1−τ^l−τ^ssw. 'figureReplication': wc = ww = 1 (MODEL_DEVIATIONS D2).
 */
export function labourSupplyWedges(p: PaperParameters): { consumption: number; wage: number } {
  if (p.variant.labourSupply === 'figureReplication') return { consumption: 1, wage: 1 };
  return { consumption: 1 + p.taxes.consumption, wage: 1 - p.taxes.labour - p.taxes.employeeSS };
}

/**
 * Hours from (24) given per-unit-of-output ratios. With C = (C/Y)·L/(L/Y), (24) is linear in L:
 *   L = A / (A + B),  A = γ/(1−γ)·W·ww,  B = wc·(C/Y)/(L/Y).
 */
export function hoursFromLabourSupply(p: PaperParameters, W: number, cy: number, ly: number): number {
  const w = labourSupplyWedges(p);
  const A = (p.gamma / (1 - p.gamma)) * W * w.wage;
  const B = (w.consumption * cy) / ly;
  return A / (A + B);
}
