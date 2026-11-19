import { describe, expect, it } from 'vitest';
import {
  latestLabourShare,
  sbs,
  sbsCell,
  sectorLabourShare,
  sizeClassProfile,
} from '../../src/economics/data/sbs';
import {
  ARCHETYPE_MODELS,
  ARCHETYPE_SPECS,
  buildArchetype,
  sbsBenchmarks,
} from '../../src/economics/firm/archetypes';

describe('Eurostat SBS (sbs_sc_ovw) for Cyprus', () => {
  it('loads with source metadata and status flags', () => {
    const d = sbs().data;
    expect(d.dataset).toBe('sbs_sc_ovw');
    expect(d.flagLabels['|C']).toMatch(/confidential/);
    expect(d.records.length).toBeGreaterThan(1000);
  });
  it('labour share = employee benefits expense / value added (hand-checked J62 2024)', () => {
    const s = sectorLabourShare('J62', '2024');
    expect(s.value).toBeCloseTo(881.13 / 1788.95, 12);
    expect(s.wagesOnly).toBeCloseTo(762.34 / 1788.95, 12);
    expect(s.wagesOnly!).toBeLessThan(s.value!); // wages alone understate compensation
    expect(s.source).toMatch(/sbs_sc_ovw.*J62.*2024/);
  });
  it('confidential cells are never imputed', () => {
    expect(sbsCell('AV_MEUR', 'M70', '50-249', '2024')).toMatchObject({
      value: null,
      status: 'confidential',
    });
    const p = sizeClassProfile('M70', '50-249', '2024');
    expect(p.valueAdded.status).toBe('confidential');
    expect(sectorLabourShare('M70', '2024', '50-249')).toMatchObject({ value: null, status: 'unavailable' });
    expect(sbsCell('AV_MEUR', 'ZZ', 'TOTAL', '2024').status).toBe('missing');
  });
  it('latest available year is used for benchmarks; 50% generic default retained', () => {
    expect(latestLabourShare('I').year).toBe('2024');
    const b = sbsBenchmarks(['I', 'J', 'M']);
    expect(b.default).toBe(0.5);
    expect(b.J).toBeCloseTo(1473.99 / 3948.18, 12);
  });
});

describe('SBS-calibrated archetypes (constructed, not observed businesses)', () => {
  it('derive per-enterprise turnover and value added from the size-class cells', () => {
    const h = ARCHETYPE_MODELS[0]!;
    expect(h.firm.revenue).toBe(Math.round((826.89 * 1e6) / 105));
    expect(h.firm.revenue - h.firm.intermediateConsumption).toBe(
      Math.round((826.89 * 1e6) / 105) - Math.round((826.89e6 - 499.88e6) / 105),
    );
    expect(h.firm.hypothetical).toBe(true);
    expect(h.firm.name).toMatch(/constructed from SBS I55 50-249, 2024/);
  });
  it('every field is tagged observed / derived / assumed / behavioural', () => {
    for (const a of ARCHETYPE_MODELS) {
      const kinds = new Set(Object.values(a.provenance).map((p) => p.kind));
      expect([...kinds].sort()).toEqual(['assumed', 'behavioural', 'derived', 'observed']);
      expect(a.provenance.capitalStock!.kind).toBe('assumed');
      expect(a.provenance.maxProfitShifting!.kind).toBe('behavioural');
      expect(a.provenance.revenue!.kind).toBe('derived');
    }
  });
  it('pay groups preserve the observed mean wage; confidential cells make construction fail loudly', () => {
    expect(() => buildArchetype({ ...ARCHETYPE_SPECS[1]!, nace: 'M70' })).toThrow(/confidential/);
    expect(() =>
      buildArchetype({ ...ARCHETYPE_SPECS[0]!, payGroups: [{ label: 'x', share: 1, multiple: 1.2 }] }),
    ).toThrow();
  });
});
