/**
 * Replication benchmarks (MODEL_SPEC §7). Every benchmark not listed in KNOWN_DISCREPANCIES must
 * pass; every known discrepancy must still fail, so a change in either direction is noticed and
 * the replication report is regenerated deliberately.
 */
import { describe, expect, it } from 'vitest';
import { evaluateBenchmarks, KNOWN_DISCREPANCIES } from '../../src/economics/paper/replication';

const results = evaluateBenchmarks();

describe('Casas & Torres (2026) replication benchmarks', () => {
  it.each(results.map((r) => [r.id, r] as const))('%s', (id, r) => {
    const expectedPass = !(id in KNOWN_DISCREPANCIES);
    expect({ id, pass: r.pass, computed: r.computed }).toEqual({
      id,
      pass: expectedPass,
      computed: r.computed,
    });
  });
  it('known-discrepancy list only names existing benchmarks', () => {
    const ids = new Set(results.map((r) => r.id));
    for (const k of Object.keys(KNOWN_DISCREPANCIES)) expect(ids.has(k)).toBe(true);
  });
});
