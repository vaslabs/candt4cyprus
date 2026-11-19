/**
 * Cross-check against the independent Python/SciPy oracle (tools/oracle/oracle.py).
 * The committed fixture is used by default; CI regenerates it with Python first and points
 * ORACLE_FIXTURE at the fresh file, so the TS code is checked against a live independent solve.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { paperParameters } from '../../src/economics/paper/calibration';
import { existenceBoundary } from '../../src/economics/paper/existence';
import { solveSteadyStateDual } from '../../src/economics/paper/steadyState';
import type { PaperParameters, TaxRates } from '../../src/economics/paper/types';

interface OracleParams {
  technology: 'A' | 'B';
  adoption: number;
  elasticityAuto: number;
  taxes: TaxRates;
  techAWeight: 'capitalWeight' | 'asPrinted';
  labourSupply: 'asPrinted' | 'figureReplication';
  beta: number;
  gamma: number;
  deltaK: number;
  deltaD: number;
  capitalShareParam: number;
  elasticityKL: number;
}
interface OracleDoc {
  scipy: string;
  steadyStates: {
    taxCase: string;
    params: OracleParams;
    converged: boolean;
    residualNorm: number;
    levels: Record<string, number> | null;
  }[];
  boundaries: { params: OracleParams; boundary: number | null }[];
}

const path = process.env.ORACLE_FIXTURE ?? 'tests/fixtures/oracle_steady_states.json';
const doc = JSON.parse(readFileSync(path, 'utf8')) as OracleDoc;

function toParams(o: OracleParams): PaperParameters {
  const { techAWeight, labourSupply, technology, ...rest } = o;
  return paperParameters(technology, { ...rest, variant: { techAWeight, labourSupply } });
}
const label = (o: OracleParams, tc: string) =>
  `${o.technology} a=${o.adoption} e=${o.elasticityAuto} ${tc} ${o.techAWeight}/${o.labourSupply}`;

describe(`Python/SciPy oracle (scipy ${doc.scipy}, ${path})`, () => {
  it('fixture is non-trivial', () => {
    expect(doc.steadyStates.length).toBeGreaterThan(300);
    expect(doc.steadyStates.filter((c) => c.converged).length).toBeGreaterThan(250);
  });

  it('where the oracle converged, Solver 1 agrees on all 10 unknowns to 1e-9 relative', () => {
    const bad: string[] = [];
    for (const c of doc.steadyStates.filter((s) => s.converged)) {
      const r = solveSteadyStateDual(toParams(c.params));
      if (!r.ok) {
        bad.push(`${label(c.params, c.taxCase)}: TS reports ${r.reason}`);
        continue;
      }
      for (const [k, v] of Object.entries(c.levels!)) {
        const t = r.levels[k as keyof typeof r.levels];
        const err = v === 0 && t === 0 ? 0 : Math.abs(t - v) / Math.max(Math.abs(t), Math.abs(v));
        if (!(err < 1e-9)) bad.push(`${label(c.params, c.taxCase)}: ${k} TS=${t} oracle=${v}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('where the oracle failed, TS independently establishes non-existence (no unexplained failures)', () => {
    const unexplained: string[] = [];
    for (const c of doc.steadyStates.filter((s) => !s.converged)) {
      const r = solveSteadyStateDual(toParams(c.params));
      if (r.ok || r.reason === 'solver-failed' || r.reason === 'numerical-range') {
        unexplained.push(`${label(c.params, c.taxCase)}: TS ${r.ok ? 'finds a steady state' : r.reason}`);
      }
    }
    expect(unexplained).toEqual([]);
  });

  it('existence boundaries agree with the oracle’s independent dual', () => {
    for (const b of doc.boundaries) {
      const ts = existenceBoundary(toParams(b.params));
      const tsVal = ts.kind === 'boundary' ? ts.adoption : null;
      if (b.boundary === null) expect(tsVal).toBeNull();
      else expect(Math.abs((tsVal ?? NaN) - b.boundary)).toBeLessThan(1e-9);
    }
  });
});
