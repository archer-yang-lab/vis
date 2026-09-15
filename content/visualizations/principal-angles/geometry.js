export const transpose = matrix => matrix[0].map((_, j) => matrix.map(row => row[j]));
export const multiply = (a, b) => a.map(row => b[0].map((_, j) => row.reduce((sum, x, k) => sum + x * b[k][j], 0)));
export const column = (matrix, i) => matrix.map(row => row[i]);
export const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
export const scale = (a, s) => a.map(x => x * s);
export const add = (a, b) => a.map((x, i) => x + b[i]);
export const radians = degrees => degrees * Math.PI / 180;
export function rotation(degrees) {
  const c = Math.cos(radians(degrees)), s = Math.sin(radians(degrees));
  return [[c, -s], [s, c]];
}

// This family has an exact SVD; no numerical optimization is needed.
// Vhat^T V = Q(beta)^T diag(1, cos(phi)) Q(alpha).
export function principalModel(phi, alpha = 0, beta = 0) {
  if (![phi, alpha, beta].every(Number.isFinite) || phi < 0 || phi > 90) throw new RangeError('Use 0 <= phi <= 90 degrees and finite basis rotations.');
  const c = Math.abs(Math.cos(radians(phi))) < 1e-14 ? 0 : Math.cos(radians(phi));
  const s = Math.sin(radians(phi));
  const E = [[1, 0], [0, 1], [0, 0]];
  const H = [[1, 0], [0, c], [0, s]];
  const V = multiply(E, rotation(alpha)), Vhat = multiply(H, rotation(beta));
  const L = transpose(rotation(beta)), R = transpose(rotation(alpha));
  return {
    phi, alpha, beta, E, H, V, Vhat, L, R,
    M: multiply(transpose(Vhat), V), Sigma: [[1, 0], [0, c]],
    U: multiply(V, R), Uhat: multiply(Vhat, L),
    cosines: [1, c], angles: [0, phi],
    projection: [[1, 0], [0, c], [0, 0]]
  };
}
