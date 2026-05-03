// Optimizer update rules for the 2D loss landscape demo.
// Each step function takes (params, grad, state, lr, opts) and returns { params, state }.
// params = [x, y], grad = [gx, gy], state is optimizer-specific.

import { nsStep } from './newton_schulz.js';
import { scale, frobNorm } from './linalg.js';

export function gdStep(params, grad, state, lr) {
  return {
    params: [params[0] - lr * grad[0], params[1] - lr * grad[1]],
    state,
  };
}

export function adamStep(params, grad, state, lr) {
  const beta1 = state.beta1 ?? 0.9;
  const beta2 = state.beta2 ?? 0.999;
  const eps   = state.eps   ?? 1e-8;
  const t = (state.t ?? 0) + 1;
  const m = [
    beta1 * (state.m?.[0] ?? 0) + (1 - beta1) * grad[0],
    beta1 * (state.m?.[1] ?? 0) + (1 - beta1) * grad[1],
  ];
  const v = [
    beta2 * (state.v?.[0] ?? 0) + (1 - beta2) * grad[0] ** 2,
    beta2 * (state.v?.[1] ?? 0) + (1 - beta2) * grad[1] ** 2,
  ];
  const bc1 = 1 - beta1 ** t;
  const bc2 = 1 - beta2 ** t;
  return {
    params: [
      params[0] - lr * (m[0] / bc1) / (Math.sqrt(v[0] / bc2) + eps),
      params[1] - lr * (m[1] / bc1) / (Math.sqrt(v[1] / bc2) + eps),
    ],
    state: { ...state, t, m, v },
  };
}

// Muon: treat gradient as 2×1 matrix, run NS to get unit-direction update.
export function muonStep(params, grad, state, lr, nsIters = 5) {
  const norm = Math.sqrt(grad[0] ** 2 + grad[1] ** 2);
  if (norm < 1e-12) return { params, state };

  // 2×1 matrix normalized so top singular value ≤ 1
  let Xk = [[grad[0] / (norm + 1e-7)], [grad[1] / (norm + 1e-7)]];
  for (let i = 0; i < nsIters; i++) Xk = nsStep(Xk);

  return {
    params: [params[0] - lr * Xk[0][0], params[1] - lr * Xk[1][0]],
    state,
  };
}

// Numerical gradient via central differences
export function numericalGrad(lossF, x, y, h = 1e-4) {
  return [
    (lossF(x + h, y) - lossF(x - h, y)) / (2 * h),
    (lossF(x, y + h) - lossF(x, y - h)) / (2 * h),
  ];
}

// Default starting states
export function initialState(optimizerName, opts = {}) {
  switch (optimizerName) {
    case 'adam': return { beta1: opts.beta1 ?? 0.9, beta2: opts.beta2 ?? 0.999, eps: 1e-8 };
    default: return {};
  }
}
