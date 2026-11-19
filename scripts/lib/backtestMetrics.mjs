// Error metrics for valuation back-tests. Pure functions; no data or defaults inside.
// pairs: [{ est: number, target: number }]. Rows with a missing/non-positive est or target are excluded and counted.

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function bootstrapMedianCi(xs, reps = 500, alpha = 0.05) {
  if (!xs || xs.length < 30) return null;
  const n = xs.length;
  const medians = new Float64Array(reps);
  let seed = 42;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let r = 0; r < reps; r++) {
    const sample = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      sample[i] = xs[Math.floor(rnd() * n)];
    }
    sample.sort();
    const m = n >> 1;
    medians[r] = n % 2 ? sample[m] : (sample[m - 1] + sample[m]) / 2;
  }
  medians.sort();
  const lowIdx = Math.floor(reps * (alpha / 2));
  const highIdx = Math.min(reps - 1, Math.floor(reps * (1 - alpha / 2)));
  return [Math.round(medians[lowIdx] * 10000) / 10000, Math.round(medians[highIdx] * 10000) / 10000];
}

export function errorMetrics(pairs) {
  const ok = pairs.filter((p) => Number.isFinite(p.est) && p.est > 0 && Number.isFinite(p.target) && p.target > 0);
  const signed = ok.map((p) => (p.est - p.target) / p.target);
  const abs = signed.map(Math.abs);
  const r = (x) => (x == null ? null : Math.round(x * 10000) / 10000);
  const ci = abs.length >= 30 ? bootstrapMedianCi(abs) : null;
  return {
    n: ok.length,
    excluded: pairs.length - ok.length,
    mdape: r(median(abs)),
    mdape_ci_95: ci,
    mape: r(abs.length ? abs.reduce((a, b) => a + b, 0) / abs.length : null),
    median_signed_error: r(median(signed)), // negative = model under-estimates
    share_within_10pct: r(abs.length ? abs.filter((x) => x <= 0.1).length / abs.length : null),
    share_within_20pct: r(abs.length ? abs.filter((x) => x <= 0.2).length / abs.length : null),
    // Half of estimates fall within +/- this share of the target (same as MdAPE); 80% within:
    p80_abs_error: r(abs.length ? [...abs].sort((a, b) => a - b)[Math.min(abs.length - 1, Math.floor(abs.length * 0.8))] : null),
  };
}

// Group rows by a key function and compute metrics per group (groups smaller than minN are dropped and counted).
export function groupedMetrics(rows, keyFn, pick, minN = 30) {
  const groups = new Map();
  for (const row of rows) {
    const k = keyFn(row);
    if (k == null) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(pick(row));
  }
  const out = {};
  let dropped = 0;
  for (const [k, ps] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    if (ps.length < minN) { dropped += ps.length; continue; }
    out[k] = errorMetrics(ps);
  }
  return { groups: out, rows_in_small_groups: dropped, min_group_size: minN };
}

export function priceBand(v) {
  if (!(v > 0)) return null;
  if (v < 500000) return "under $500k";
  if (v < 1000000) return "$500k-$1M";
  if (v < 2000000) return "$1M-$2M";
  return "$2M and up";
}

// The page's rule for showing an estimate: the back-test must beat the naive baseline and keep MdAPE at or under the cap.
export function passesGate(model, baseline, mdapeCap = 0.15) {
  if (!model || model.mdape == null || model.n < 200) return { pass: false, reason: "fewer than 200 test sales" };
  if (model.mdape > mdapeCap) return { pass: false, reason: `median error ${(model.mdape * 100).toFixed(1)}% is above the ${mdapeCap * 100}% limit` };
  if (baseline && baseline.mdape != null && !(model.mdape < baseline.mdape)) {
    return { pass: false, reason: `does not beat the neighborhood median alone (${(model.mdape * 100).toFixed(1)}% vs ${(baseline.mdape * 100).toFixed(1)}%)` };
  }
  return { pass: true, reason: null };
}
