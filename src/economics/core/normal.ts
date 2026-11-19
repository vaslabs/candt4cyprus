/**
 * Standard normal CDF. Uses the complementary error function via W. J. Cody's rational
 * Chebyshev approximations (relative error < 1e-15 in double precision over the real line),
 * as in netlib SPECFUN `calerf`.
 */
const A = [3.1611237438705655, 113.86415415105016, 377.485237685302, 3209.3775891384694, 0.18577770618460315];
const B = [23.601290952344122, 244.02463793444417, 1282.6165260773723, 2844.236833439171];
const C = [
  0.5641884969886701, 8.883149794388377, 66.11919063714163, 298.6351381974001, 881.952221241769,
  1712.0476126340707, 2051.0783778260716, 1230.3393547979972, 2.1531153547440383e-8,
];
const D = [
  15.744926110709835, 117.6939508913125, 537.1811018620099, 1621.3895745666903, 3290.7992357334842,
  4362.619090143247, 3439.3676741437216, 1230.3393548037495,
];
const P = [
  0.30532663496123236, 0.36034489994980445, 0.12578172611122926, 0.016083785148742275, 0.0006587491615298367,
  0.016315387137302097,
];
const Q = [
  2.5685201922898684, 1.8729528499234604, 0.5279051029514221, 0.06051834131244132, 0.0023352049762686918,
];
const SQRPI = 0.5641895835477563; // 1/√π

/** erfc(x) for real x. */
export function erfc(x: number): number {
  const y = Math.abs(x);
  let r: number;
  if (y <= 0.46875) {
    const z = y > 1.11e-16 ? y * y : 0;
    let num = A[4]! * z;
    let den = z;
    for (let i = 0; i < 3; i++) {
      num = (num + A[i]!) * z;
      den = (den + B[i]!) * z;
    }
    const erfv = (x * (num + A[3]!)) / (den + B[3]!);
    return 1 - erfv;
  } else if (y <= 4) {
    let num = C[8]! * y;
    let den = y;
    for (let i = 0; i < 7; i++) {
      num = (num + C[i]!) * y;
      den = (den + D[i]!) * y;
    }
    r = (num + C[7]!) / (den + D[7]!);
    const ysq = Math.trunc(y * 16) / 16;
    const del = (y - ysq) * (y + ysq);
    r *= Math.exp(-ysq * ysq) * Math.exp(-del);
  } else {
    if (y >= 26.6) r = 0;
    else {
      const z = 1 / (y * y);
      let num = P[5]! * z;
      let den = z;
      for (let i = 0; i < 4; i++) {
        num = (num + P[i]!) * z;
        den = (den + Q[i]!) * z;
      }
      r = (z * (num + P[4]!)) / (den + Q[4]!);
      r = (SQRPI - r) / y;
      const ysq = Math.trunc(y * 16) / 16;
      const del = (y - ysq) * (y + ysq);
      r *= Math.exp(-ysq * ysq) * Math.exp(-del);
    }
  }
  return x < 0 ? 2 - r : r;
}

/** Φ(x) = P(Z ≤ x), Z ~ N(0,1). */
export function normalCdf(x: number): number {
  return 0.5 * erfc(-x / Math.SQRT2);
}
