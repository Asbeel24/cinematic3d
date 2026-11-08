// Deterministic motion helpers. Every value here is a pure function of its inputs.
// Never use Math.random / Date.now / performance.now in scenes.

/** mulberry32 seeded PRNG. Returns a function producing floats in [0,1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash → [0,1). Stateless, good for per-index randomness. */
export function hash1(n: number, seed = 0): number {
  let h = (Math.imul(n | 0, 374761393) + Math.imul(seed | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 1D value noise in [-1,1]. */
export function noise1D(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash1(i, seed) * 2 - 1;
  const b = hash1(i + 1, seed) * 2 - 1;
  return a + (b - a) * u;
}

/** CSS-style cubic bezier easing. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = dsx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= (sx(t) - x) / d;
    }
    t = Math.min(1, Math.max(0, t));
    return sy(t);
  };
}

export type Ease = (x: number) => number;
export const ease = {
  cine: cubicBezier(0.2, 0.8, 0.2, 1),
  inOut: cubicBezier(0.65, 0, 0.35, 1),
  in: cubicBezier(0.5, 0, 0.75, 0),
  out: cubicBezier(0.25, 1, 0.5, 1),
  /** Only for drift/noise where constant speed is intended. */
  linear: (x: number) => x,
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Map t in [from,to] → eased 0..1. */
export function progress(t: number, from: number, to: number, e: Ease = ease.cine) {
  return e(clamp01((t - from) / (to - from)));
}

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Smooth 3D value noise in [-1,1]. */
export function noise3D(x: number, y: number, z: number, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (v: number) => v * v * (3 - 2 * v);
  const u = s(xf), v = s(yf), w = s(zf);
  const h = (a: number, b: number, c: number) =>
    hash1(a * 73856093 ^ b * 19349663 ^ c * 83492791, seed) * 2 - 1;
  const l = (a: number, b: number, k: number) => a + (b - a) * k;
  return l(
    l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}

export type SpringOpts = {
  /** frame the spring starts */
  start?: number;
  /** frames until it is visually settled (≈2% band) */
  settle?: number;
  /** peak overshoot as a fraction, default 0.015 (1.5%). Jelly type may use more. */
  overshoot?: number;
};

/**
 * Analytic under-damped spring 0 → 1, a pure function of t (frames).
 * Damping ratio is derived from the desired overshoot.
 */
export function springAt(t: number, { start = 0, settle = 24, overshoot = 0.015 }: SpringOpts = {}) {
  const tau = t - start;
  if (tau <= 0) return 0;
  const os = Math.min(0.9, Math.max(1e-4, overshoot));
  const lnos = Math.log(os);
  const zeta = -lnos / Math.sqrt(Math.PI * Math.PI + lnos * lnos);
  // settle time (2%) ≈ 4 / (zeta * wn)
  const wn = 4 / (zeta * settle);
  const wd = wn * Math.sqrt(1 - zeta * zeta);
  const e = Math.exp(-zeta * wn * tau);
  return 1 - e * (Math.cos(wd * tau) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * tau));
}

/** Seconds → frames helper. */
export const sec = (s: number, fps: number) => Math.round(s * fps);
