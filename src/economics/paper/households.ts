/**
 * Household side, steady state (paper §3.2 and Appendix).
 */
import type { PaperParameters } from './types';

export type ExcessProfitRegime = 'inactive' | 'binding' | 'non-binding';

export type CapitalReturns =
  | {
      readonly ok: true;
      readonly Rk: number;
      readonly Rd: number;
      readonly excessProfitK: ExcessProfitRegime;
      readonly excessProfitD: ExcessProfitRegime;
    }
  | { readonly ok: false; readonly detail: string };

/**
 * Steady-state rental rates from the Euler equations (25)–(26), Appendix form:
 *   R_k = [1/β − 1 + (1−τ^k)δ_k] / (1−τ^k)
 *   R_d = [(1+τ^id)/β − 1 − τ^id(1−δ_d) + (1−τ^k−τ^d)δ_d] / (1−τ^k−τ^d)
 * Depreciation is deductible from both capital-income tax bases (footnote 6).
 *
 * Exploratory policy G (excess profit, rate g, allowance r on net returns) adds −g·(R−δ−r)⁺ to each
 * capital's after-tax return. With ρ = 1/β − 1 and A = (1+τ^id)/β − (1+τ^id)(1−δ_d) − (τ^k+τ^d)δ_d:
 *   K binding:  R_k − δ_k = (ρ − g r)/(1−τ^k−g)
 *   D binding:  (1−τ^k−τ^d−g)R_d = A − g(δ_d + r)
 * Each binding regime applies iff the no-G net return exceeds r (the two conditions coincide).
 */
export function capitalReturns(p: PaperParameters): CapitalReturns {
  const { beta, deltaK, deltaD } = p;
  const { capital: tk, robotIncome: td, robotInvestment: tid } = p.taxes;
  if (!(tk < 1)) return { ok: false, detail: `1 − τk must be > 0 (τk = ${tk})` };
  if (!(tk + td < 1)) return { ok: false, detail: `1 − τk − τd must be > 0 (τk + τd = ${tk + td})` };
  const rho = 1 / beta - 1;
  let Rk = (rho + (1 - tk) * deltaK) / (1 - tk);
  const A = (1 + tid) / beta - 1 - tid * (1 - deltaD) + (1 - tk - td) * deltaD; // (1−τk−τd)·Rd without G
  let Rd = A / (1 - tk - td);
  let excessProfitK: ExcessProfitRegime = 'inactive';
  let excessProfitD: ExcessProfitRegime = 'inactive';
  const G = p.extensions?.excessProfit;
  if (G && G.rate > 0) {
    const g = G.rate;
    const r = G.normalReturn;
    // Ties (net return = allowance, e.g. the neutral design) are classified as non-binding: the
    // contribution due is zero either way; a 1e-12 relative tolerance absorbs rounding.
    const exceeds = (net: number) => net > r + 1e-12 * Math.max(1, Math.abs(r));
    // The binding-regime denominators must stay positive; a non-binding G imposes no constraint.
    if (exceeds(Rk - deltaK)) {
      if (!(tk + g < 1)) return { ok: false, detail: `τk + τ_G must be < 1 when G binds on K` };
      Rk = deltaK + (rho - g * r) / (1 - tk - g);
      excessProfitK = 'binding';
    } else excessProfitK = 'non-binding';
    const rD = G.normalReturnD ?? r;
    if (Rd - deltaD > rD + 1e-12 * Math.max(1, Math.abs(rD))) {
      if (!(tk + td + g < 1)) return { ok: false, detail: `τk + τd + τ_G must be < 1 when G binds on D` };
      Rd = (A - g * (deltaD + rD)) / (1 - tk - td - g);
      excessProfitD = 'binding';
    } else excessProfitD = 'non-binding';
  }
  if (!(Rk > 0 && Rd > 0)) return { ok: false, detail: `non-positive rental rate (Rk=${Rk}, Rd=${Rd})` };
  return { ok: true, Rk, Rd, excessProfitK, excessProfitD };
}

/** Required pre-tax net return on TRADITIONAL capital without policy G (neutral allowance for K). */
export function neutralExcessProfitAllowance(p: PaperParameters): number {
  return (1 / p.beta - 1) / (1 - p.taxes.capital);
}

/**
 * Neutral allowances for both capitals: each capital's required pre-tax net return absent G
 * (R − δ from the Euler equations with all other taxes, including robot taxes). With these
 * allowances G raises nothing on capital returns in the competitive model.
 */
export function neutralAllowances(p: PaperParameters): { K: number; D: number } {
  const ext = { ...(p.extensions ?? {}) };
  delete (ext as { excessProfit?: unknown }).excessProfit;
  const r = capitalReturns({ ...p, extensions: ext });
  if (!r.ok) throw new Error(`no capital returns: ${r.detail}`);
  return { K: r.Rk - p.deltaK, D: r.Rd - p.deltaD };
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
