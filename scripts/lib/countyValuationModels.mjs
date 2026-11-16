// Home-value candidates for any county, on recorded arm's-length sales in the shared row schema written by
// scripts/backtests/pull_*.py. Pure functions: rows in, estimates out. Same design as scripts/lib/laValuationModels.mjs.
//
// Row: { id, price, date "YYYY-MM-DD", bg, tract, sqft, lot, yb, eff, beds, baths, av, av_date }
//   av / av_date: the assessor's market value and the date it was set. A model may use `av` for a sale only if
//   av_date is before the sale date; otherwise the assessor may have seen the sale (leakage).

export const MIN_BG = 5;
export const MIN_TRACT = 5;
export const CURRENT_YEAR = 2026;

export const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function neighborhoodStats(rows) {
  const by = (key) => {
    const g = new Map();
    for (const r of rows) {
      const k = r[key];
      if (!k || !(r.price > 0) || !(r.sqft > 0)) continue;
      if (!g.has(k)) g.set(k, { v: [], p: [], d0: r.date, d1: r.date, ids: new Set() });
      const e = g.get(k);
      e.v.push(r.price); e.p.push(r.price / r.sqft); e.ids.add(r.id);
      if (r.date < e.d0) e.d0 = r.date;
      if (r.date > e.d1) e.d1 = r.date;
    }
    const out = new Map();
    for (const [k, e] of g) out.set(k, { n: e.v.length, median: median(e.v), ppsf: median(e.p), d0: e.d0, d1: e.d1, ids: e.ids });
    return out;
  };
  return { bg: by("bg"), tract: by("tract") };
}

export function neighborhoodFor(stats, r) {
  const b = stats.bg.get(r.bg);
  if (b && b.n >= MIN_BG) return { level: "block group", ...b };
  const t = stats.tract.get(r.tract);
  if (t && t.n >= MIN_TRACT) return { level: "tract", ...t };
  return null;
}

export const avUsable = (r) => r.av > 0 && !!r.av_date && r.av_date < r.date;

// Feature sets. "spec" decides which inputs a county's model uses, so the page can be held to the same inputs.
export const FEATURE_SETS = {
  regression: ["intercept", "log neighborhood $/sqft", "log neighborhood median", "log living sqft", "log lot sqft", "age/100", "bedrooms", "bathrooms", "tract fallback"],
  regression_with_assessor: ["intercept", "log neighborhood $/sqft", "log neighborhood median", "log living sqft", "log lot sqft", "age/100", "bedrooms", "bathrooms", "tract fallback", "log assessor market value"],
  // For places whose parcel layer has building area, lot area, year built and unit count but no rooms (NYC PLUTO).
  regression_pluto: ["intercept", "log neighborhood $/sqft", "log neighborhood median", "log building sqft", "log lot sqft", "age/100", "two-family", "tract fallback"],
  // Same inputs for other places whose records have no rooms (Florida's tax roll), alone and with the assessor's value.
  regression_no_rooms: ["intercept", "log neighborhood $/sqft", "log neighborhood median", "log building sqft", "log lot sqft", "age/100", "two-family", "tract fallback"],
  regression_no_rooms_with_assessor: ["intercept", "log neighborhood $/sqft", "log neighborhood median", "log building sqft", "log lot sqft", "age/100", "two-family", "tract fallback", "log assessor market value"],
};

export function features(spec, stats, r, { allowAvAnyDate = false } = {}) {
  const n = neighborhoodFor(stats, r);
  if (!n) return null;
  if (spec === "regression_pluto" || spec === "regression_no_rooms" || spec === "regression_no_rooms_with_assessor") {
    if (!(r.sqft >= 400) || !(r.lot > 0) || !(r.yb > 1700) || !(r.units === 1 || r.units === 2)) return null;
    const x = [1, Math.log(n.ppsf), Math.log(n.median), Math.log(r.sqft), Math.log(Math.min(Math.max(r.lot, 500), 200000)),
      (CURRENT_YEAR - r.yb) / 100, r.units === 2 ? 1 : 0, n.level === "tract" ? 1 : 0];
    if (spec === "regression_no_rooms_with_assessor") {
      if (!(r.av > 0) || (!allowAvAnyDate && !avUsable(r))) return null;
      x.push(Math.log(r.av));
    }
    return x;
  }
  if (!(r.sqft >= 400) || !(r.lot > 0) || !(r.yb > 1700) || !(r.beds >= 0) || !(r.baths >= 0)) return null;
  const x = [1, Math.log(n.ppsf), Math.log(n.median), Math.log(r.sqft), Math.log(Math.min(Math.max(r.lot, 500), 200000)),
    (CURRENT_YEAR - r.yb) / 100, Math.min(r.beds, 8), Math.min(r.baths, 8), n.level === "tract" ? 1 : 0];
  if (spec === "regression_with_assessor") {
    if (!(r.av > 0) || (!allowAvAnyDate && !avUsable(r))) return null;
    x.push(Math.log(r.av));
  }
  return x;
}

