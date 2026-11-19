/**
 * External cross-checks of the Cyprus calibration. These are comparisons, never targets: each one
 * states its definitional caveats.
 */
import type { CalibrationResult } from './calibration';
import {
  insurableShare,
  insurableShareFromBands,
  logSdFromMeanMedian,
  shareAboveCeiling,
  shareAboveFromBands,
  type EarningsBand,
} from './earningsDistribution';

export interface CrossCheck {
  readonly name: string;
  readonly model: number;
  readonly reference: number;
  readonly units: string;
  readonly caveat: string;
}

export interface CrossCheckInputs {
  readonly earningsBands: readonly EarningsBand[];
  readonly meanMonthly: number;
  readonly medianMonthly: number;
  readonly monthlyCeiling: number;
  readonly observedShareAboveCeiling: number;
  /** Official Fund contributions 2020 (€m) and GDP 2020 (€m). */
  readonly sifContributions2020: number;
  readonly gdp2020: number;
  /** Ageing Report 2022 employer + employee pension contributions, % GDP (includes GEPS). */
  readonly ageingReportEmployerEmployeePctGdp2022: number;
  readonly meanInsurableEarnings2023: number;
  readonly meanWagePerEmployee2023: number;
  readonly fundContributionsInclState2025: number;
  readonly gdp2025: number;
}

export function calibrationCrossChecks(
  r: CalibrationResult,
  x: CrossCheckInputs,
  gdpForRatio: number,
  factorOutputForRatio: number,
): CrossCheck[] {
  const s = logSdFromMeanMedian(x.meanMonthly, x.medianMonthly);
  const out: CrossCheck[] = [
    {
      name: `Insurable share of the wage bill: used (${r.derived.insurableShareMethod}) vs ${r.derived.insurableShareMethod === 'bands' ? 'lognormal' : 'band-based'} alternative`,
      model: r.derived.siInsurableShare,
      reference:
        r.derived.insurableShareMethod === 'bands'
          ? insurableShare({ mean: x.meanMonthly, logSd: s }, x.monthlyCeiling)
          : insurableShareFromBands(x.earningsBands, x.meanMonthly, x.monthlyCeiling),
      units: 'fraction',
      caveat:
        'Both from CYSTAT 2025 monthly earnings vs the 2026 monthly ceiling (one-year offset: 2026 wages are higher, so the true 2026 share is slightly lower). Bands: uniform within bands; lognormal: log-sd from mean/median.',
    },
    {
      name: 'Insurable share used vs SIS mean insurable earnings ÷ NA mean wage (2023)',
      model: r.derived.siInsurableShare,
      reference: x.meanInsurableEarnings2023 / x.meanWagePerEmployee2023,
      units: 'fraction',
      caveat:
        'SIS figure is for full contributors (excludes partial-year contributors); NA wage = D11 / employees.',
    },
    {
      name: 'Share of employees above the SI ceiling: lognormal vs CYSTAT bands',
      model: shareAboveCeiling({ mean: x.meanMonthly, logSd: s }, x.monthlyCeiling),
      reference: x.observedShareAboveCeiling,
      units: 'fraction of employees',
      caveat:
        'Observed: share ≥ €5,750/month in 2025 (band edge €8 above the 2026 ceiling); also band-interpolated: ' +
        shareAboveFromBands(x.earningsBands, x.monthlyCeiling).toFixed(4),
    },
  ];
  out.push({
    name: 'Fund contributions incl. state, % of GDP: 2025 (SIS, preliminary) vs 2020 (ILO)',
    model: x.fundContributionsInclState2025 / x.gdp2025,
    reference: x.sifContributions2020 / x.gdp2020,
    units: 'fraction of GDP',
    caveat: 'Both official Fund figures; shows the trend, not a model comparison. 2020 was a COVID year.',
  });
  if (r.steadyState.ok) {
    out.push({
      name: 'Model Fund contributions (excl. state) vs Ageing Report 2022 employer + employee, % of GDP',
      model:
        ((r.steadyState.government.ssTotal / r.steadyState.levels.Y) * factorOutputForRatio) / gdpForRatio,
      reference: x.ageingReportEmployerEmployeePctGdp2022,
      units: 'fraction of GDP',
      caveat: "Ageing Report includes the public servants' scheme employee contribution; base year 2022.",
    });
  }
  return out;
}
