// Newton-Schulz iteration for computing the polar factor of a matrix.
// Scalar version: f(σ) = σ(15/8 − 10/8 σ² + 3/8 σ⁴)  → all SVs converge to 1.
// Matrix version: X_{k+1} = X_k @ (15/8·I − 10/8·X_kᵀ X_k + 3/8·(X_kᵀ X_k)²)

import { mul, add, scale, identity, transpose, frobNorm } from './linalg.js';

// --- Scalar iterations ---

export function nsStepScalar(s) {
  return s * (15 / 8 - (10 / 8) * s * s + (3 / 8) * s * s * s * s);
}

export function nsStepScalarCubic(s) {
  return (3 * s - s * s * s) / 2;
}

// --- Matrix iterations ---

// Quintic convergence (the one Muon uses)
export function nsStep(X) {
  const n = X[0].length;
  const I = identity(n);
  const XtX = mul(transpose(X), X);
  const XtX2 = mul(XtX, XtX);
  const M = add(add(scale(I, 15 / 8), scale(XtX, -10 / 8)), scale(XtX2, 3 / 8));
  return mul(X, M);
}

// Cubic convergence (simpler, for comparison)
export function nsStepCubic(X) {
  const Xt = transpose(X);
  const XXT = mul(X, Xt);
  const XXTX = mul(XXT, X);
  return scale(add(scale(X, 3), scale(XXTX, -1)), 1 / 2);
}

// --- Full runs with history ---

// Run NS on a matrix for maxIter steps.
// svdFn(X) → array of singular values (passed in to avoid circular deps).
// Returns array of { X, singularValues, error, iter }.
export function nsRun(X, maxIter, svdFn) {
  const norm = frobNorm(X);
  let Xk = scale(X, 1 / (norm + 1e-7));
  const history = [];

  for (let i = 0; i <= maxIter; i++) {
    const svs = svdFn(Xk);
    const error = Math.max(...svs.map(s => Math.abs(s - 1)));
    history.push({ X: Xk.map(r => [...r]), singularValues: [...svs], error, iter: i });
    if (i < maxIter) Xk = nsStep(Xk);
  }
  return history;
}

export function nsRunCubic(X, maxIter, svdFn) {
  const norm = frobNorm(X);
  let Xk = scale(X, 1 / (norm + 1e-7));
  const history = [];

  for (let i = 0; i <= maxIter; i++) {
    const svs = svdFn(Xk);
    const error = Math.max(...svs.map(s => Math.abs(s - 1)));
    history.push({ singularValues: [...svs], error, iter: i });
    if (i < maxIter) Xk = nsStepCubic(Xk);
  }
  return history;
}

// Run scalar NS from starting value s0 for maxIter steps.
// Returns array of { s, iter } for quintic + cubic + linear.
export function nsRunScalarAll(s0, maxIter) {
  const quintic = [{ s: s0, iter: 0 }];
  const cubic   = [{ s: s0, iter: 0 }];
  const linear  = [{ s: s0, iter: 0 }];

  let sq = s0, sc = s0, sl = s0;
  for (let i = 1; i <= maxIter; i++) {
    sq = nsStepScalar(sq);
    sc = nsStepScalarCubic(sc);
    // "linear": gradient descent toward 1, slowest convergence demo
    sl = sl + 0.3 * (1 - sl);
    quintic.push({ s: sq, iter: i });
    cubic.push({ s: sc, iter: i });
    linear.push({ s: sl, iter: i });
  }
  return { quintic, cubic, linear };
}

// Self-tests
function runTests() {
  // After enough scalar steps, σ should converge to 1
  let s = 0.7;
  for (let i = 0; i < 10; i++) s = nsStepScalar(s);
  console.assert(Math.abs(s - 1) < 1e-6, 'scalar NS converges to 1');

  // Fixed point at s=1
  console.assert(Math.abs(nsStepScalar(1) - 1) < 1e-12, 'NS fixed point at 1');
}
runTests();
