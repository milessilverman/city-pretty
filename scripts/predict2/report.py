#!/usr/bin/env python3
"""Markdown tables for docs/audit/prediction-2026-11-23.md from data/backtests/prediction_holdout_2026-11-23.json.
Usage: python3 scripts/predict2/report.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
R = json.load(open(os.path.join(ROOT, "data", "backtests", "prediction_holdout_2026-11-23.json")))
ORDER = ["ridge_all", "ridge_trend_level", "gbm_all", "no_change", "metro_average", "momentum", "cheapest_in_metro", "cheapest_dollars"]
BASE = ["no_change", "metro_average", "momentum", "cheapest_in_metro", "cheapest_dollars"]


def f1(x):
    return f"{x:+.1f}" if x is not None else "-"


for h in ("5", "3"):
    r = R["results"][h]
    print(f"\n### {h}-year horizon (test windows starting {r['tests'][0]}-{r['tests'][-1]})\n")
    for scope, lab in (("holdout", "**Hold-out metros**"), ("seen", "Seen metros, later years (out of time only)")):
        H = r[scope]
        print(f"{lab}: {H['metros']} metros; tracts per test origin: " + ", ".join(f"{T}: {n:,}" for T, n in H["tracts_per_origin"].items()) + "\n")
        print("| Method | Top-decile change, points (95% interval) | Excess over the average tract | Spearman (95% interval) |")
        print("|---|---|---|---|")
        for k in ORDER:
            m = H["methods"].get(k)
            if m:
                print(f"| {k} | {m['top_decile']:.1f} ({m['top_decile_ci95'][0]:.1f} to {m['top_decile_ci95'][1]:.1f}) | {f1(m['excess_over_all'])} | "
                      f"{m['spearman']:.3f} ({m['spearman_ci95'][0]:.3f} to {m['spearman_ci95'][1]:.3f}) |")
        print()
        if scope == "holdout":
            print("Paired differences, hold-out (model minus baseline; top-decile points, 95% interval; test origins won; Spearman difference):\n")
            print("| Model | " + " | ".join(BASE) + " |")
            print("|---|" + "---|" * len(BASE))
            for mdl in ("ridge_all", "ridge_trend_level", "gbm_all"):
                cells = []
                for b in BASE:
                    p = H["paired"][f"{mdl}|{b}"]
                    cells.append(f"{f1(p['top_decile_diff'])} ({f1(p['top_decile_diff_ci95'][0])} to {f1(p['top_decile_diff_ci95'][1])}); "
                                 f"{p['origins_won']}/{p['origins']}; rho {p['spearman_diff']:+.3f}")
                print(f"| {mdl} | " + " | ".join(cells) + " |")
            print()
            print("By test origin, hold-out (top-decile change, points; the last column is the average hold-out tract):\n")
            print("| Origin | " + " | ".join(ORDER) + " | average tract |")
            print("|---|" + "---|" * (len(ORDER) + 1))
            for T, row in H["by_origin"].items():
                print(f"| {T} | " + " | ".join(f"{row[k]['top_decile']:.1f}" for k in ORDER if k in row) + f" | {row['_all_mean']:.1f} |")
            print()
    print("Baselines at every origin, hold-out metros (top-decile change, points; no fitting):\n")
    print("| Origin | tracts | average tract | " + " | ".join(BASE[1:]) + " |")
    print("|---|---|---|" + "---|" * (len(BASE) - 1))
    for T, row in r["baselines_every_origin"].items():
        print(f"| {T} | {row['n']:,} | {row['all_mean']:.1f} | " + " | ".join(f"{row[b]:.1f}" for b in BASE[1:]) + " |")
    print("\nRidge lambda chosen per test origin (all families / trend+level): " +
          ", ".join(f"{T}: {v['ridge_all']['lambda']} / {v['ridge_trend_level']['lambda']}" for T, v in r["lambda"].items()))
print("\nDecision:", "PASS" if R["decision"]["pass"] else "FAIL")
for w in R["decision"]["failed_conditions"]:
    print("-", w)
