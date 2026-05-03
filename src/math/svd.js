// Jacobi one-sided SVD for matrices up to ~8×8.
// Returns { U, S, V } where A ≈ U * diag(S) * V^T.
// U is m×n, S is length-n, V is n×n (all sorted descending by singular value).

import { zeros, identity, frobNorm } from './linalg.js';

export function svd(A) {
  const m = A.length, n = A[0].length;
  let B = A.map(row => [...row]);
  let V = identity(n);

  const tol = 1e-12;
  const maxSweeps = 200;

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let changed = false;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        let alpha = 0, beta = 0, gamma = 0;
        for (let i = 0; i < m; i++) {
          alpha += B[i][p] * B[i][p];
          beta  += B[i][q] * B[i][q];
          gamma += B[i][p] * B[i][q];
        }

        if (Math.abs(gamma) <= tol * Math.sqrt(alpha * beta)) continue;
        changed = true;

        const tau = (beta - alpha) / (2 * gamma);
        const t = Math.sign(tau) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = c * t;

        for (let i = 0; i < m; i++) {
          const bp = B[i][p], bq = B[i][q];
          B[i][p] = c * bp - s * bq;
          B[i][q] = s * bp + c * bq;
        }
        for (let i = 0; i < n; i++) {
          const vp = V[i][p], vq = V[i][q];
          V[i][p] = c * vp - s * vq;
          V[i][q] = s * vp + c * vq;
        }
      }
    }
    if (!changed) break;
  }

  // Extract singular values and U columns
  const S = new Array(n);
  const U = zeros(m, n);
  for (let j = 0; j < n; j++) {
    let norm = 0;
    for (let i = 0; i < m; i++) norm += B[i][j] * B[i][j];
    norm = Math.sqrt(norm);
    S[j] = norm;
    if (norm > tol) {
      for (let i = 0; i < m; i++) U[i][j] = B[i][j] / norm;
    }
  }

  // Sort descending by singular value
  const idx = S.map((_, i) => i).sort((a, b) => S[b] - S[a]);
  const Ss = idx.map(i => S[i]);
  const Us = zeros(m, n), Vs = zeros(n, n);
  for (let j = 0; j < n; j++) {
    const src = idx[j];
    for (let k = 0; k < m; k++) Us[k][j] = U[k][src];
    for (let k = 0; k < n; k++) Vs[k][j] = V[k][src];
  }

  return { U: Us, S: Ss, V: Vs };
}

export function singularValues(A) {
  return svd(A).S;
}

// Polar factor: U * V^T from SVD(A) = U diag(S) V^T
export function polarFactor(A) {
  const { U, V } = svd(A);
  const m = U.length, n = V.length;
  const P = zeros(m, n);
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < Math.min(m, n); k++)
        P[i][j] += U[i][k] * V[j][k];
  return P;
}

// 2×2 analytic SVD (faster and exact for visualization in Section 1)
export function svd2x2(A) {
  const [[a, b], [c, d]] = A;
  // ATA = [[a²+c², ab+cd],[ab+cd, b²+d²]]
  const a2c2 = a * a + c * c;
  const b2d2 = b * b + d * d;
  const abcd = a * b + c * d;

  // Eigenvalues of ATA
  const trace = a2c2 + b2d2;
  const det = a2c2 * b2d2 - abcd * abcd;
  const mid = trace / 2;
  const spread = Math.sqrt(Math.max(0, mid * mid - det));
  const lam1 = mid + spread, lam2 = mid - spread;
  const s1 = Math.sqrt(Math.max(0, lam1));
  const s2 = Math.sqrt(Math.max(0, lam2));

  // V columns from ATA eigenvectors
  let v1, v2;
  if (Math.abs(abcd) > 1e-12 || Math.abs(a2c2 - b2d2) > 1e-12) {
    const angle = 0.5 * Math.atan2(2 * abcd, a2c2 - b2d2);
    const cv = Math.cos(angle), sv = Math.sin(angle);
    v1 = [cv, sv];
    v2 = [-sv, cv];
  } else {
    v1 = [1, 0]; v2 = [0, 1];
  }

  const V = [[v1[0], v2[0]], [v1[1], v2[1]]];

  // U columns: u_i = A * v_i / sigma_i
  const av1 = [a * v1[0] + b * v1[1], c * v1[0] + d * v1[1]];
  const av2 = [a * v2[0] + b * v2[1], c * v2[0] + d * v2[1]];
  const u1 = s1 > 1e-12 ? [av1[0] / s1, av1[1] / s1] : [1, 0];
  const u2 = s2 > 1e-12 ? [av2[0] / s2, av2[1] / s2] : [-u1[1], u1[0]];

  const U = [[u1[0], u2[0]], [u1[1], u2[1]]];

  return { U, S: [s1, s2], V };
}

// Self-tests
function runTests() {
  const A = [[3, 0], [0, 2]];
  const { S } = svd(A);
  console.assert(Math.abs(S[0] - 3) < 1e-6 && Math.abs(S[1] - 2) < 1e-6, 'svd diagonal');

  const B = [[1, 2], [3, 4]];
  const { U, S: Sb, V } = svd(B);
  // Reconstruct
  let rec = zeros(2, 2);
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++)
      for (let k = 0; k < 2; k++)
        rec[i][j] += U[i][k] * Sb[k] * V[j][k];
  console.assert(Math.abs(rec[0][0] - 1) < 1e-6, 'svd reconstruct');

  const { S: S2 } = svd2x2(B);
  console.assert(Math.abs(S2[0] - Sb[0]) < 1e-5, 'svd2x2 matches svd');
}
runTests();
