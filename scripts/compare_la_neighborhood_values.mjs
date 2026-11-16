#!/usr/bin/env node
// Compares the old LA block-group typical values (details m.hv, untraceable) with the rebuilt, traceable ones
// (app/data/la_neighborhood_values.json). Writes docs/audit/la-neighborhood-values-comparison.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLA, median } from "./lib/laParcels.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LA = loadLA(ROOT);
const nv = JSON.parse(fs.readFileSync(path.join(ROOT, "app/data/la_neighborhood_values.json"), "utf8"));
const pick = (bg) => {
  const b = nv.bg[bg];
  if (b && b[0] >= nv.min_bg) return { level: "block group", v: b[1] };
  const t = nv.tract[bg.slice(0, 11)];
  if (t && t[0] >= nv.min_tract) return { level: "tract", v: t[1] };
  return null;
};
let both = 0, oldOnly = 0, newOnly = 0, neither = 0;
const ratios = [], byLevel = { "block group": 0, tract: 0 }, byOldSource = {};
for (const bg of LA.bgIds) {
  const m = LA.m.get(bg) || {};
  const o = +m.hv || null, n = pick(bg);
  if (o && n) {
    both++; byLevel[n.level]++;
    const r = n.v / o;
    ratios.push(r);
    const src = /recorded home sales here/.test(m.hvs || "") ? "old: block-group sales" : /recorded home sales/.test(m.hvs || "") ? "old: tract sales" : m.hvs ? "old: other" : "old: no source";
    (byOldSource[src] = byOldSource[src] || []).push(r);
  } else if (o) oldOnly++; else if (n) newOnly++; else neither++;
}
const summ = (rs) => {
  const ad = rs.map((r) => Math.abs(r - 1));
  return { n: rs.length, median_new_over_old: +median(rs).toFixed(4), median_abs_diff: +median(ad).toFixed(4), within_10pct: +(ad.filter((x) => x <= 0.1).length / rs.length).toFixed(4), within_20pct: +(ad.filter((x) => x <= 0.2).length / rs.length).toFixed(4), over_50pct_apart: rs.filter((r) => r > 1.5 || r < 1 / 1.5).length };
};
const out = {
  compared_on: new Date().toISOString().slice(0, 10),
  block_groups: LA.bgIds.length,
  coverage: { both, old_only: oldOnly, new_only: newOnly, neither, new_value_level: byLevel },
  all: summ(ratios),
  by_old_source: Object.fromEntries(Object.entries(byOldSource).map(([k, v]) => [k, summ(v)])),
};
fs.writeFileSync(path.join(ROOT, "docs/audit/la-neighborhood-values-comparison.json"), JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out, null, 1));
