/**
 * Typed message protocol between the UI thread and the simulation Web Worker.
 * Every request kind maps to exactly one result type (ResultFor<K>).
 */
import type { Scenario } from '../economics/simulation/scenario';
import type { MonteCarloResult, ParameterRange } from '../economics/simulation/monteCarlo';
import type { PolicyOutcome } from '../economics/simulation/comparisons';
import type { RankPoint, SectorScenarioRow } from '../economics/simulation/sensitivity';
import type { BenchmarkResult } from '../economics/paper/replication';
import type { ActiveScheme } from '../economics/policies/registry';
import type { FirmComparison, FirmInputs, FirmPolicyConfig } from '../economics/firm/firmModel';
import type { EquationVariant, Technology } from '../economics/paper/types';

export interface CurvePoint {
  readonly adoption: number;
  readonly ok: boolean;
  readonly reason?: string;
  readonly Y?: number;
  readonly C?: number;
  readonly I?: number;
  readonly L?: number;
  readonly K?: number;
  readonly D?: number;
  readonly W?: number;
  readonly ssToY?: number;
  readonly grossLabourShare?: number;
  readonly netLabourShare?: number;
  readonly grossCapitalShare?: number;
  readonly rate?: number | null;
  readonly robotSourceShare?: number | null;
}

export interface AutomationResult {
  readonly presetId: string;
  readonly target: number;
  readonly boundary: number | null;
  readonly curve: readonly CurvePoint[];
  readonly current: CurvePoint;
  readonly calibration: {
    readonly beta: number;
    readonly gamma: number;
    readonly capitalWeight: number;
    readonly effectiveSiRate: number;
  } | null;
}

export interface ReplicationResult {
  readonly benchmarks: readonly BenchmarkResult[];
  readonly knownDiscrepancies: Readonly<Record<string, string>>;
  readonly curves: readonly {
    technology: Technology;
    elasticityAuto: number;
    scheme: ActiveScheme | 'none';
    points: CurvePoint[];
  }[];
}

export interface ComparisonResult {
  readonly presetId: string;
  readonly target: number;
  readonly adoption: number;
  readonly rows: readonly PolicyOutcome[];
}

export interface SensitivityResult {
  readonly coverage: readonly {
    coverage: number;
    rate: number | null;
    costPerRevenue: number | null;
    status: string;
  }[];
  readonly structural: readonly Omit<RankPoint, 'rows'>[];
  readonly shortRun: readonly PolicyOutcome[];
  readonly longRun: readonly PolicyOutcome[];
  readonly sectors: readonly SectorScenarioRow[];
  readonly smeCoverage: readonly { threshold: string; coverage: number | null }[];
}

export type SimRequest =
  | { readonly kind: 'automation'; readonly scenario: Scenario; readonly adoptions: readonly number[] }
  | { readonly kind: 'compare'; readonly scenario: Scenario }
  | { readonly kind: 'replication'; readonly variant: EquationVariant }
  | { readonly kind: 'sensitivity'; readonly scenario: Scenario }
  | {
      readonly kind: 'monteCarlo';
      readonly scenario: Scenario;
      readonly ranges: readonly ParameterRange[];
      readonly adoptions: readonly number[];
      readonly scheme: ActiveScheme | null;
      readonly draws: number;
      readonly seed: number;
    }
  | { readonly kind: 'firm'; readonly firm: FirmInputs; readonly config: FirmPolicyConfig };

export interface ResultMap {
  automation: AutomationResult;
  compare: ComparisonResult;
  replication: ReplicationResult;
  sensitivity: SensitivityResult;
  monteCarlo: MonteCarloResult;
  firm: FirmComparison;
}
export type ResultFor<K extends SimRequest['kind']> = ResultMap[K];

export type WorkerIn = { readonly id: number; readonly request: SimRequest };
export type WorkerOut =
  | { readonly id: number; readonly type: 'progress'; readonly done: number; readonly total: number }
  | { readonly id: number; readonly type: 'result'; readonly result: ResultMap[SimRequest['kind']] }
  | { readonly id: number; readonly type: 'error'; readonly message: string };
