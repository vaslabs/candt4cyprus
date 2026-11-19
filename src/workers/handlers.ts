/**
 * Pure request handlers (no DOM, no worker globals) so they can be unit-tested in Node.
 */
import { scenarioSchema } from '../economics/simulation/scenario';
import { resolveScenario } from '../economics/simulation/scenarioResolve';
import { runMonteCarlo } from '../economics/simulation/monteCarlo';
import { comparePolicies } from '../economics/simulation/comparisons';
import {
  sbsSectorScenario,
  shortRunComparison,
  smeExemptionCoverage,
  structuralSweep,
  valueAddedCoverageSweep,
} from '../economics/simulation/sensitivity';
import { solveSteadyStateDual } from '../economics/paper/steadyState';
import { existenceBoundary } from '../economics/paper/existence';
import { evaluateBenchmarks, KNOWN_DISCREPANCIES } from '../economics/paper/replication';
import { paperParameters } from '../economics/paper/calibration';
import { solveRequiredRate, withPolicy, type ActiveScheme } from '../economics/policies/registry';
import { compareFirm } from '../economics/firm/firmModel';
import { cyprusStatutoryRules, loadCyprusDataset, cyprusMonthlyEarnings } from '../economics/cyprus/defaults';
import { solveWithCeiling } from '../economics/cyprus/ceilingFeedback';
import type { PaperParameters } from '../economics/paper/types';
import type { CurvePoint, ResultMap, SimRequest } from './workerProtocol';
import type { RequiredTaxOptions } from '../economics/policies/robotTaxes';

export interface Hooks {
  readonly progress?: (done: number, total: number) => void;
}

function point(
  p: PaperParameters,
  adoption: number,
  scheme: ActiveScheme | 'none' = 'none',
  target?: number,
): CurvePoint {
  const q = { ...p, adoption };
  if (scheme === 'none') {
    const r = solveSteadyStateDual(withPolicy(q, 'none', 0));
    if (!r.ok) return { adoption, ok: false, reason: r.reason };
    return {
      adoption,
      ok: true,
      Y: r.levels.Y,
      C: r.levels.C,
      I: r.levels.I,
      L: r.levels.L,
      K: r.levels.K,
      D: r.levels.D,
      W: r.levels.W,
      ssToY: r.ssToGdp,
      grossLabourShare: r.shares.grossLabour,
      netLabourShare: r.shares.netLabour,
      grossCapitalShare: r.shares.grossTraditionalCapital + r.shares.grossAutonomousCapital,
      rate: 0,
      robotSourceShare: 0,
    };
  }
  const req = solveRequiredRate(q, scheme, undefined, {
    ...(target !== undefined ? { target } : {}),
    scanIntervals: 200,
  });
  if (req.status !== 'solved' && req.status !== 'not-needed')
    return { adoption, ok: false, reason: req.status };
  const r = req.steadyState;
  return {
    adoption,
    ok: true,
    Y: r.levels.Y,
    L: r.levels.L,
    K: r.levels.K,
    D: r.levels.D,
    ssToY: r.ssToGdp,
    grossLabourShare: r.shares.grossLabour,
    netLabourShare: r.shares.netLabour,
    grossCapitalShare: r.shares.grossTraditionalCapital + r.shares.grossAutonomousCapital,
    rate: req.rate,
    robotSourceShare: r.government.ssTotal > 0 ? r.government.ssRobot / r.government.ssTotal : 0,
  };
}

