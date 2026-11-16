// Error metrics for valuation back-tests. Pure functions; no data or defaults inside.
// pairs: [{ est: number, target: number }]. Rows with a missing/non-positive est or target are excluded and counted.

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function errorMetrics(pairs) {
  const ok = pairs.filter((p) => Number.isFinite(p.est) && p.est > 0 && Number.isFinite(p.target) && p.target > 0);
  const signed = ok.map((p) => (p.est - p.target) / p.target);
  const abs = signed.map(Math.abs);
  const r = (x) => (x == null ? null : Math.round(x * 10000) / 10000);
  return {
    n: ok.length,
    excluded: pairs.length - ok.length,
    mdape: r(median(abs)),
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