const foldOf = (id, k) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % k; };

// Cross-fitted features: neighborhood statistics for each fit row come from the other folds.
export function crossFit(spec, rows, opts, k = 5) {
  const out = [];
  for (let f = 0; f < k; f++) {
    const stats = neighborhoodStats(rows.filter((r) => foldOf(r.id, k) !== f));
    for (const r of rows) if (foldOf(r.id, k) === f) { const x = features(spec, stats, r, opts); if (x) out.push({ x, y: Math.log(r.price) }); }
  }
  return out;
}

export function fitRegression(spec, rows, { lambda = 1e-3, ...opts } = {}) {
  const XY = crossFit(spec, rows, opts);
  const k = FEATURE_SETS[spec].length;
  if (XY.length < 10 * k) return { spec, coef: null, n: XY.length, feature_names: FEATURE_SETS[spec] }; // inputs not in this county's data
  const A = Array.from({ length: k }, () => new Float64Array(k)), b = new Float64Array(k);
  for (const { x, y } of XY) for (let p = 0; p < k; p++) { b[p] += x[p] * y; for (let q = 0; q < k; q++) A[p][q] += x[p] * x[q]; }
  for (let p = 1; p < k; p++) A[p][p] += lambda * XY.length;
  const coef = solve(A.map((r) => [...r]), [...b]);
  const raw = XY.map(({ x, y }) => y - dot(coef, x));
  const shift = median(raw);
  coef[0] += shift; // target the typical sale, not the mean log (robust to low outliers)
  return { spec, coef, n: XY.length, feature_names: FEATURE_SETS[spec] };
}

// Assessor value times the median sale/assessor ratio in the fit rows (the classic sales-ratio estimate).
export function fitAssessorRatio(rows, { allowAvAnyDate = false } = {}) {
  const r = rows.filter((x) => x.av > 0 && (allowAvAnyDate || avUsable(x))).map((x) => x.price / x.av);
  return { spec: "assessor_ratio", ratio: median(r), n: r.length };
}

export function predictor(model, stats) {
  if (model.spec === "neighborhood_median") return (r) => { const n = neighborhoodFor(stats, r); return n ? n.median : null; };
  if (model.spec === "neighborhood_ppsf_x_sqft") return (r) => { const n = neighborhoodFor(stats, r); return n && r.sqft >= 400 ? n.ppsf * r.sqft : null; };
  if (model.spec === "assessor_ratio") return (r) => (avUsable(r) ? r.av * model.ratio : null);
  if (!model.coef) return () => null;
  return (r) => { const f = features(model.spec, stats, r); return f ? Math.exp(dot(model.coef, f)) : null; };
}

export function leakageCount(stats, testRows) {
  let n = 0;
  for (const r of testRows) {
    const b = stats.bg.get(r.bg), t = stats.tract.get(r.tract);
    if ((b && b.ids.has(r.id)) || (t && t.ids.has(r.id))) n++;
  }
  return n;
}

// Compact neighborhood table for the page (only what the page model needs).
export function statsForPage(stats) {
  const pack = (m) => Object.fromEntries([...m].filter(([, e]) => e.n >= MIN_BG).map(([k, e]) => [k, [e.n, Math.round(e.median), Math.round(e.ppsf * 100) / 100, e.d0, e.d1]]));
  return { bg: pack(stats.bg), tract: pack(stats.tract) };
}

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
function solve(A, b) {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < n; r++) { const f = A[r][c] / A[c][c]; for (let q = c; q < n; q++) A[r][q] -= f * A[c][q]; b[r] -= f * b[c]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let q = r + 1; q < n; q++) s -= A[r][q] * x[q]; x[r] = s / A[r][r]; }
  return x;
}
