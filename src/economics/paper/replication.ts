/**
 * Replication benchmarks for Casas & Torres (2026) (MODEL_SPEC §7).
 *
 * Each benchmark states the published claim, how it is computed, and an a-priori tolerance.
 * Published values are what the paper's text states, or visual readings of its figures where the
 * text gives none. They are compared against, never fed into, the model.
 */
import { PAPER_PRESET_ID, paperParameters } from './calibration';
import { existenceBoundary } from './existence';
import { solveSteadyStateDual } from './steadyState';
import { solveRequiredRobotTax, sweepAdoption, type RobotTaxScheme } from '../policies/robotTaxes';
import type { PaperParameters, SteadyStateResult, Technology } from './types';

export type BenchmarkKind = 'quantitative' | 'qualitative';

export interface BenchmarkResult {
  readonly id: string;
  readonly kind: BenchmarkKind;
  readonly claim: string;
  readonly source: string;
  readonly published: string;
  readonly computed: string;
  /** For quantitative benchmarks: |computed − published|. */
  readonly absError?: number;
  readonly relError?: number;
  readonly tolerance: string;
  readonly pass: boolean;
  readonly note: string;
}

const P = (tech: Technology, o: Partial<PaperParameters> = {}) => paperParameters(tech, o);
type Ok = Extract<SteadyStateResult, { ok: true }>;
const req = (
  tech: Technology,
  scheme: Exclude<RobotTaxScheme, 'none'>,
  adoption: number,
  elasticityAuto = 2,
) => {
  const r = solveRequiredRobotTax(P(tech, { adoption, elasticityAuto }), scheme, {
    calibrationPreset: PAPER_PRESET_ID,
  });
  return r.status === 'solved' ? r.rate : NaN;
};
const atAdoption = (tech: Technology, scheme: RobotTaxScheme, adoption: number): Ok | null => {
  const [pt] = sweepAdoption(P(tech), scheme, [adoption]);
  return pt?.result?.ok ? pt.result : null;
};
const fmt = (x: number, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');

function quant(
  id: string,
  claim: string,
  source: string,
  published: number,
  computed: number,
  tol: number,
  note = '',
): BenchmarkResult {
  const absError = Math.abs(computed - published);
  return {
    id,
    kind: 'quantitative',
    claim,
    source,
    published: fmt(published, 3),
    computed: fmt(computed),
    absError,
    relError: absError / Math.abs(published),
    tolerance: `±${tol}`,
    pass: Number.isFinite(computed) && absError <= tol,
    note,
  };
}

function qual(
  id: string,
  claim: string,
  source: string,
  published: string,
  computed: string,
  pass: boolean,
  note = '',
): BenchmarkResult {
  return {
    id,
    kind: 'qualitative',
    claim,
    source,
    published,
    computed,
    tolerance: 'qualitative',
    pass,
    note,
  };
}

const HIGH: Record<Technology, number> = { A: 0.42, B: 0.45 };
const TAX_SCHEMES = ['robotIncome', 'robotInvestment', 'robotSS'] as const;

export function evaluateBenchmarks(): BenchmarkResult[] {
  const out: BenchmarkResult[] = [];

  // B1 — baseline SS/Y
  for (const tech of ['A', 'B'] as const) {
    const r = solveSteadyStateDual(P(tech));
    out.push(
      quant(
        `B1-${tech}`,
        `SS/Y at zero adoption, Tech ${tech}`,
        'Fig. 1',
        0.151,
        r.ok ? r.ssToGdp : NaN,
        0.002,
      ),
    );
  }

  // B2 — τ^d Tech A converges to ≈0.56 for υ ∈ {1,2,3}
  {
    const vals = [1, 2, 3].flatMap((e) => [0.2, 0.3].map((a) => req('A', 'robotIncome', a, e)));
    const worst = vals.reduce((w, v) => (Math.abs(v - 0.56) > Math.abs(w - 0.56) ? v : w), vals[0] ?? NaN);
    out.push(
      quant(
        'B2',
        'Robot income tax, Tech A, high adoption, υ ∈ {1,2,3}',
        '§5 text, Fig. 2',
        0.56,
        worst,
        0.01,
        'Worst case over υ ∈ {1,2,3} × φ ∈ {0.2, 0.3}. Exact value is adoption- and υ-independent (Proposition 3).',
      ),
    );
  }
  // B3 — τ^d Tech B at μ = 0.45 ≈ 0.48
  out.push(
    quant(
      'B3',
      'Robot income tax, Tech B, μ = 0.45, σ = 2',
      '§5 text, Fig. 2',
      0.48,
      req('B', 'robotIncome', 0.45),
      0.01,
    ),
  );
  // B4 — τ^id
  out.push(
    quant(
      'B4-A',
      'Robot investment tax, Tech A, converged',
      'Abstract/§5, Fig. 3',
      0.38,
      req('A', 'robotInvestment', 0.3),
      0.01,
    ),
  );
  out.push(
    quant(
      'B4-B',
      'Robot investment tax, Tech B, μ = 0.45',
      'Abstract/§5, Fig. 3',
      0.23,
      req('B', 'robotInvestment', 0.45),
      0.01,
    ),
  );
  // B5 — τ^ssz
  out.push(
    quant(
      'B5-A',
      'Robot SS contribution, Tech A, converged',
      'Abstract/§5, Fig. 4',
      0.28,
      req('A', 'robotSS', 0.3),
      0.01,
    ),
  );
  out.push(
    quant(
      'B5-B',
      'Robot SS contribution, Tech B, μ = 0.45',
      'Abstract/§5, Fig. 4',
      0.18,
      req('B', 'robotSS', 0.45),
      0.01,
    ),
  );

  // B6 — crossover of labour/robot SS shares
  const grid = Array.from({ length: 451 }, (_, i) => i / 1000);
  for (const tech of ['A', 'B'] as const) {
    const xs = TAX_SCHEMES.map((s) => {
      const sw = sweepAdoption(P(tech), s, grid);
      return sw.find((pt) => (pt.robotSourceShare ?? 0) >= 0.5)?.adoption ?? NaN;
    });
    const worst = xs.reduce((w, v) => (Math.abs(v - 0.35) > Math.abs(w - 0.35) ? v : w), xs[0] ?? NaN);
    out.push(
      quant(
        `B6-${tech}`,
        `Adoption where robot SS share reaches 50%, Tech ${tech} (worst of 3 schemes)`,
        '§5 text, Fig. 5, Conclusions',
        0.35,
        worst,
        0.05,
        `Per scheme (τd, τid, τssz): ${xs.map((x) => fmt(x, 3)).join(', ')}. Paper: "≈35%", "below 40%".`,
      ),
    );
  }
  // B6b — the paper also phrases the crossover as "robots ≈ 35% of total capital"
  {
    const r = atAdoption('A', 'robotSS', 0.35);
    const rb = atAdoption('B', 'robotSS', 0.37);
    const share = (x: Ok | null) => (x ? x.levels.D / (x.levels.K + x.levels.D) : NaN);
    out.push(
      qual(
        'B6b',
        'At the crossover, autonomous capital ≈ 35% of total capital',
        'Introduction (p. 72)',
        'D/(K+D) ≈ 0.35',
        `Tech A: ${fmt(share(r), 3)}, Tech B: ${fmt(share(rb), 3)}`,
        Math.abs(share(r) - 0.35) < 0.05 && Math.abs(share(rb) - 0.35) < 0.05,
        'The paper uses the adoption parameter and the capital share interchangeably here; they differ in the model.',
      ),
    );
  }

  // B7 — robot SS tax least distortionary: highest Y and C among taxes at high adoption
  for (const tech of ['A', 'B'] as const) {
    const rs = TAX_SCHEMES.map((s) => atAdoption(tech, s, HIGH[tech]));
    const Y = rs.map((r) => r?.levels.Y ?? NaN);
    const C = rs.map((r) => r?.levels.C ?? NaN);
    out.push(
      qual(
        `B7-${tech}`,
        `τssz yields the highest Y and C among the three taxes (Tech ${tech}, adoption ${HIGH[tech]})`,
        'Figs 6–7, Conclusions',
        'τssz highest',
        `Y (τd, τid, τssz) = ${Y.map((v) => fmt(v, 3)).join(', ')}; C = ${C.map((v) => fmt(v, 3)).join(', ')}`,
        (Y[2] ?? NaN) > Math.max(Y[0] ?? NaN, Y[1] ?? NaN) &&
          (C[2] ?? NaN) > Math.max(C[0] ?? NaN, C[1] ?? NaN),
      ),
    );
  }

  // B8 — gross labour share: declines with adoption under every scheme; taxes slow the decline;
  //      ordering τid > τd > τssz (Fig. 8/9)
  for (const tech of ['A', 'B'] as const) {
    const schemes = ['none', ...TAX_SCHEMES] as const;
    const at = (s: RobotTaxScheme, a: number) => atAdoption(tech, s, a)?.shares.grossLabour ?? NaN;
    const declines = schemes.every((s) => at(s, 0.1) > at(s, 0.3) && at(s, 0.3) > at(s, HIGH[tech]));
    const hi = schemes.map((s) => at(s, HIGH[tech]));
    const slows = hi.slice(1).every((v) => v > (hi[0] ?? NaN));
    const ordering = (hi[2] ?? NaN) > (hi[1] ?? NaN) && (hi[1] ?? NaN) > (hi[3] ?? NaN);
    out.push(
      qual(
        `B8-${tech}`,
        `Gross labour share falls with adoption under all schemes; taxes slow the decline; τid > τd > τssz (Tech ${tech})`,
        'Figs 8–9, §5',
        'all three hold',
        `(none, τd, τid, τssz) at ${HIGH[tech]}: ${hi.map((v) => fmt(v, 3)).join(', ')}; declines=${declines}, slows=${slows}, ordering=${ordering}`,
        declines && slows && ordering,
        'None of the taxes reverses the decline (paper: "does not significantly affect" the labour share).',
      ),
    );
  }

  // B9 — Tech A gross traditional-capital share constant ≈ 0.31
  {
    const vals = (['none', ...TAX_SCHEMES] as const).flatMap((s) =>
      [0.1, 0.3, 0.42].map((a) => atAdoption('A', s, a)?.shares.grossTraditionalCapital ?? NaN),
    );
    const spread = Math.max(...vals) - Math.min(...vals);
    out.push(
      quant(
        'B9',
        'Tech A gross traditional-capital share (constant across adoption and schemes)',
        'Fig. 8',
        0.31,
        vals[0] ?? NaN,
        0.01,
        `Spread across schemes and adoption: ${spread.toExponential(1)}.`,
      ),
    );
  }

  // B10 — net labour share: τssz is most labour-friendly in net terms (Conclusions; Figs 10–11)
  for (const tech of ['A', 'B'] as const) {
    const hi = (['none', ...TAX_SCHEMES] as const).map(
      (s) => atAdoption(tech, s, HIGH[tech])?.shares.netLabour ?? NaN,
    );
    out.push(
      qual(
        `B10-${tech}`,
        `Net labour share highest under τssz at high adoption (Tech ${tech})`,
        'Figs 10–11, Conclusions',
        'τssz highest',
        `(none, τd, τid, τssz) = ${hi.map((v) => fmt(v, 3)).join(', ')}`,
        (hi[3] ?? NaN) > Math.max(hi[1] ?? NaN, hi[2] ?? NaN),
        'Net shares are not defined in the paper (MODEL_DEVIATIONS D3); the definition is not tuned to match.',
      ),
    );
  }

  // B11 — low-adoption behaviour of Tech A rates (Figs 2–4 left panels)
  {
    const lo = req('A', 'robotIncome', 0.02);
    out.push(
      quant(
        'B11',
        'Robot income tax, Tech A, υ = 2, φ = 0.02 (elevated before converging)',
        'Fig. 2 (visual reading)',
        0.62,
        lo,
        0.01,
        "Exact solution is flat at 0.5588 (Proposition 3). The paper's transient is consistent with a target slightly above the " +
          "model's own adoption-0 SS/Y (+0.0005 reproduces its shape); this is a hypothesis, not adopted.",
      ),
    );
  }
  // B12 — Tech B τd decreases with adoption (σ = 1, 2)
  {
    const s1 = [0.1, 0.2, 0.3, 0.45].map((a) => req('B', 'robotIncome', a, 1));
    const s2 = [0.1, 0.2, 0.3, 0.45].map((a) => req('B', 'robotIncome', a, 2));
    const dec = (v: number[]) => v.every((x, i) => i === 0 || x < (v[i - 1] ?? NaN));
    out.push(
      qual(
        'B12',
        'Tech B robot income tax decreases with adoption (σ = 1, 2)',
        'Fig. 2 right, §5',
        'decreasing',
        `σ=1: ${s1.map((v) => fmt(v, 3)).join(', ')}; σ=2: ${s2.map((v) => fmt(v, 3)).join(', ')}`,
        dec(s1) && dec(s2),
      ),
    );
  }
  // B13 — Tech A untaxed economy ceases to exist near the end of Fig. 1's curve
  {
    const b = existenceBoundary(P('A'));
    out.push(
      quant(
        'B13',
        'Adoption where Tech A SS/Y reaches 0 without robot tax (end of Fig. 1 curve)',
        'Fig. 1 (visual reading)',
        0.44,
        b.kind === 'boundary' ? b.adoption : NaN,
        0.01,
        'Model: exact existence boundary φ* (Proposition 2).',
      ),
    );
  }
  return out;
}

/** Benchmarks expected NOT to replicate, with the reason (asserted by tests so changes are noticed). */
export const KNOWN_DISCREPANCIES: Record<string, string> = {
  B6b: 'Paper equates adoption with the share of autonomous in total capital; in the model they differ.',
  'B10-A': 'Net-share definition unspecified in the paper (D3).',
  'B10-B': 'Net-share definition unspecified in the paper (D3).',
  B11: 'Tech A required rates are exactly constant (Proposition 3); the paper shows low-adoption transients.',
};
