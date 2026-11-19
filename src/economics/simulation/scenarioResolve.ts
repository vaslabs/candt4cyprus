/** Resolve a scenario to model parameters through the same code paths as the reports. */
import { paperParameters, PAPER_PRESET_ID } from '../paper/calibration';
import type { PaperParameters } from '../paper/types';
import { calibrateCyprus, CYPRUS_PRESET_ID, type CalibrationResult } from '../cyprus/calibration';
import {
  cyprusAssumptions,
  cyprusMonthlyEarnings,
  cyprusNationalAccounts2023,
  cyprusStatutoryRules,
  loadCyprusDataset,
} from '../cyprus/defaults';
import { baselineSsTarget } from '../policies/robotTaxes';
import type { Scenario } from './scenario';

export interface ResolvedScenario {
  readonly params: PaperParameters;
  /** SS/Y target: the scenario economy's zero-adoption ratio. */
  readonly target: number;
  readonly presetId: string;
  readonly calibration: CalibrationResult | null;
}

let cyprusCache: {
  rules: ReturnType<typeof cyprusStatutoryRules>;
  dataset: ReturnType<typeof loadCyprusDataset>['dataset'];
} | null = null;
function cyprusInputs() {
  if (!cyprusCache) {
    const { dataset } = loadCyprusDataset();
    cyprusCache = { dataset, rules: cyprusStatutoryRules(dataset) };
  }
  return cyprusCache;
}

export function resolveScenario(s: Scenario): ResolvedScenario {
  let params: PaperParameters;
  let calibration: CalibrationResult | null = null;
  if (s.preset === 'paper') {
    params = paperParameters(s.technology, {
      adoption: s.adoption,
      variant: { techAWeight: s.techAWeight, labourSupply: s.labourSupply },
      ...(s.overrides.elasticityKL !== undefined ? { elasticityKL: s.overrides.elasticityKL } : {}),
      ...(s.overrides.elasticityAuto !== undefined ? { elasticityAuto: s.overrides.elasticityAuto } : {}),
      ...(s.overrides.deltaD !== undefined ? { deltaD: s.overrides.deltaD } : {}),
      ...(s.overrides.beta !== undefined ? { beta: s.overrides.beta } : {}),
    });
  } else {
    const { dataset, rules } = cyprusInputs();
    const a = cyprusAssumptions(dataset, s.technology);
    calibration = calibrateCyprus(
      cyprusNationalAccounts2023(dataset),
      rules,
      {
        ...a,
        ...(s.overrides.elasticityKL !== undefined ? { elasticityKL: s.overrides.elasticityKL } : {}),
        ...(s.overrides.elasticityAuto !== undefined ? { elasticityAuto: s.overrides.elasticityAuto } : {}),
        ...(s.overrides.deltaD !== undefined ? { deltaD: s.overrides.deltaD } : {}),
        betaMode:
          s.overrides.beta !== undefined
            ? { kind: 'fixed', beta: s.overrides.beta }
            : s.betaMode === 'capitalOutput'
              ? { kind: 'fromCapitalOutput' }
              : (a.betaMode ?? { kind: 'fixed', beta: 0.975 }),
      },
      cyprusMonthlyEarnings(dataset),
    );
    params = { ...calibration.params, adoption: s.adoption };
  }
  if (s.policy.rentsMarkup > 0)
    params = { ...params, extensions: { rents: { markup: s.policy.rentsMarkup } } };
  return {
    params,
    target: baselineSsTarget(params),
    presetId: s.preset === 'paper' ? PAPER_PRESET_ID : CYPRUS_PRESET_ID,
    calibration,
  };
}
