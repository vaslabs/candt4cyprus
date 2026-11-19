/**
 * Three EXPLICITLY HYPOTHETICAL company archetypes for illustration only. The figures are
 * invented round numbers chosen to span different labour intensities. They are not
 * estimates of any real Cypriot firm or sector average.
 */
import { salaryWith13th } from '../cyprus/earningsAttribution';
import type { FirmInputs, FirmPolicyConfig } from './firmModel';

/** Annual pay including a 13th salary, attributed per Reg. 8(3). */
const pay13 = (annualTotal: number) => salaryWith13th((annualTotal * 12) / 13);

export const ARCHETYPES: readonly FirmInputs[] = [
  {
    name: 'Hypothetical labour-intensive hospitality company',
    sector: 'I',
    hypothetical: true,
    revenue: 5_000_000,
    intermediateConsumption: 2_600_000,
    outsourcedLabourCosts: 150_000,
    employees: [
      { label: 'service staff', headcount: 60, earnings: pay13(16_000) },
      { label: 'supervisors', headcount: 15, earnings: pay13(26_000) },
      { label: 'managers', headcount: 5, earnings: pay13(48_000) },
    ],
    depreciation: 250_000,
    capitalStock: 4_000_000,
    aiInvestment: 20_000,
    lossesBroughtForward: 0,
    maxProfitShifting: 0.02,
  },
  {
    name: 'Hypothetical financial / professional services company',
    sector: 'M',
    hypothetical: true,
    revenue: 12_000_000,
    intermediateConsumption: 3_500_000,
    outsourcedLabourCosts: 400_000,
    employees: [
      { label: 'associates', headcount: 20, earnings: pay13(30_000) },
      { label: 'seniors', headcount: 25, earnings: pay13(55_000) },
      { label: 'managers', headcount: 10, earnings: pay13(90_000) },
      { label: 'partners', headcount: 5, earnings: pay13(160_000) },
    ],
    depreciation: 300_000,
    capitalStock: 2_000_000,
    aiInvestment: 300_000,
    lossesBroughtForward: 0,
    maxProfitShifting: 0.15,
  },
  {
    name: 'Hypothetical highly automated software company',
    sector: 'J',
    hypothetical: true,
    revenue: 30_000_000,
    intermediateConsumption: 6_000_000,
    outsourcedLabourCosts: 1_500_000,
    employees: [
      { label: 'engineers', headcount: 10, earnings: pay13(60_000) },
      { label: 'senior engineers', headcount: 10, earnings: pay13(110_000) },
      { label: 'leadership', headcount: 5, earnings: pay13(200_000) },
    ],
    depreciation: 2_500_000,
    capitalStock: 10_000_000,
    aiInvestment: 3_000_000,
    lossesBroughtForward: 1_000_000,
    maxProfitShifting: 0.5,
  },
];

/** Illustrative default policy settings (assumptions; every value is user-editable). */
export const DEFAULT_FIRM_POLICY: FirmPolicyConfig = {
  valueAdded: {
    rate: 0.02,
    minEmployees: 10,
    minGva: 500_000,
    exemptSectors: [],
    baseElasticity: 0.2,
    payrollReplacement: 0,
  },
  labourShare: {
    rate: 0.2,
    benchmarks: { default: 0.5 },
    minEmployees: 10,
    outsourcingCountedAsLabour: 0.5,
    minOperatingMargin: 0.1,
    capShareOfProfit: 0.25,
    baseElasticity: 0.3,
  },
  excessProfit: {
    rate: 0.2,
    normalReturn: 0.06,
    investmentAllowance: 1,
    useLossCarryforward: true,
    shiftingSemiElasticity: 1,
  },
};
