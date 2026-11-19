/**
 * Domain types for the Casas & Torres (2026) model (Level 1, paper replication).
 * All quantities are steady-state model units: output price = 1, total time endowment = 1.
 */

export type Technology = 'A' | 'B';

/**
 * Equation variants (see docs/MODEL_DEVIATIONS.md).
 * - techAWeight: where Table 1's θ = 0.35 goes in Tech A eq. (1).
 *     'capitalWeight' → weight θ on K (matches Table 1 wording and Figs 1, 8)  [D1 default]
 *     'asPrinted'     → weight θ on X, exactly as typeset in eq. (1)
 * - labourSupply: eq. (24).
 *     'asPrinted'          → (1+τc)C = γ/(1−γ)(1−L)W(1−τl−τssw)                 [D2 default]
 *     'figureReplication'  → C = γ/(1−γ)(1−L)W  (tax wedges removed; reproduces Fig. 6–7 levels)
 */
export interface EquationVariant {
  readonly techAWeight: 'capitalWeight' | 'asPrinted';
  readonly labourSupply: 'asPrinted' | 'figureReplication';
}

export const DEFAULT_VARIANT: EquationVariant = { techAWeight: 'capitalWeight', labourSupply: 'asPrinted' };

/** Tax rates as fractions (0.1832 = 18.32%). Paper Table 1. */
export interface TaxRates {
  /** τ^c consumption tax. */
  readonly consumption: number;
  /** τ^l labour income tax. */
  readonly labour: number;
  /** τ^sse employer social-security contribution on wages. */
  readonly employerSS: number;
  /** τ^ssw employee social-security contribution. */
  readonly employeeSS: number;
  /** τ^k capital income tax (both capitals). */
  readonly capital: number;
  /** τ^d additional income tax on autonomous capital (scheme 1). */
  readonly robotIncome: number;
  /** τ^id ad-valorem tax on autonomous-capital investment (scheme 2). */
  readonly robotInvestment: number;
  /** τ^ssz employer social-security contribution on autonomous capital, base R_d·D (scheme 3). */
  readonly robotSS: number;
}

/**
 * Exploratory policy extensions (Level 2; NOT part of Casas & Torres). See docs/policies/POLICIES.md.
 * All rates are fractions; `coverage` is the share of output produced by firms liable to the
 * contribution (a representative-firm approximation of size thresholds and sector exemptions).
 */
export interface PolicyExtensions {
  /** E: contribution on firm gross value added (GVA = Y at factor cost in the model). */
  readonly valueAdded?: { readonly rate: number; readonly coverage: number };
  /**
   * F: labour-share-adjusted contribution, τ_F × max(0, s̄·GVA − employee compensation), where
   * employee compensation = (1+τ^sse)·W·L (employer SS included, as in national accounts D1).
   */
  readonly labourShare?: { readonly rate: number; readonly benchmark: number; readonly coverage: number };
  /**
   * G: excess-economic-profit contribution, τ_G × (R − δ − r_n)⁺ per unit of each capital, paid by
   * capital owners. With r_n equal to the required pre-tax net return the policy is neutral.
   */
  readonly excessProfit?: { readonly rate: number; readonly normalReturn: number };
}

export interface PaperParameters {
  readonly technology: Technology;
  /** β discount factor. */
  readonly beta: number;
  /** γ consumption weight in utility (19). */
  readonly gamma: number;
  /** δ_k traditional capital depreciation. */
  readonly deltaK: number;
  /** δ_d autonomous capital depreciation. */
  readonly deltaD: number;
  /** Table 1 θ (Tech A) / α (Tech B): "traditional capital share" distribution parameter. */
  readonly capitalShareParam: number;
  /** ρ (Tech A) / ε (Tech B): elasticity between traditional capital and (effective) labour. */
  readonly elasticityKL: number;
  /** υ (Tech A) / σ (Tech B): elasticity involving autonomous capital. */
  readonly elasticityAuto: number;
  /** φ (Tech A) / μ (Tech B): autonomous-capital adoption parameter, a CES weight in [0, 1). */
  readonly adoption: number;
  readonly taxes: TaxRates;
  readonly variant: EquationVariant;
  /** Exploratory policies E/F/G; absent in the paper replication. */
  readonly extensions?: PolicyExtensions;
}

/** Endogenous steady-state values: the paper's 10 unknowns plus derived investment split. */
export interface SteadyStateLevels {
  readonly Y: number;
  readonly C: number;
  readonly K: number;
  readonly D: number;
  readonly L: number;
  readonly X: number;
  readonly W: number;
  readonly I: number;
  readonly Rk: number;
  readonly Rd: number;
  readonly Ik: number;
  readonly Id: number;
}

