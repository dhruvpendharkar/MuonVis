// Matrix operations on plain JS arrays-of-arrays (row-major: M[row][col]).

export function zeros(m, n) {
  return Array.from({ length: m }, () => new Array(n).fill(0));
}

export function identity(n) {
  const M = zeros(n, n);
  for (let i = 0; i < n; i++) M[i][i] = 1;
  return M;
}

export function clone(A) {
  return A.map(row => [...row]);
}

export function rows(A) { return A.length; }
export function cols(A) { return A[0].length; }

export function transpose(A) {
  const m = rows(A), n = cols(A);
  const B = zeros(n, m);
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      B[j][i] = A[i][j];
  return B;
}

export function mul(A, B) {
  const m = rows(A), k = cols(A), n = cols(B);
  const C = zeros(m, n);
  for (let i = 0; i < m; i++)
    for (let l = 0; l < k; l++) {
      if (A[i][l] === 0) continue;
      for (let j = 0; j < n; j++)
        C[i][j] += A[i][l] * B[l][j];
    }
  return C;
}

export function add(A, B) {
  const m = rows(A), n = cols(A);
  const C = zeros(m, n);
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      C[i][j] = A[i][j] + B[i][j];
  return C;
}

export function sub(A, B) {
  const m = rows(A), n = cols(A);
  const C = zeros(m, n);
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      C[i][j] = A[i][j] - B[i][j];
  return C;
}

export function scale(A, s) {
  return A.map(row => row.map(v => v * s));
}

export function matVec(A, v) {
  return A.map(row => row.reduce((acc, a, j) => acc + a * v[j], 0));
}

export function vecNorm(v) {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

export function dot(u, v) {
  return u.reduce((s, x, i) => s + x * v[i], 0);
}

export function frobNorm(A) {
  let s = 0;
  for (const row of A) for (const v of row) s += v * v;
  return Math.sqrt(s);
}

// Verify: A * B = expected (for console.assert tests)
export function matEqual(A, B, tol = 1e-9) {
  if (rows(A) !== rows(B) || cols(A) !== cols(B)) return false;
  for (let i = 0; i < rows(A); i++)
    for (let j = 0; j < cols(A); j++)
      if (Math.abs(A[i][j] - B[i][j]) > tol) return false;
  return true;
}

// Self-tests
function runTests() {
  const I2 = identity(2);
  console.assert(matEqual(mul(I2, I2), I2), 'I*I=I');

  const A = [[1, 2], [3, 4]];
  const At = transpose(A);
  console.assert(At[0][1] === 3 && At[1][0] === 2, 'transpose');

  const B = [[5, 6], [7, 8]];
  const C = mul(A, B);
  console.assert(C[0][0] === 19 && C[1][1] === 50, 'mul');

  console.assert(Math.abs(frobNorm([[3, 4]]) - 5) < 1e-9, 'frobNorm');
}
runTests();
