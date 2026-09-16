export const radians = angle => angle * Math.PI / 180;
export const dot = (x, y) => x.reduce((sum, value, i) => sum + value * y[i], 0);
export function example(shared = false) {
  const angles = [shared ? 0 : 20, 60];
  const cosines = angles.map(angle => Math.cos(radians(angle)));
  return {
    angles, cosines,
    blue: [[1, 0, 0, 0], [0, 1, 0, 0]],
    orange: [[cosines[0], 0, Math.sin(radians(angles[0])), 0], [0, cosines[1], 0, Math.sin(radians(angles[1]))]]
  };
}
export function candidate(model, alpha, beta) {
  const x = [Math.cos(radians(alpha)), Math.sin(radians(alpha))];
  const y = [Math.cos(radians(beta)), Math.sin(radians(beta))];
  const a = model.blue[0].map((_, j) => x[0] * model.blue[0][j] + x[1] * model.blue[1][j]);
  const ahat = model.orange[0].map((_, j) => y[0] * model.orange[0][j] + y[1] * model.orange[1][j]);
  return { x, y, a, ahat, score: dot(a, ahat), blueConstraint: x[0], orangeConstraint: y[0] };
}
export function initialState(shared = false) {
  return { shared, stage: 1, chosen: false, alpha: 35, beta: 70, results: [] };
}
export function chooseBest(state) {
  const model = example(state.shared), index = state.stage - 1;
  const angle = index * 90;
  return { ...state, chosen: true, alpha: angle, beta: angle,
    results: [...state.results.slice(0, index), { sigma: model.cosines[index], theta: model.angles[index] }] };
}
export function continueToSecond(state) {
  if (state.stage !== 1 || !state.chosen) throw new Error('Choose the first pair before adding its orthogonality constraints.');
  return { ...state, stage: 2, chosen: false, alpha: 90, beta: -90 };
}
