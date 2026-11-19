/**
 * Government accounts (paper §3.3, eq. (33)), factor shares, and accounting diagnostics.
 */
import type { FactorShares, GovernmentAccounts, PaperParameters, SteadyStateLevels } from './types';

/** Revenue of exploratory policies E/F/G and pure profit (rents extension) at given levels. */
export function policyRevenues(
  p: PaperParameters,
  s: SteadyStateLevels,
): {
  valueAdded: number;
  labourShare: number;
  excessProfit: number;
  excessProfitOnRents: number;
  pureProfit: number;
} {
  const x = p.extensions;
  const E = x?.valueAdded;
  const F = x?.labourShare;
  const G = x?.excessProfit;
  const labourCost = (1 + p.taxes.employerSS) * s.W * s.L;
  const e = E ? E.rate * E.coverage : 0;
  // Rents extension: markup pricing ⇒ pure profit Π = m/(1+m)·(1 − e)·Y (F excluded by construction).
  const m = x?.rents?.markup ?? 0;
  const pureProfit = (m / (1 + m)) * (1 - e) * s.Y;
  const onCapital = G
    ? G.rate *
      (Math.max(0, s.Rk - p.deltaK - G.normalReturn) * s.K +
        Math.max(0, s.Rd - p.deltaD - (G.normalReturnD ?? G.normalReturn)) * s.D)
    : 0;
  const onRents = G ? G.rate * pureProfit : 0;
  return {
    valueAdded: e * s.Y,
    labourShare: F ? F.rate * F.coverage * Math.max(0, F.benchmark * s.Y - labourCost) : 0,
    excessProfit: onCapital + onRents,
    excessProfitOnRents: onRents,
    pureProfit,
  };
}

export function governmentAccounts(p: PaperParameters, s: SteadyStateLevels): GovernmentAccounts {
  const t = p.taxes;
  const wageBill = s.W * s.L;
  const consumptionTax = t.consumption * s.C;
  const labourIncomeTax = t.labour * wageBill;
  const employeeSS = t.employeeSS * wageBill;
  const employerSS = t.employerSS * wageBill;
  const traditionalCapitalTax = t.capital * (s.Rk - p.deltaK) * s.K;
  const autonomousCapitalGeneralTax = t.capital * (s.Rd - p.deltaD) * s.D;
  const robotIncomeTax = t.robotIncome * (s.Rd - p.deltaD) * s.D;
  const robotInvestmentTax = t.robotInvestment * s.Id;
  const robotSS = t.robotSS * s.Rd * s.D;
  const pol = policyRevenues(p, s);
  const total =
    pol.valueAdded +
    pol.labourShare +
    pol.excessProfit +
    consumptionTax +
    labourIncomeTax +
    employeeSS +
    employerSS +
    traditionalCapitalTax +
    autonomousCapitalGeneralTax +
    robotIncomeTax +
    robotInvestmentTax +
    robotSS;
  const ssLabour = employeeSS + employerSS;
  const ssRobot = robotIncomeTax + robotInvestmentTax + robotSS; // D5: earmarked for SS
  const ssPolicy = pol.valueAdded + pol.labourShare + pol.excessProfit;
  return {
    consumptionTax,
    labourIncomeTax,
    employeeSS,
    employerSS,
    traditionalCapitalTax,
    autonomousCapitalGeneralTax,
    robotIncomeTax,
    robotInvestmentTax,
    robotSS,
    valueAddedContribution: pol.valueAdded,
    labourShareContribution: pol.labourShare,
    excessProfitContribution: pol.excessProfit,
    excessProfitOnRents: pol.excessProfitOnRents,
    excessProfitOnCapitalReturns: pol.excessProfit - pol.excessProfitOnRents,
    total,
    ssLabour,
    ssRobot,
    ssPolicy,
    ssTotal: ssLabour + ssRobot + ssPolicy,
  };
}

/**
 * Eq. (33) written literally, as an independent cross-check of the itemised accounts:
 * T = τc C + (τl+τssw+τsse) W L + τk (Rk−δk) K + (τk+τd+τssz) Rd D − (τk+τd) δd D + τid Id.
 */
export function eq33Revenue(p: PaperParameters, s: SteadyStateLevels): number {
  const t = p.taxes;
  const pol = policyRevenues(p, s);
  return (
    pol.valueAdded +
    pol.labourShare +
    pol.excessProfit +
    t.consumption * s.C +
    (t.labour + t.employeeSS + t.employerSS) * s.W * s.L +
    t.capital * (s.Rk - p.deltaK) * s.K +
    (t.capital + t.robotIncome + t.robotSS) * s.Rd * s.D -
    (t.capital + t.robotIncome) * p.deltaD * s.D +
    t.robotInvestment * s.Id
  );
}

export function factorShares(p: PaperParameters, s: SteadyStateLevels): FactorShares {
  const t = p.taxes;
  const labourCost = (1 + t.employerSS) * s.W * s.L;
  const depK = p.deltaK * s.K;
  const depD = p.deltaD * s.D;
  const pol = policyRevenues(p, s);
  // Contributions paid by firms (E, F) are not factor income; net shares are over factor incomes.
  const netY = s.Y - pol.valueAdded - pol.labourShare - depK - depD;
  return {
    grossLabour: (s.W * s.L) / s.Y,
    grossTraditionalCapital: (s.Rk * s.K) / s.Y,
    grossAutonomousCapital: (s.Rd * s.D) / s.Y,
    employerSSLabour: (t.employerSS * s.W * s.L) / s.Y,
    employerSSRobot: (t.robotSS * s.Rd * s.D) / s.Y,
    netLabour: labourCost / netY,
    firmPolicyContributions: (pol.valueAdded + pol.labourShare) / s.Y,
    pureProfit: pol.pureProfit / s.Y,
    netTraditionalCapital: (s.Rk * s.K - depK) / netY,
    netAutonomousCapital: ((1 + t.robotSS) * s.Rd * s.D - depD) / netY,
  };
}

/**
 * Household budget constraint (20) residual (LHS − RHS)/Y with T from (33). Holds by Walras' law
 * when firms make zero profit and the resource constraint holds; checked independently.
 */
export function householdBudgetResidual(p: PaperParameters, s: SteadyStateLevels, T: number): number {
  const t = p.taxes;
  const lhs = (1 + t.consumption) * s.C + s.Ik + (1 + t.robotInvestment) * s.Id;
  const rhs =
    (1 - t.labour - t.employeeSS) * s.W * s.L +
    (1 - t.capital) * s.Rk * s.K +
    (1 - t.capital - t.robotIncome) * s.Rd * s.D +
    t.capital * p.deltaK * s.K +
    (t.capital + t.robotIncome) * p.deltaD * s.D -
    policyRevenues(p, s).excessProfit + // paid by capital owners
    policyRevenues(p, s).pureProfit + // rents distributed to households (rents extension)
    T;
  return (lhs - rhs) / s.Y;
}
