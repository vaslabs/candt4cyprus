import fc from 'fast-check';

/** Strictly positive doubles spanning several orders of magnitude (log-uniform). */
export const positive = (minExp = -3, maxExp = 3) =>
  fc.double({ min: minExp, max: maxExp, noNaN: true }).map((e) => 10 ** e);

/** Interior CES weight. */
export const weight = fc.double({ min: 0.01, max: 0.99, noNaN: true });

/** Elasticity of substitution covering complements, Cobb–Douglas and substitutes. */
export const elasticity = fc.oneof(
  fc.double({ min: 0.2, max: 5, noNaN: true }),
  fc.constant(1),
  fc.double({ min: 1 - 1e-6, max: 1 + 1e-6, noNaN: true }),
);

export function relErr(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(1e-300, Math.abs(a), Math.abs(b));
}
