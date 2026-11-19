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
      name: 'Share of employees above the SI ceiling: lognormal vs CYSTAT bands',
      model: shareAboveCeiling({ mean: x.meanMonthly, logSd: s }, x.monthlyCeiling),
      reference: x.observedShareAboveCeiling,
      units: 'fraction of employees',
      caveat:
        'Observed: share ≥ €5,750/month in 2025 (band edge €8 above the 2026 ceiling); also band-interpolated: ' +
        shareAboveFromBands(x.earningsBands, x.monthlyCeiling).toFixed(4),
    },
  ];
  if (r.steadyState.ok) {
    const ssPerFactorOutput = r.steadyState.government.ssTotal / r.steadyState.levels.Y;
    out.push(
      {
        name: 'Fund contributions (employee+employer, model) vs official Fund contribution income 2020, % of GDP',
        model: (ssPerFactorOutput * factorOutputForRatio) / gdpForRatio,
        reference: x.sifContributions2020 / x.gdp2020,
        units: 'fraction of GDP',
        caveat:
          'Reference is 2020 (COVID year), includes self-employed and possibly the state share; not a like-for-like target.',
      },
      {
        name: 'Fund contributions (employee+employer, model) vs Ageing Report 2022 employer+employee contributions, % of GDP',
        model: (ssPerFactorOutput * factorOutputForRatio) / gdpForRatio,
        reference: x.ageingReportEmployerEmployeePctGdp2022,
        units: 'fraction of GDP',
        caveat:
          "Ageing Report includes the public servants' pension scheme employee contribution; projection base year 2022.",
      },
    );
  }
  return out;
}
