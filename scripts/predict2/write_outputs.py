#!/usr/bin/env python3
"""Store the hold-out test output and the small summary the page reads.

  data/backtests/prediction_holdout_2026-11-23.json   the full results.json of scripts/predict2/holdout.py (every table)
  app/data/neighborhood_prediction_holdout.json       hold-out numbers per method and horizon, the decision, dates, limits

Usage: python3 scripts/predict2/write_outputs.py [--run DIR]
"""
import argparse
import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FULL = "data/backtests/prediction_holdout_2026-11-23.json"
SUMMARY = "app/data/neighborhood_prediction_holdout.json"
LABEL = {"ridge_all": "Model: ridge regression, all four signal families", "ridge_trend_level": "Model: ridge, price trend and price level only",
         "gbm_all": "Model: shallow boosted trees, all families", "no_change": "Baseline: no change (the average tract)",
         "metro_average": "Baseline: metro average (metro's last 5-year trend)", "momentum": "Baseline: momentum (tract's own last-period change)",
         "cheapest_in_metro": "Baseline: cheapest tracts in their metro", "cheapest_dollars": "Baseline: cheapest tracts in dollars"}
ORDER = ["ridge_all", "ridge_trend_level", "gbm_all", "no_change", "metro_average", "momentum", "cheapest_in_metro", "cheapest_dollars"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="/tmp/claude-0/-home-user-city-pretty/3156622b-69a9-5d91-83c1-d393ef77389e/scratchpad/pred1123/run")
    a = ap.parse_args()
    src = os.path.join(a.run, "results.json")
    shutil.copyfile(src, os.path.join(ROOT, FULL))
    R = json.load(open(src))
    res = {}
    for h in ("5", "3"):
        H = R["results"][h]["holdout"]
        res[h] = {"test_origins": R["results"][h]["tests"], "metros": H["metros"], "tracts_per_origin": H["tracts_per_origin"],
                  "methods": [{"key": k, "label": LABEL[k], "kind": "model" if k in ("ridge_all", "ridge_trend_level", "gbm_all") else "baseline",
                               "top_decile": H["methods"][k]["top_decile"], "top_decile_ci95": H["methods"][k]["top_decile_ci95"],
                               "excess_over_all": H["methods"][k]["excess_over_all"], "spearman": H["methods"][k]["spearman"],
                               "spearman_ci95": H["methods"][k]["spearman_ci95"]} for k in ORDER if k in H["methods"]],
                  "paired_primary": {b: H["paired"][f"ridge_all|{b}"] for b in ("no_change", "metro_average", "momentum", "cheapest_in_metro", "cheapest_dollars")}}
    passed = R["decision"]["pass"]
    out = {
        "_source": {"generated_by": "scripts/predict2/holdout.py then scripts/predict2/write_outputs.py", "run": R["run"],
                    "protocol": "docs/audit/prediction-2026-11-23.md (Part A, committed before the first evaluation)"},
        "backtest_file": FULL,
        "tested": {
            "question": "Of all neighbourhoods (Census tracts) in metros the model never saw, which rise most in price over the next 3 or 5 years? "
                        f"{len(R['metros']['holdout'])} of {R['metros']['all']} metros were held out by a fixed rule ({R['results']['5']['holdout']['metros']} of them had "
                        "tracts with the data needed); the model learned only from the others, "
                        "and only from years before each test window. It was compared with five simple baselines on the 10% of tracts each picked.",
            "table_caption": "Hold-out metros only. Points = 100 x log change in the FHFA tract price index over the window, average over the test windows "
                             "(5 years: starting 2017-2020; 3 years: starting 2015-2022). Intervals: 2,000 resamples of hold-out metros.",
            "data_dates": "Price index: FHFA tract file, years to 2025. Census ACS 5-year 2006-10, 2010-14, 2015-19. Building permits: Census county files 2010-2025. "
                          "Jobs: LEHD LODES8 2010-2024. Retrieved 22-23 Nov 2026.",
        },
        "decision": {"pass": passed, "rule": "Shown only if, for both 3 and 5 years on hold-out metros, the model's top-10% return beats each of the five "
                                             "baselines with a 95% interval above zero and its rank correlation is higher than each baseline's.",
                     "failed_conditions": R["decision"]["failed_conditions"]},
        "headline_fail": "Tested on metros it never saw, the model did not beat every simple baseline, so this page shows no price forecast. "
                         "The trends under each area are facts about the past, not a forecast.",
        "headline_pass": "On metros it never saw, the model's top 10% of tracts rose more than every simple baseline's, over 3 and 5 years.",
        "results": res,
        "limits": [
            "The FHFA price history is one revised release (2026); early years are not what was known then.",
            "Only 4 five-year and 8 three-year test windows, overlapping, and 2020-2022 was unusual; the metro resampling does not cover that.",
            "Prices are FHFA's tract index. FHFA publishes no value for some tracts, and fewer tracts after 2021 (62,743 in 2021, 46,719 in 2025 in the file used).",
            "Census values are moved from 2010 to 2020 tract lines by land area; Connecticut drops out (its new county codes do not join).",
            "Nothing here covers rents, costs or cash flow.",
        ],
    }
    json.dump(out, open(os.path.join(ROOT, SUMMARY), "w"), indent=1)
    print(SUMMARY, os.path.getsize(os.path.join(ROOT, SUMMARY)), "bytes;", FULL, os.path.getsize(os.path.join(ROOT, FULL)), "bytes; pass =", passed)


if __name__ == "__main__":
    main()
