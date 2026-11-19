import fc from 'fast-check';

/**
 * Property tests are randomised but reproducible: a fixed seed by default, overridable with
 * FC_SEED=<n> to explore other regions (any failure prints its seed and shrunk counterexample).
 */
const seed = process.env.FC_SEED ? Number(process.env.FC_SEED) : 20261119;
fc.configureGlobal({ seed, numRuns: Number(process.env.FC_RUNS ?? 300) });