function requireScenario(s: unknown) {
  const parsed = scenarioSchema.safeParse(s);
  if (!parsed.success)
    throw new Error(
      `Invalid scenario: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  return parsed.data;
}

function solverOptions(
  scenario: ReturnType<typeof requireScenario>,
  params: PaperParameters,
): RequiredTaxOptions {
  if (scenario.preset !== 'cyprus' || scenario.policy.ceiling !== 'fixedNominal') return {};
  const { dataset } = loadCyprusDataset();
  const earn = cyprusMonthlyEarnings(dataset);
  const base = solveSteadyStateDual({ ...params, adoption: 0 });
  const W0 = base.ok ? base.levels.W : NaN;
  const ctx = {
    treatment: 'fixedNominal' as const,
    baselineWage: W0,
    bands: earn.bands,
    meanMonthly: earn.meanMonthly,
    monthlyCeiling: 5742,
  };
  return { solver: (q, o) => solveWithCeiling(q, ctx, o) };
}

/** Dispatch a request; the result type is fixed by the request kind (ResultFor<K>). */
export function handle<K extends SimRequest['kind']>(
  request: Extract<SimRequest, { kind: K }>,
  hooks: Hooks = {},
): ResultMap[K] {
  // Single boundary cast: handleAny returns the member of ResultMap selected by request.kind.
  return handleAny(request, hooks) as unknown as ResultMap[K];
}

function handleAny(r: SimRequest, hooks: Hooks): ResultMap[SimRequest['kind']] {
  switch (r.kind) {
    case 'automation': {
      const s = requireScenario(r.scenario);
      const res = resolveScenario(s);
      const b = existenceBoundary({ ...res.params, adoption: 0 });
      const curve = r.adoptions.map((a, i) => {
        hooks.progress?.(i + 1, r.adoptions.length);
        return point(res.params, a);
      });
      const cal = res.calibration;
      return {
        presetId: res.presetId,
        target: res.target,
        boundary: b.kind === 'boundary' ? b.adoption : null,
        curve,
        current: point(res.params, s.adoption),
        calibration: cal
          ? {
              beta: cal.params.beta,
              gamma: cal.params.gamma,
              capitalWeight: cal.params.capitalShareParam,
              effectiveSiRate: cal.params.taxes.employerSS,
            }
          : null,
      };
    }
    case 'compare': {
      const s = requireScenario(r.scenario);
      const res = resolveScenario(s);
      const rows = comparePolicies(res.params, s.adoption, {
        target: res.target,
        config: s.policy.config,
        objective: s.policy.objective,
        ...solverOptions(s, res.params),
      });
      return { presetId: res.presetId, target: res.target, adoption: s.adoption, rows };
    }
    case 'replication': {
      const benchmarks = evaluateBenchmarks();
      const curves: ResultMap['replication']['curves'][number][] = [];
      const grid = Array.from({ length: 46 }, (_, i) => i / 100);
      const jobs: ['A' | 'B', number, ActiveScheme | 'none'][] = [];
      for (const t of ['A', 'B'] as const)
        for (const e of [1, 2, 3])
          for (const sch of ['none', 'robotIncome', 'robotInvestment', 'robotSS'] as const)
            jobs.push([t, e, sch]);
      jobs.forEach(([t, e, sch], i) => {
        const p = paperParameters(t, { elasticityAuto: e, variant: r.variant });
        curves.push({
          technology: t,
          elasticityAuto: e,
          scheme: sch,
          points: grid.map((a) => point(p, a, sch)),
        });
        hooks.progress?.(i + 1, jobs.length);
      });
      return { benchmarks, knownDiscrepancies: KNOWN_DISCREPANCIES, curves };
    }
    case 'sensitivity': {
      const s = requireScenario(r.scenario);
      const res = resolveScenario(s);
      hooks.progress?.(1, 5);
      const coverage = valueAddedCoverageSweep(res.params, s.adoption, res.target, [0.24, 0.49, 0.76, 1]);
      hooks.progress?.(2, 5);
      const structural = structuralSweep(res.params, {
        elasticityKL: [0.5, 0.7, 0.9, 1.1],
        elasticityAuto: [1.5, 2, 3],
        adoption: [0.1, s.adoption],
      }).map((rp) => ({
        label: rp.label,
        bestScheme: rp.bestScheme,
        eCost: rp.eCost,
        dCost: rp.dCost,
        eRank: rp.eRank,
      }));
      hooks.progress?.(3, 5);
      const shortRun = shortRunComparison(res.params, s.adoption, res.target);
      const longRun = comparePolicies(res.params, s.adoption, {
        target: res.target,
        schemes: ['robotIncome', 'robotInvestment', 'robotSS', 'valueAdded', 'capitalReturnLevy'],
      });
      hooks.progress?.(4, 5);
      const sectors = sbsSectorScenario(0.025, '10-19');
      const smeCoverage = (['0-9', '10-19', '20-49', '50-249', 'GE250'] as const).map((t) => ({
        threshold: t,
        coverage: smeExemptionCoverage(t).coverage,
      }));
      hooks.progress?.(5, 5);
      return { coverage, structural, shortRun, longRun, sectors, smeCoverage };
    }
    case 'monteCarlo': {
      const s = requireScenario(r.scenario);
      if (!(r.draws >= 1 && r.draws <= 2000)) throw new Error('draws must be between 1 and 2000');
      return runMonteCarlo(
        {
          scenario: s,
          ranges: r.ranges,
          adoptions: r.adoptions,
          scheme: r.scheme,
          draws: r.draws,
          seed: r.seed,
        },
        hooks.progress ? { progress: hooks.progress } : {},
      );
    }
    case 'firm': {
      const { dataset } = loadCyprusDataset();
      return compareFirm(r.firm, r.config, cyprusStatutoryRules(dataset));
    }
  }
}