export interface GovernmentAccounts {
  readonly consumptionTax: number;
  readonly labourIncomeTax: number;
  readonly employeeSS: number;
  readonly employerSS: number;
  /** τ^k (R_k − δ_k) K. */
  readonly traditionalCapitalTax: number;
  /** τ^k (R_d − δ_d) D. */
  readonly autonomousCapitalGeneralTax: number;
  /** Scheme 1 revenue τ^d (R_d − δ_d) D. */
  readonly robotIncomeTax: number;
  /** Scheme 2 revenue τ^id I_d. */
  readonly robotInvestmentTax: number;
  /** Scheme 3 revenue τ^ssz R_d D. */
  readonly robotSS: number;
  /** Policy E revenue τ_E·c_E·Y. */
  readonly valueAddedContribution: number;
  /** Policy F revenue τ_F·c_F·(s̄Y − LC)⁺. */
  readonly labourShareContribution: number;
  /** Policy G revenue τ_G·Σ(R − δ − r_n)⁺·capital. */
  readonly excessProfitContribution: number;
  /** Eq. (33) total, returned lump-sum. */
  readonly total: number;
  /** Labour-source SS: (τ^sse + τ^ssw) W L. */
  readonly ssLabour: number;
  /** Robot-source SS: the active robot tax's revenue (D5). */
  readonly ssRobot: number;
  /** Revenue of exploratory policies E/F/G, earmarked for SS (by construction of the comparison). */
  readonly ssPolicy: number;
  readonly ssTotal: number;
}

export interface FactorShares {
  /** Gross shares, eqs (7)–(9) / (16)–(18): W L / Y, R_k K / Y, R_d D / Y. */
  readonly grossLabour: number;
  readonly grossTraditionalCapital: number;
  readonly grossAutonomousCapital: number;
  /** Employer contributions as shares of Y: τ^sse W L / Y, τ^ssz R_d D / Y. */
  readonly employerSSLabour: number;
  readonly employerSSRobot: number;
  /** Policy E and F contributions paid by firms, as a share of Y (0 in the replication). */
  readonly firmPolicyContributions: number;
  /**
   * Net shares (D3): (factor income − its depreciation) / (Y − δ_k K − δ_d D), with labour income
   * measured as total labour cost (1+τ^sse) W L. Not defined in the paper; see MODEL_DEVIATIONS D3.
   */
  readonly netLabour: number;
  readonly netTraditionalCapital: number;
  readonly netAutonomousCapital: number;
}

export type SolverName = 'dual' | 'newton';

export type NonExistenceReason =
  /**
   * Autonomous capital alone produces below the zero-profit price, so the inputs it competes with
   * (labour in Tech A; the K–L bundle in Tech B) cannot be priced finitely: AK-type explosion,
   * Y, D → ∞ and L → 0 as the boundary is approached.
   */
  | 'robots-dominate'
  /** Another CES stage has no positive finite price (e.g. an essential input too expensive). */
  | 'stage-infeasible'
  /** Steady-state depreciation exceeds output (C ≤ 0). */
  | 'non-positive-consumption'
  /** Household Euler returns undefined (e.g. 1 − τ^k − τ^d ≤ 0). */
  | 'invalid-capital-returns';

export interface ConvergenceInfo {
  readonly status: 'converged' | 'analytic' | 'failed' | 'no-steady-state';
  readonly residualNorm: number;
  readonly iterations: number;
  /** κ₁ of the full-system Jacobian (log variables) at the reported point; NaN when not computed. */
  readonly jacobianCondition: number;
  readonly message: string;
}

export interface RunMetadata {
  readonly technology: Technology;
  readonly equationVariant: EquationVariant;
  readonly calibrationPreset: string;
  readonly solver: SolverName;
  readonly convergence: ConvergenceInfo;
}

export type LabourShareRegime = 'inactive' | 'binding' | 'non-binding' | 'kink';

export interface PolicyRegimes {
  readonly labourShare: LabourShareRegime;
  readonly excessProfitK: 'inactive' | 'binding' | 'non-binding';
  readonly excessProfitD: 'inactive' | 'binding' | 'non-binding';
}

export interface SteadyStateDiagnostics {
  /** Existence slack of each CES stage (> 0 ⇔ a finite steady state exists). */
  readonly outerSlack: number;
  readonly innerSlack: number;
  /** Labour's share of total factor cost, (1+τ^sse) W L / Y. Ill-conditioning ∝ 1/this. */
  readonly labourCostShare: number;
  /** Euler/zero-profit check: (1+τ^sse)S_l + S_k + (1+τ^ssz)S_d − 1. */
  readonly eulerResidual: number;
  /** C + I − Y, relative to Y. */
  readonly resourceResidual: number;
  /** Household budget (20) residual relative to Y, using T from (33). */
  readonly householdBudgetResidual: number;
  /** Active regimes of exploratory policies (all 'inactive' in the replication). */
  readonly regimes: PolicyRegimes;
  /** Net output price faced by firms (1 without E/F). */
  readonly firmNetPrice: number;
}

export type SteadyStateResult =
  | {
      readonly ok: true;
      readonly levels: SteadyStateLevels;
      readonly government: GovernmentAccounts;
      readonly shares: FactorShares;
      /** SS contributions / Y. */
      readonly ssToGdp: number;
      readonly diagnostics: SteadyStateDiagnostics;
      readonly meta: RunMetadata;
    }
  | {
      readonly ok: false;
      /**
       * NonExistenceReason: the model has no finite steady state (established analytically).
       * 'solver-failed': Newton did not converge (numerical, says nothing about existence).
       * 'numerical-range': a steady state exists but a price lies outside double range.
       */
      readonly reason: NonExistenceReason | 'solver-failed' | 'numerical-range';
      readonly detail: string;
      readonly slack?: number;
      readonly meta: RunMetadata;
    };
