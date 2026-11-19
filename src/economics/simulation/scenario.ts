/**
 * Versioned, validated scenario definition (schema only; lightweight, safe for the UI bundle).
 * Resolution to model parameters lives in scenarioResolve.ts (worker side).
 * shared by the UI, the Web Worker and import/export.
 * A scenario resolves to model parameters through the SAME code paths used by the reports.
 */
import { z } from 'zod';
import { DEFAULT_POLICY_CONFIG } from '../policies/config';

export const SCENARIO_SCHEMA_VERSION = 1;

const policyConfigSchema = z.object({
  valueAddedCoverage: z.number().min(0).max(1),
  labourShareBenchmark: z.number().min(0).max(1),
  labourShareCoverage: z.number().min(0).max(1),
  excessProfitAllowance: z.union([z.literal('neutral'), z.object({ rate: z.number().min(0).max(1) })]),
  capitalReturnLevyFraction: z.number().min(0).lt(1),
  payrollReplacement: z.number().min(0).max(1),
});

export const scenarioSchema = z.object({
  schemaVersion: z.literal(SCENARIO_SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  preset: z.enum(['paper', 'cyprus']),
  technology: z.enum(['A', 'B']),
  /** Cyprus only: primary β = 0.975 or the K/Y-matching alternative. */
  betaMode: z.enum(['primary', 'capitalOutput']),
  /** Paper only: equation variants (MODEL_DEVIATIONS D1, D2). */
  techAWeight: z.enum(['capitalWeight', 'asPrinted']),
  labourSupply: z.enum(['asPrinted', 'figureReplication']),
  adoption: z.number().min(0).lt(1),
  overrides: z
    .object({
      elasticityKL: z.number().gt(0).max(5),
      elasticityAuto: z.number().gt(0).max(10),
      deltaD: z.number().gt(0).max(1),
      beta: z.number().gt(0.5).lt(1),
    })
    .partial(),
  policy: z.object({
    config: policyConfigSchema,
    objective: z.union([
      z.object({ kind: z.literal('restoreTarget') }),
      z.object({ kind: z.literal('revenueNeutralSwap'), replacement: z.number().min(0).max(1) }),
    ]),
    rentsMarkup: z.number().min(0).max(1),
    ceiling: z.enum(['indexed', 'fixedNominal']),
  }),
});
export type Scenario = z.infer<typeof scenarioSchema>;

export function defaultScenario(preset: 'paper' | 'cyprus' = 'cyprus', id = 'default'): Scenario {
  return {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    id,
    name: preset === 'cyprus' ? 'Cyprus 2026 (Technology B, β = 0.975)' : 'Casas–Torres (2026) Table 1',
    preset,
    technology: 'B',
    betaMode: 'primary',
    techAWeight: 'capitalWeight',
    labourSupply: 'asPrinted',
    adoption: 0.3,
    overrides: {},
    policy: {
      config: { ...DEFAULT_POLICY_CONFIG },
      objective: { kind: 'restoreTarget' },
      rentsMarkup: 0,
      ceiling: 'indexed',
    },
  };
}

/** Parse an imported scenario (JSON) with schema validation and version migration. */
export function parseScenario(
  json: unknown,
): { ok: true; scenario: Scenario } | { ok: false; error: string } {
  const v = (json as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (v !== SCENARIO_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported scenario schemaVersion ${String(v)} (this app reads version ${SCENARIO_SCHEMA_VERSION}).`,
    };
  }
  const r = scenarioSchema.safeParse(json);
  if (!r.success)
    return {
      ok: false,
      error: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
    };
  return { ok: true, scenario: r.data };
}
