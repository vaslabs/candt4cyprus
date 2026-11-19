import fc from 'fast-check';
import { MIN_POSITIVE_ADOPTION, paperParameters } from '../../src/economics/paper/calibration';
import { existenceBoundary } from '../../src/economics/paper/existence';
import { existenceMargin } from '../../src/economics/paper/steadyState';
import type { PaperParameters, TaxRates } from '../../src/economics/paper/types';

const d = (min: number, max: number) => fc.double({ min, max, noNaN: true });

/** At most one robot tax is active per simulation (paper §3.3). */
const robotTaxes = fc.oneof(
  fc.constant({ robotIncome: 0, robotInvestment: 0, robotSS: 0 }),
  d(0, 0.5).map((v) => ({ robotIncome: v, robotInvestment: 0, robotSS: 0 })),
  d(0, 0.6).map((v) => ({ robotIncome: 0, robotInvestment: v, robotSS: 0 })),
  d(0, 0.6).map((v) => ({ robotIncome: 0, robotInvestment: 0, robotSS: v })),
);

const taxes: fc.Arbitrary<TaxRates> = fc
  .record({
    consumption: d(0, 0.3),
    labour: d(0, 0.4),
    employerSS: d(0, 0.3),
    employeeSS: d(0, 0.2),
    capital: d(0, 0.35),
    robot: robotTaxes,
  })
  .map(({ robot, ...rest }) => ({ ...rest, ...robot }));

/** Elasticities including the exact Cobb–Douglas value 1. */
const elasticityKL = fc.oneof(d(0.5, 1.5), fc.constant(1));
const elasticityAuto = fc.oneof(d(1.05, 4), fc.constant(1), fc.constant(2));

/**
 * Random but economically valid parameter sets. Adoption is drawn as a fraction of the distance to
 * the analytic existence boundary (capped at 0.9) so every draw has a finite steady state.
 */
export const paperParams = (maxBoundaryFraction = 0.97): fc.Arbitrary<PaperParameters> =>
  fc
    .record({
      technology: fc.constantFrom('A' as const, 'B' as const),
      beta: d(0.9, 0.99),
      gamma: d(0.2, 0.8),
      deltaK: d(0.02, 0.15),
      deltaD: d(0.05, 0.4),
      capitalShareParam: d(0.2, 0.5),
      elasticityKL,
      elasticityAuto,
      taxes,
      techAWeight: fc.constantFrom('capitalWeight' as const, 'asPrinted' as const),
      labourSupply: fc.constantFrom('asPrinted' as const, 'figureReplication' as const),
      u: d(0, 1),
    })
    .map(({ technology, techAWeight, labourSupply, u, ...rest }) => ({
      base: paperParameters(technology, { ...rest, variant: { techAWeight, labourSupply } }),
      u,
    }))
    // Some parameter sets have no finite steady state even without robots (e.g. K-weight 0.8
    // with ρ > 1 is AK in traditional capital). They are excluded here and tested separately.
    .filter(({ base }) => existenceMargin(base) > 1e-6)
    .map(({ base, u }) => {
      const b = existenceBoundary(base, 0, 0.9, 100);
      const cap = b.kind === 'boundary' ? b.adoption * maxBoundaryFraction : 0.9;
      // Domain: adoption = 0 exactly, or ≥ MIN_POSITIVE_ADOPTION (see calibration.ts).
      const adoption = u < 0.05 ? 0 : Math.max(MIN_POSITIVE_ADOPTION, u * cap);
      return { ...base, adoption };
    });
