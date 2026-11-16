// Home-value candidates for LA County, built only from public Assessor base-year resets (sale-price proxy; see
// scripts/lib/laParcels.mjs for the legal basis). Pure functions: rows in, estimates out.
//
// Row shape: { ain, bg, tract, year, value, sqft, lot, yb, eff, beds, baths, quality }

import { median } from "./laParcels.mjs";

export const MIN_BG = 5; // a block-group median needs at least 5 homes, else the tract's is used
export const MIN_TRACT = 5; // ...and a tract needs 5, else no estimate

// Neighborhood statistics from a set of "prior" rows (never from the homes being estimated).
export function neighborhoodStats(rows) {
  const by = (key) => {
    const g = new Map();
    for (const r of rows) {
      const k = r[key];
      if (!k) continue;
      if (!g.has(k)) g.set(k, { v: [], p: [], y0: r.year, y1: r.year, ains: new Set() });
      const e = g.get(k);
      e.v.push(r.value); e.p.push(r.value / r.sqft); e.ains.add(r.ain);
      e.y0 = Math.min(e.y0, r.year); e.y1 = Math.max(e.y1, r.year);
    }
    const out = new Map();
    for (const [k, e] of g) out.set(k, { n: e.v.length, median: median(e.v), ppsf: median(e.p), y0: e.y0, y1: e.y1, ains: e.ains });
    return out;
  };
  return { bg: by("bg"), tract: by("tract") };
}

// The neighborhood record used for a home: its block group if it has MIN_BG homes, else its tract.
export function neighborhoodFor(stats, r) {
  const b = stats.bg.get(r.bg);
  if (b && b.n >= MIN_BG) return { level: "block group", ...b };
  const t = stats.tract.get(r.tract);
  if (t && t.n >= MIN_TRACT) return { level: "tract", ...t };
  return null;
}

// ---------- candidates ----------
export const candidates = {
  neighborhood_median: (stats) => (r) => { const n = neighborhoodFor(stats, r); return n ? n.median : null; },
  neighborhood_ppsf_x_sqft: (stats) => (r) => { const n = neighborhoodFor(stats, r); return n ? n.ppsf * r.sqft : null; },
};

// Features for the regression (log value). Missing inputs make the row unusable (no imputed values).
export function features(stats, r) {
  const n = neighborhoodFor(stats, r);
  if (!n) return null;
  if (!(r.lot > 0) || !(r.quality > 0) || !(r.beds >= 0) || !(r.baths >= 0) || !(r.yb > 1850)) return null;
  const age = 2026 - r.yb;
  const effAge = 2026 - (r.eff > r.yb ? r.eff : r.yb);
  return [
    1,
    Math.log(n.ppsf),
    Math.log(n.median),
    Math.log(r.sqft),
    Math.log(Math.min(Math.max(r.lot, 1000), 200000)),
    age / 100,
    effAge / 100,
    Math.min(r.beds, 8),
    Math.min(r.baths, 8),
    r.quality,
    n.level === "tract" ? 1 : 0,
  ];
}
export const FEATURE_NAMES = ["intercept", "log neighborhood $/sqft", "log neighborhood median value", "log living sqft", "log lot sqft", "age/100", "effective age/100", "bedrooms", "bathrooms", "quality class number", "tract fallback"];

// Cross-fitting: each home's neighborhood features come from the OTHER folds of the same rows, so a home never sits
// in its own neighborhood statistics while the model is fit (the same condition as when it is used).
const foldOf = (ain, k) => { let h = 0; for (const c of String(ain)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % k; };
export function crossFitFeatures(rows, k = 5) {
  const out = [];
  for (let f = 0; f < k; f++) {
    const stats = neighborhoodStats(rows.filter((r) => foldOf(r.ain, k) !== f));
    for (const r of rows) if (foldOf(r.ain, k) === f) { const x = features(stats, r); if (x) out.push({ x, y: Math.log(r.value) }); }
  }
  return out;
}

// Ridge-stabilised least squares on log(value), fit on cross-fitted features of `rows`.
export function fitRegression(rows, lambda = 1e-3) {
  const X = [], y = [];
  for (const { x, y: t } of crossFitFeatures(rows)) { X.push(x); y.push(t); }
  const k = FEATURE_NAMES.length;
  const A = Array.from({ length: k }, () => new Float64Array(k));
  const b = new Float64Array(k);
  for (let i = 0; i < X.length; i++) {
    const xi = X[i];
    for (let p = 0; p < k; p++) {
      b[p] += xi[p] * y[i];
      for (let q = 0; q < k; q++) A[p][q] += xi[p] * xi[q];
    }
  }
  for (let p = 1; p < k; p++) A[p][p] += lambda * X.length;
  const coef = solve(A.map((r) => [...r]), [...b]);
  // Least squares on log value tracks the MEAN log, which low outliers (e.g. non-sale transfers reassessed below
  // market) pull down. Shift the intercept by the median cross-fitted residual so the model targets the typical
  // home. Uses the fit rows only.
  const raw = X.map((xi, i) => y[i] - dot(coef, xi));
  const shift = median(raw);
  coef[0] += shift;
  const resid = raw.map((e) => e - shift);
  return { coef, n: X.length, residual_sd: Math.sqrt(resid.reduce((s, e) => s + e * e, 0) / Math.max(1, resid.length - k)) };
}

export function regressionPredictor(stats, model) {
  return (r) => { const f = features(stats, r); return f ? Math.exp(dot(model.coef, f)) : null; };
}

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
function solve(A, b) {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let q = c; q < n; q++) A[r][q] -= f * A[c][q];
      b[r] -= f * b[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let q = r + 1; q < n; q++) s -= A[r][q] * x[q];
    x[r] = s / A[r][r];
  }
  return x;
}

// A test home must not be part of the statistics used to estimate it.
export function leakageCount(stats, testRows) {
  let leaks = 0;
  for (const r of testRows) {
    const b = stats.bg.get(r.bg), t = stats.tract.get(r.tract);
    if ((b && b.ains.has(r.ain)) || (t && t.ains.has(r.ain))) leaks++;
  }
  return leaks;
}
