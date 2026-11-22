#!/usr/bin/env python3
"""Print the result tables of docs/PREDICTION-MODEL.md Part B (markdown) from a walk-forward run.
Usage: python3 scripts/predict/report_tables.py [--run <dir>] > tables.md"""
import argparse
import json
import os

NAMES = {"noskill": "No skill (county median)", "cheapest": "Cheapest tracts", "trend": "Prior 5-year trend", "ridge": "Ridge, all 16 features (primary)",
         "ridge_noprice": "Ridge without price-level features", "gbm": "Boosted trees (secondary)", "ridge_metro": "Ridge + county features (metro target)"}


def p(x, k=1):
    return "n/a" if x is None else f"{100 * x:+.{k}f}"


def s(x, k=3):
    return "n/a" if x is None else f"{x:.{k}f}"


def civ(b, f=p):
    return f"{f(b['mean'])} ({f(b['ci90'][0])} to {f(b['ci90'][1])})"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="/tmp/claude-0/-home-user-city-pretty/3156622b-69a9-5d91-83c1-d393ef77389e/scratchpad/predict/run")
    a = ap.parse_args()
    R = json.load(open(os.path.join(a.run, "results.json")))
    cur = json.load(open(os.path.join(a.run, "current.json")))
    bt = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "app", "data", "neighborhood_score_backtest.json")))
    names = {x["fips"]: x["name"] for x in bt["per_metro"]}
    out = []
    w = out.append
    D = R["decision"]
    w("### B.1 Decision (5-year, county-relative, test windows starting 2019 and 2020)\n")
    w("| Paired difference in top-minus-bottom-fifth spread (points) | Mean (90% county-bootstrap interval) | Share of draws <= 0 | Cells / counties |")
    w("|---|---|---|---|")
    for k, lab in (("paired_vs_cheapest", "Ridge minus cheapest tracts"), ("paired_vs_trend", "Ridge minus prior trend")):
        b = D[k]
        w(f"| {lab} | {civ(b)} | {s(b['share_draws_le_0'])} | {b['cells']} / {b['counties']} |")
    n_ok2 = sum(1 for v in D["per_county"].values() if v["ridge"] is not None and v["ridge"] >= (v["cheapest"] if v["cheapest"] is not None else -9) and v["ridge"] >= (v["trend"] if v["trend"] is not None else -9))
    w(f"\nPart 1 of the rule: {'passed' if D['overall_pass'] else 'failed'} (the interval against the cheapest baseline {'excludes' if D['paired_vs_cheapest']['ci90'][0] > 0 else 'includes'} zero). "
      f"Counties using the model: {D['counties_using_model']} of 50. For information only: the model's own-county spread was at least both baselines' in {n_ok2} of {len(D['per_county'])} counties with test cells.\n")
    for h in ("5", "3"):
        H = R["horizons"][h]
        w(f"### B.{2 if h == '5' else 3} {h}-year test, windows starting {', '.join(map(str, H['test_origins']))}\n")
        w(f"Cells (counties with at least 20 tracts) per origin: {', '.join(f'{T}: {n}' for T, n in H['cells_per_origin'].items())}. Tracts per origin: {', '.join(f'{T}: {n}' for T, n in H['tracts_per_origin'].items())}.\n")
        w("| Method | Top-minus-bottom fifth, points (90% interval) | Spearman (90% interval) | Top-third hit rate (90% interval) |")
        w("|---|---|---|---|")
        for m in H["spread"]:
            w(f"| {NAMES.get(m, m)} | {civ(H['spread'][m]['pooled'])} | {civ(H['rho'][m]['pooled'], s)} | {civ(H['hit'][m]['pooled'], s)} |")
        w("\nBy origin (top-minus-bottom fifth, points / hit rate):\n")
        Ts = H["test_origins"]
        w("| Method | " + " | ".join(map(str, Ts)) + " |")
        w("|---|" + "---|" * len(Ts))
        for m in H["spread"]:
            w(f"| {NAMES.get(m, m)} | " + " | ".join(f"{p(H['spread'][m]['by_origin'][str(T)]['mean'])} / {s(H['hit'][m]['by_origin'][str(T)]['mean'], 2)}" for T in Ts) + " |")
        w("\nPaired differences (points, 90% interval):\n")
        w("| Comparison | Pooled | " + " | ".join(map(str, Ts)) + " |")
        w("|---|---|" + "---|" * len(Ts))
        for k, v in H["paired_spread"].items():
            w(f"| {k.replace('_minus_', ' minus ')} | {civ(v['pooled'])} | " + " | ".join(p(v["by_origin"][str(T)]["mean"]) for T in Ts) + " |")
        w("\nBaselines at every origin (no fitting needed; top-minus-bottom fifth, points):\n")
        Ta = list(H["spread_baselines_all_origins"]["cheapest"]["by_origin"])
        w("| Baseline | " + " | ".join(Ta) + " |")
        w("|---|" + "---|" * len(Ta))
        for m, v in H["spread_baselines_all_origins"].items():
            w(f"| {NAMES[m]} | " + " | ".join(p(v["by_origin"][T]["mean"]) for T in Ta) + " |")
        c = H["calibration"]
        w(f"\nCalibration of the stated 80% range: ridge {civ(c['ridge']['coverage']['pooled'], s)} of outcomes inside, mean width {c['ridge']['mean_width_points']} points "
          f"(errors from: {'; '.join(c['ridge']['resid_source'])}); no-skill range {civ(c['noskill']['coverage']['pooled'], s)}, width {c['noskill']['mean_width_points']} points. "
          f"By origin (ridge): {', '.join(f'{T}: {s(x['mean'], 2)}' for T, x in c['ridge']['coverage']['by_origin'].items())}.\n")
        rob = H["robustness"]
        w(f"#### Robustness ({h}-year)\n")
        ex = rob["excluding_2020_2022_origins"]
        w(f"- Excluding 2020-2022 origins (origins left: {', '.join(map(str, ex['origins']))}): spread ridge {p(ex['spread']['ridge']['pooled']['mean'])}, cheapest {p(ex['spread']['cheapest']['pooled']['mean'])}, "
          f"trend {p(ex['spread']['trend']['pooled']['mean'])}; ridge minus cheapest {civ(ex['paired_spread']['ridge_minus_cheapest']['pooled'])}, ridge minus trend {civ(ex['paired_spread']['ridge_minus_trend']['pooled'])}.")
        th = rob["thinning"]
        w(f"- FHFA thinning (origins whose window ends by 2021: {', '.join(map(str, th['origins_with_outcome_by_2021']))}): spread on tracts that still have a 2025 value vs all tracts: "
          + "; ".join(f"{NAMES.get(m, m)} {p(th['survivors'][m]['mean'])} vs {p(th['all'][m]['mean'])}" for m in th["all"]) + ".")
        tv = rob["tract_vintage"]
        w(f"- Tract vintage: stable 2010-2020 tracts: ridge {p(tv['stable_2010_2020']['ridge']['mean'])}, cheapest {p(tv['stable_2010_2020']['cheapest']['mean'])}, ridge minus cheapest {civ(tv['stable_2010_2020']['paired_ridge_minus_cheapest'])} "
          f"({tv['stable_2010_2020']['ridge']['cells']} cells); converted tracts: ridge {p(tv['converted']['ridge']['mean'])}, cheapest {p(tv['converted']['cheapest']['mean'])}, ridge minus cheapest {civ(tv['converted']['paired_ridge_minus_cheapest'])} ({tv['converted']['ridge']['cells']} cells).")
        ab = rob["ablation_no_price_level"]
        w(f"- Without the price-level features (value_acs, loan_level, rent_to_value): spread {civ(ab['spread']['pooled'])}; minus cheapest {civ(ab['paired']['cheapest']['pooled'])}; minus trend {civ(ab['paired']['trend']['pooled'])}.")
        mr = rob["metro_relative"]
        w(f"- Metro-relative target ({list(mr['cells'].values())[0]} CBSA cells per origin): ridge + county features {civ(mr['spread']['ridge_metro']['pooled'])}, cheapest {civ(mr['spread']['cheapest']['pooled'])}, "
          f"trend {civ(mr['spread']['trend']['pooled'])}; ridge minus cheapest {civ(mr['paired']['cheapest']['pooled'])}.")
        if "internal_zillow_variant" in rob:
            z = rob["internal_zillow_variant"]
            w(f"- Internal only (Zillow terms unconfirmed; nothing shipped): ridge + Zillow ZIP 1-year change, minus cheapest {civ(z['paired_vs_cheapest'])}.")
        w("")
        w(f"#### Single signals ({h}-year, every origin, no fitting; within-county Spearman, 90% interval; share of origins with the pooled sign)\n")
        w("| Feature | Spearman | Top-minus-bottom fifth, points | Origins | Same sign |")
        w("|---|---|---|---|---|")
        for f, v in sorted(H["single_signals"].items(), key=lambda kv: -abs(kv[1]["spearman"]["pooled"]["mean"] or 0)):
            w(f"| {f} | {civ(v['spearman']['pooled'], s)} | {p(v['spread']['pooled']['mean'])} | {v['origins']} | {s(v['share_origins_same_sign'], 2)} |")
        bf = H["baseline_fifths"]
        w(f"\n#### Realised {h}-year relative change by home-value fifth (cheapest baseline; added after pre-registration, A.10)\n")
        w("| Fifth (1 = cheapest) | p10 | median | p90 | tracts |")
        w("|---|---|---|---|---|")
        for k, q in bf["pooled"].items():
            w(f"| {k} | {q[0]:+.1f} | {q[1]:+.1f} | {q[2]:+.1f} | {q[3]} |")
        w("\nMedian by origin (fifth 1 / fifth 5): " + ", ".join(f"{T}: {v['1'][1]:+.1f} / {v['5'][1]:+.1f}" for T, v in bf["by_origin"].items()) + ".")
        oc = bf["out_of_time_coverage_of_80pct_range"]
        w(f" Out-of-time coverage of the fifth's 80% range (ranges from earlier windows only): {civ(oc['pooled'], s)}.\n")
    H = R["horizons"]["5"]
    w("### B.4 By county (5-year test cells, origins 2019 and 2020)\n")
    w("| County | Cells | Spread ridge | Spread cheapest | Spread trend | Hit ridge | Hit cheapest | Uses model |")
    w("|---|---|---|---|---|---|---|---|")
    for c, v in D["per_county"].items():
        hh = H["by_county_hit"][c]
        w(f"| {names.get(c, c)} | {v['cells']} | {p(v['ridge'])} | {p(v['cheapest'])} | {p(v['trend'])} | {s(hh.get('ridge'), 2)} | {s(hh.get('cheapest'), 2)} | {'yes' if v['uses_model'] else 'no'} |")
    w(f"\n### B.5 Current model (fitted on 5-year origins {cur['train'][0]}-{cur['train'][-1]}, lambda {cur['lambda']}, range from {cur['resid_source']}; not shipped)\n")
    w("| Feature | Weight (log points per full percentile span) |")
    w("|---|---|")
    for f, x in cur["weights"].items():
        w(f"| {f} | {x:+.4f} |")
    print("\n".join(out))


if __name__ == "__main__":
    main()
