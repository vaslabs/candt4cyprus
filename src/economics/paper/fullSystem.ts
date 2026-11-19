/**
 * Solver 2: the paper's full steady-state system (§4: 10 equations in Y, C, K, D, L, X, W, I,
 * R_k, R_d), solved with damped Newton in log variables and continuation in the adoption
 * parameter. Independent of Solver 1: it uses the primal production function and the paper's
 * literal FOCs, not the dual/unit-cost route.
 *
 * At adoption = 0 the robot FOC is degenerate (D = 0 exactly), so D is fixed at 0 and eq. (4)/(15)
 * is dropped, leaving 9 equations.
 */
import { conditionNumber1, dampedNewton, numericalJacobian, type Vector } from '../core/numericalSolver';
import { labourSupplyWedges } from './households';
import { technologyModel } from './technology';
import { assembleResult, makeMeta, type SolveOptions } from './steadyState';
import type { ConvergenceInfo, PaperParameters, SteadyStateLevels, SteadyStateResult } from './types';

export const UNKNOWNS = ['Y', 'C', 'K', 'D', 'L', 'X', 'W', 'I', 'Rk', 'Rd'] as const;
type Unknown = (typeof UNKNOWNS)[number];
export type LevelGuess = Readonly<Record<Unknown, number>>;

/** A deliberately generic starting point (not derived from Solver 1). */
export const GENERIC_GUESS: LevelGuess = {
  Y: 0.5,
  C: 0.4,
  K: 1.5,
  D: 1e-3,
  L: 0.3,
  X: 0.4,
  W: 1,
  I: 0.1,
  Rk: 0.1,
  Rd: 0.25,
};

/**
 * Residuals of the 10 steady-state equations at the given levels, each in dimensionless form
 * (log differences or Euler-equation deviations), so that ‖r‖∞ ≈ relative error.
 * `includeRobotFoc` = false drops eq. (4)/(15) (used at adoption = 0).
 */
export function steadyStateResiduals(p: PaperParameters, v: LevelGuess, includeRobotFoc = true): number[] {
  const t = p.taxes;
  const tech = technologyModel(p);
  const { Y, C, K, D, L, X, W, I, Rk, Rd } = v;
  const prod = tech.output(p, K, D, L);
  const mp = tech.focs(p, Y, X, K, D, L);
  const g = p.gamma / (1 - p.gamma);
  const w = labourSupplyWedges(p);
  const r: number[] = [
    Math.log(Y) - Math.log(prod.Y), // (1)/(10)
    Math.log(X) - Math.log(prod.X), // (2)/(11)
    Math.log((1 + t.employerSS) * W) - Math.log(mp.mpL), // (5)/(14)
    Math.log(Rk) - Math.log(mp.mpK), // (6)/(13)
    Math.log(w.consumption * C) - Math.log(g * (1 - L) * W * w.wage), // (24)
    p.beta * ((1 - t.capital) * (Rk - p.deltaK) + 1) - 1, // (25) at steady state
    (p.beta * ((1 - t.capital - t.robotIncome) * (Rd - p.deltaD) + 1 + t.robotInvestment * (1 - p.deltaD))) /
      (1 + t.robotInvestment) -
      1, // (26) at steady state
    Math.log(I) - Math.log(p.deltaK * K + p.deltaD * D), // (21)–(22) at steady state
    Math.log(C) - Math.log(Y - I), // resource constraint
  ];
  if (includeRobotFoc) r.push(Math.log((1 + t.robotSS) * Rd) - Math.log(mp.mpD)); // (4)/(15)
  return r;
}

function pack(v: LevelGuess, withD: boolean): number[] {
  return UNKNOWNS.filter((k) => withD || k !== 'D').map((k) => Math.log(v[k]));
}

function unpack(x: Vector, withD: boolean): LevelGuess {
  const keys = UNKNOWNS.filter((k) => withD || k !== 'D');
  const out: Record<string, number> = { D: 0 };
  if (x.length !== keys.length) throw new Error(`expected ${keys.length} log-levels, got ${x.length}`);
  keys.forEach((k, i) => (out[k] = Math.exp(x[i] ?? NaN)));
  return out as LevelGuess;
}

