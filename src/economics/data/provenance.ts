/**
 * Provenance schema for every published number (prompt PART 7; design change §8).
 * Validation rules make it impossible for an assumption to pass as an official statistic:
 *  - 'statutory' and 'measured' values must cite at least one source and be verified;
 *  - 'assumption' and 'scenario' values must carry a plausible range and may not claim official
 *    verification;
 *  - a missing value (null) must be marked 'missing' and explained.
 */
import { z } from 'zod';

export const SOURCE_KINDS = [
  'official-legal',
  'official-statistical',
  'official-report',
  'secondary',
  'academic',
] as const;

export const sourceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(3),
    publisher: z.string().min(2),
    /** Public URL; may be null only for documents provided by the user (identified by file hashes). */
    url: z.url().nullable(),
    obtainedVia: z.enum(['web', 'provided-by-user']).default('web'),
    /** Local files the values were extracted from, with SHA-256 so the exact copy is identifiable. */
    files: z.array(z.object({ name: z.string(), sha256: z.string().regex(/^[0-9a-f]{64}$/) })).default([]),
    kind: z.enum(SOURCE_KINDS),
    /** ISO date or null when the page does not show one. */
    publicationDate: z.iso.date().nullable(),
    accessed: z.iso.date(),
    language: z.enum(['en', 'el']).default('en'),
    notes: z.string().default(''),
  })
  .refine((s) => s.url !== null || (s.obtainedVia === 'provided-by-user' && s.files.length > 0), {
    message: 'a source without a URL must be a user-provided document identified by file hashes',
  });
export type Source = z.infer<typeof sourceSchema>;

export const CATEGORIES = ['statutory', 'measured', 'calibrated', 'assumption', 'scenario'] as const;
export const VERIFICATION = [
  'verified-official',
  'verified-secondary',
  'conflicting',
  'unverified',
  'missing',
] as const;

export const parameterSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9._]+$/),
    label: z.string().min(3),
    value: z.number().nullable(),
    units: z.string().min(1),
    referenceYear: z.string().min(4),
    /** Geographic and legal coverage, e.g. "Cyprus; employed persons". */
    coverage: z.string().min(3),
    category: z.enum(CATEGORIES),
    verification: z.enum(VERIFICATION),
    sourceIds: z.array(z.string()),
    /** Exact supporting quote or dataset code + filters. */
    evidence: z.string().default(''),
    explanation: z.string().min(3),
    sensitivityRange: z.tuple([z.number(), z.number()]).nullable().default(null),
  })
  .superRefine((p, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message: `${p.id}: ${message}` });
    if (p.value === null && p.verification !== 'missing')
      issue('null value must have verification "missing"');
    if (p.value !== null && p.verification === 'missing') issue('verification "missing" requires value null');
    if ((p.category === 'statutory' || p.category === 'measured') && p.value !== null) {
      if (p.sourceIds.length === 0) issue('statutory/measured values must cite a source');
      if (p.verification === 'unverified') issue('statutory/measured values must not be unverified');
    }
    if (p.category === 'assumption' || p.category === 'scenario') {
      if (p.verification === 'verified-official') issue('assumptions cannot be "verified-official"');
      if (p.sensitivityRange === null) issue('assumptions and scenarios need a sensitivity range');
    }
    if (p.sensitivityRange && p.value !== null) {
      const [lo, hi] = p.sensitivityRange;
      if (!(lo <= p.value && p.value <= hi))
        issue(`value ${p.value} outside sensitivity range [${lo}, ${hi}]`);
    }
  });
export type Parameter = z.infer<typeof parameterSchema>;

export const datasetSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    schemaVersion: z.literal(1),
    parameters: z.array(parameterSchema),
  })
  .superRefine((d, ctx) => {
    const ids = new Set<string>();
    for (const p of d.parameters) {
      if (ids.has(p.id)) ctx.addIssue({ code: 'custom', message: `duplicate parameter id ${p.id}` });
      ids.add(p.id);
    }
  });
export type Dataset = z.infer<typeof datasetSchema>;

/** Cross-check: every cited source id exists in the register. */
export function unresolvedSourceIds(dataset: Dataset, sources: readonly Source[]): string[] {
  const known = new Set(sources.map((s) => s.id));
  return dataset.parameters.flatMap((p) =>
    p.sourceIds.filter((id) => !known.has(id)).map((id) => `${p.id} → ${id}`),
  );
}

export function parameterValue(dataset: Dataset, id: string): number {
  const p = dataset.parameters.find((x) => x.id === id);
  if (!p) throw new Error(`unknown parameter ${id}`);
  if (p.value === null) throw new Error(`parameter ${id} is missing (${p.explanation})`);
  return p.value;
}
