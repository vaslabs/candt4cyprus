/** Policy configuration type and defaults (dependency-free so the UI can import it cheaply). */
export interface PolicyConfig {
  /** E: share of GVA liable (size thresholds, minimum VA and sector exemptions). */
  readonly valueAddedCoverage: number;
  /** F: benchmark labour share s̄ (employee compensation / GVA) and liable share of GVA. */
  readonly labourShareBenchmark: number;
  readonly labourShareCoverage: number;
  /**
   * G: allowance. 'neutral' (primary) = each capital's own required pre-tax net return, including the
   * effect of robot taxes; in the competitive model G then raises nothing on capital returns.
   */
  readonly excessProfitAllowance: 'neutral' | { readonly rate: number };
  /** G′ (capital-return levy): allowance = this fraction of each capital's neutral return (< 1). */
  readonly capitalReturnLevyFraction: number;
  /** Share ψ ∈ [0,1] of the employer SS rate replaced when the instrument is introduced (0 = supplement). */
  readonly payrollReplacement: number;
}

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  valueAddedCoverage: 1,
  labourShareBenchmark: 0.5,
  labourShareCoverage: 1,
  excessProfitAllowance: 'neutral',
  capitalReturnLevyFraction: 0.5,
  payrollReplacement: 0,
};