export interface NewtonSolveOptions extends SolveOptions {
  /** Starting point. Default: continuation from adoption 0 starting at GENERIC_GUESS. */
  readonly initialGuess?: LevelGuess;
  /** If false, solve directly at the target adoption from initialGuess (no continuation). */
  readonly continuation?: boolean;
  readonly tolerance?: number;
}

interface PointSolve {
  readonly converged: boolean;
  readonly levels: LevelGuess;
  readonly residualNorm: number;
  readonly iterations: number;
  readonly status: string;
}

function solveAt(p: PaperParameters, guess: LevelGuess, tol: number): PointSolve {
  const withD = p.adoption > 0;
  const fn = (x: Vector) => steadyStateResiduals(p, unpack(x, withD), withD);
  const start = withD && guess.D <= 0 ? { ...guess, D: 1e-6 * guess.K } : guess;
  const res = dampedNewton(fn, pack(start, withD), { tolerance: tol, maxIterations: 200 });
  return {
    converged: res.converged,
    levels: unpack(res.x, withD),
    residualNorm: res.residualNorm,
    iterations: res.iterations,
    status: res.status,
  };
}

/** κ₁ of the log-variable Jacobian at a point (the conditioning that Newton actually faces). */
export function jacobianConditionAt(p: PaperParameters, v: LevelGuess): number {
  const withD = p.adoption > 0;
  const fn = (x: Vector) => steadyStateResiduals(p, unpack(x, withD), withD);
  return conditionNumber1(numericalJacobian(fn, pack(v, withD)));
}

function toLevels(p: PaperParameters, v: LevelGuess): SteadyStateLevels {
  const Ik = p.deltaK * v.K;
  const Id = p.deltaD * v.D;
  return { ...v, Ik, Id };
}

/**
 * Solve the full system. With continuation (default), adoption is raised from 0 to the target in
 * adaptive steps, each seeded by the previous solution; a step that fails is halved down to
 * 1e-5 before the solve is declared failed.
 *
 * A failure here is a *numerical* failure. It is reported as 'solver-failed', never as
 * non-existence: only Solver 1's analytic slack can establish non-existence.
 */
export function solveSteadyStateNewton(p: PaperParameters, opts: NewtonSolveOptions = {}): SteadyStateResult {
  const tol = opts.tolerance ?? 1e-12;
  const target = p.adoption;
  let totalIterations = 0;
  let current: PointSolve;

  if (opts.continuation === false) {
    current = solveAt(p, opts.initialGuess ?? GENERIC_GUESS, tol);
    totalIterations = current.iterations;
  } else {
    current = solveAt({ ...p, adoption: 0 }, opts.initialGuess ?? GENERIC_GUESS, tol);
    totalIterations += current.iterations;
    let a = 0;
    let step = Math.min(0.05, target);
    while (current.converged && a < target) {
      const next = Math.min(target, a + step);
      const trial = solveAt({ ...p, adoption: next }, current.levels, tol);
      totalIterations += trial.iterations;
      if (trial.converged) {
        current = trial;
        a = next;
        step = Math.min(step * 1.5, 0.05);
      } else {
        step /= 2;
        if (step < 1e-5) {
          current = {
            ...trial,
            converged: false,
            status: `continuation stalled at adoption ${a.toFixed(6)}`,
          };
          break;
        }
      }
    }
  }

  const condition = jacobianConditionAt(p, current.levels);
  const convergence: ConvergenceInfo = {
    status: current.converged ? 'converged' : 'failed',
    residualNorm: current.residualNorm,
    iterations: totalIterations,
    jacobianCondition: condition,
    message: current.converged
      ? `Damped Newton converged (‖r‖∞ = ${current.residualNorm.toExponential(2)}).`
      : current.status,
  };
  const meta = makeMeta(p, 'newton', convergence, opts);
  if (!current.converged) {
    return {
      ok: false,
      reason: 'solver-failed',
      detail: `Newton solver did not converge: ${current.status}`,
      meta,
    };
  }
  return assembleResult(p, toLevels(p, current.levels), meta, { outer: NaN, inner: NaN });
}
