#!/usr/bin/env python3
"""Write app/data/neighborhood_prediction.json (and app/data/prediction/<fips>.json for counties where the model passed)
from the walk-forward results (scripts/predict/walkforward.py). Usage:
    python3 scripts/predict/write_outputs.py [--run <dir with results.json and current.json>]
"""
import argparse
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import features as FT  # noqa: E402

OUT = os.path.join(ROOT, "app", "data", "neighborhood_prediction.json")
TRACT_DIR = os.path.join(ROOT, "app", "data", "prediction")

SOURCE = {
    "value_acs": "data/signals/acs_tract_50counties.csv.gz (ACS 5-year, Census bulk files)",
    "loan_level": "data/signals/hmda_*tract_year_50counties.csv.gz (HMDA public data)",
    "trend_1y": "data/signals/fhfa_tract_annual.csv.gz (FHFA tract HPI)", "trend_3y": "data/signals/fhfa_tract_annual.csv.gz", "trend_5y": "data/signals/fhfa_tract_annual.csv.gz",
    "app_growth": "HMDA", "loan_growth": "HMDA", "nonowner_share": "HMDA", "nonowner_change": "HMDA", "denial_rate": "HMDA",
    "buyer_income_ratio": "HMDA and ACS", "permits_place": "data/signals/bps_place_annual.csv.gz (Census Building Permits Survey) and data/predict/tract_jurisdiction_50counties.csv.gz (2020 block assignment files)",
    "jobs_tract": "data/signals/lodes_wac_tract_*.csv.gz (LEHD LODES8)", "jobs_5km": "LODES8 and data/predict/tract_centroids_2020.csv.gz (2020 Gazetteer)",
    "rent_to_value": "ACS", "vacancy": "ACS",
}
WHY = {
    "value_acs": "cheap-for-the-county catch-up", "loan_level": "the same, from this year's buyers", "trend_1y": "short momentum",
    "trend_3y": "medium momentum or reversal", "trend_5y": "long momentum or reversal", "app_growth": "buyers arriving before prices show it",
    "loan_growth": "buyers paying more, ahead of the repeat-sales index", "nonowner_share": "investor and second-home demand",
    "nonowner_change": "investors moving in or out", "denial_rate": "weaker applicant credit, weaker demand",
    "buyer_income_ratio": "richer buyers than residents: neighbourhood change", "permits_place": "supply coming, and builders' bets",
    "jobs_tract": "job growth on the spot", "jobs_5km": "job growth within reach", "rent_to_value": "high yield for the price",
    "vacancy": "emptying or filling up",
}


def pts(x):
    return None if x is None else round(100 * x, 2)


def ci(b):
    return {"mean": pts(b["mean"]), "ci90": [pts(b["ci90"][0]), pts(b["ci90"][1])], "cells": b["cells"], "counties": b["counties"]}


def share(b):
    return {"mean": None if b["mean"] is None else round(b["mean"], 3), "ci90": [None if x is None else round(x, 3) for x in b["ci90"]], "cells": b["cells"], "counties": b["counties"]}


def table(H, metric, conv):
    out = {}
    for m, v in H[metric].items():
        out[m] = {"pooled": conv(v["pooled"]), "by_origin": {T: conv(x) for T, x in v["by_origin"].items()}}
    return out


def drivers(weights, x_row, feats, k=3):
    contrib = sorted(((weights[f] * x, f, x) for f, x in zip(feats, x_row) if weights.get(f)), key=lambda t: -abs(t[0]))
    out = []
    for c, f, x in contrib[:k]:
        pctl = round((x + 0.5) * 100)
        out.append({"feature": f, "contribution_points": round(100 * c, 2),
                    "text": f"{FT.LABEL[f]}: {pctl}th percentile in the county, which {'raises' if c > 0 else 'lowers'} the prediction"})
    return out


def tract_file(fips, cur, q, hit, tested_on):
    d = cur["counties"][fips]
    feats = FT.FEATURES
    order = sorted(range(len(d["tracts"])), key=lambda i: -d["pred"][i])
    rank = {i: r + 1 for r, i in enumerate(order)}
    rows = []
    for i, t in enumerate(d["tracts"]):
        p = d["pred"][i]
        rows.append({"tract": t, "rank_in_county": rank[i], "of": len(d["tracts"]),
                     "relative_5y_range_pct": [round(100 * (math.exp(p + q[0]) - 1), 1), round(100 * (math.exp(p + q[1]) - 1), 1)],
                     "drivers": drivers(cur["weights"], d["X"][i], feats)})
    return {"schema": 1, "county": fips, "origin": cur["origin"], "level": "tract (2020 codes); block groups inherit their tract's prediction",
            "range_meaning": "80% range of the tract's 5-year price change relative to the county's median tract, from the model's own past errors",
            "hit_rate_top_third": hit, "tested_on": tested_on, "tracts": rows}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="/tmp/claude-0/-home-user-city-pretty/3156622b-69a9-5d91-83c1-d393ef77389e/scratchpad/predict/run")
    a = ap.parse_args()
    R = json.load(open(os.path.join(a.run, "results.json")))
    cur = json.load(open(os.path.join(a.run, "current.json")))
    bt = json.load(open(os.path.join(ROOT, "app", "data", "neighborhood_score_backtest.json")))
    names = {p["fips"]: p["name"] for p in bt["per_metro"]}
    H5, H3 = R["horizons"]["5"], R["horizons"]["3"]
    D = R["decision"]
    fhfa_meta = json.load(open(os.path.join(ROOT, "data", "signals", "fhfa_meta.json")))
    lodes_cov = json.load(open(os.path.join(ROOT, "data", "signals", "lodes_coverage.json")))
    geo_meta = json.load(open(os.path.join(ROOT, "data", "predict", "geo_meta.json")))

    s5, h5 = H5["spread"], H5["hit"]
    p5 = H5["paired_spread"]
    rob5 = H5["robustness"]
    tested_on = (f"tested on {D['paired_vs_cheapest']['counties']} counties, 5-year windows starting {H5['test_origins'][0]} and {H5['test_origins'][-1]} "
                 f"(fitted only on earlier, non-overlapping windows); 3-year windows starting {H3['test_origins'][0]}-{H3['test_origins'][-1]}")
    ff = H5["baseline_fifths"]
    p1 = lambda x: None if x is None else f"{100 * x:+.1f}".replace("+", "") if x >= 0 else f"{100 * x:.1f}"
    headline = [
        f"The leading-signal model did not beat the plain 'cheapest tracts' screen: over the next 5 years its top fifth of tracts beat its bottom fifth by "
        f"{p1(s5['ridge']['pooled']['mean'])} points (90% {p1(s5['ridge']['pooled']['ci90'][0])} to {p1(s5['ridge']['pooled']['ci90'][1])}), against "
        f"{p1(s5['cheapest']['pooled']['mean'])} for the cheapest-tracts screen; the difference, {p1(p5['ridge_minus_cheapest']['pooled']['mean'])} points "
        f"(90% {p1(p5['ridge_minus_cheapest']['pooled']['ci90'][0])} to {p1(p5['ridge_minus_cheapest']['pooled']['ci90'][1])}), is not distinguishable from zero.",
        f"It did beat the prior-trend baseline, by {p1(p5['ridge_minus_trend']['pooled']['mean'])} points (90% {p1(p5['ridge_minus_trend']['pooled']['ci90'][0])} to {p1(p5['ridge_minus_trend']['pooled']['ci90'][1])}).",
        f"Without the price-level inputs the model's spread falls to {p1(s5['ridge_noprice']['pooled']['mean'])} points: most of the edge is cheap tracts catching up.",
        f"The cheapest fifth's median 5-year gain over its county's median tract shrank from {ff['by_origin']['2015']['1'][1]:.1f} points (windows starting 2015) to "
        f"{ff['by_origin']['2020']['1'][1]:.1f} (starting 2020).",
        "So every county keeps the relative-value screen, now with its tested ranges and hit rate.",
    ]
    counties = {}
    for c, v in D["per_county"].items():
        bf = ff["by_county"].get(c, {})
        counties[c] = {
            "name": names.get(c), "applies": "model" if v["uses_model"] else "baseline",
            "why": ("passed both parts of the decision rule" if v["uses_model"] else
                    ("the model failed the overall test, so no county uses it" if not D["overall_pass"] else "the model did worse than a baseline in this county's own test cells")),
            "test_cells": v["cells"],
            "spread_points_5y": {"model": pts(v["ridge"]), "cheapest": pts(v["cheapest"]), "prior_trend": pts(v["trend"])},
            "hit_rate_top_third_5y": {m: (None if H5["by_county_hit"][c].get(m) is None else round(H5["by_county_hit"][c][m], 3)) for m in ("ridge", "cheapest", "trend")},
            "spearman_5y": {m: (None if H5["by_county_rho"][c].get(m) is None else round(H5["by_county_rho"][c][m], 3)) for m in ("ridge", "cheapest", "trend")},
            "baseline_fifth_ranges_5y": bf,
        }
    for c in bt["sample"]["county_list"]:
        counties.setdefault(c, {"name": names.get(c), "applies": "baseline", "why": "fewer than 20 tracts with a price index at both ends of a test window", "test_cells": 0})

    out = {
        "schema": 1,
        "title": "Neighborhood price prediction: walk-forward test of leading signals against simple baselines",
        "generated_by": "scripts/predict/walkforward.py and scripts/predict/write_outputs.py",
        "generated": R["generated"],
        "method_doc": "docs/PREDICTION-MODEL.md (method fixed and committed before any evaluation)",
        "question": "Within a county, which tracts will see more house-price growth than the county's median tract over the next 5 (and 3) years?",
        "decision": {
            "rule": "The model is used for a county only if, pooled over test windows, its top-minus-bottom-fifth spread beats both the cheapest-tracts and the prior-trend baselines with 90% county-bootstrap intervals above zero, and in that county's own test cells it is not below either baseline.",
            "overall_pass": D["overall_pass"], "counties_using_model": D["counties_using_model"],
            "paired_spread_points_vs_cheapest": ci(D["paired_vs_cheapest"]), "paired_spread_points_vs_prior_trend": ci(D["paired_vs_trend"]),
            "what_ships": "the relative-value screen (cheap for its county) in every county, with its tested 5-year ranges by home-value fifth and its hit rate" if not D["overall_pass"] else "the model where it passed, the screen elsewhere",
        },
        "headline": headline,
        "tested_on": tested_on,
        "units": "points = 100 x log change relative to the county's median tract (close to percentage points for these sizes); hit rate = share of the tracts called 'top third' that ended in the county's top third (no skill = 0.333)",
        "results_5y": {
            "test_origins": H5["test_origins"], "cells_per_origin": H5["cells_per_origin"], "tracts_per_origin": H5["tracts_per_origin"],
            "spread_points": table(H5, "spread", ci), "spearman": table(H5, "rho", share), "hit_rate_top_third": table(H5, "hit", share),
            "paired_spread_points": {k: ci(v["pooled"]) for k, v in p5.items()},
            "paired_spread_points_by_origin": {k: {T: ci(x) for T, x in v["by_origin"].items()} for k, v in p5.items()},
            "paired_hit_rate": {k: share(v["pooled"]) for k, v in H5["paired_hit"].items()},
            "baselines_all_origins_spread_points": {m: {T: pts(x["mean"]) for T, x in v["by_origin"].items()} for m, v in H5["spread_baselines_all_origins"].items()},
            "calibration_80pct_range": {"model": {"coverage": share(H5["calibration"]["ridge"]["coverage"]["pooled"]), "by_origin": {T: share(x) for T, x in H5["calibration"]["ridge"]["coverage"]["by_origin"].items()}, "mean_width_points": H5["calibration"]["ridge"]["mean_width_points"], "errors_from": H5["calibration"]["ridge"]["resid_source"]},
                                        "no_skill": {"coverage": share(H5["calibration"]["noskill"]["coverage"]["pooled"]), "mean_width_points": H5["calibration"]["noskill"]["mean_width_points"]}},
            "baseline_fifth_ranges": {"pooled": ff["pooled"], "by_origin": ff["by_origin"], "note": ff["note"] + "; fifth 1 = cheapest fifth by Census home value; added after the pre-registration (doc A.10)",
                                      "out_of_time_coverage_of_80pct_range": share(ff["out_of_time_coverage_of_80pct_range"]["pooled"])},
            "robustness": {
                "excluding_2020_2022_origins": {"origins": rob5["excluding_2020_2022_origins"]["origins"], "spread_points": {m: ci(v["pooled"]) for m, v in rob5["excluding_2020_2022_origins"]["spread"].items()},
                                                "paired_spread_points": {k: ci(v["pooled"]) for k, v in rob5["excluding_2020_2022_origins"]["paired_spread"].items()}},
                "fhfa_thinning": {"origins": rob5["thinning"]["origins_with_outcome_by_2021"], "survivors": {m: ci(v) for m, v in rob5["thinning"]["survivors"].items()}, "all": {m: ci(v) for m, v in rob5["thinning"]["all"].items()}},
                "tract_vintage": {k: {m: (ci(x) if x else None) for m, x in v.items()} for k, v in rob5["tract_vintage"].items()},
                "metro_relative": {"cells_per_origin": rob5["metro_relative"]["cells"], "spread_points": {m: ci(v["pooled"]) for m, v in rob5["metro_relative"]["spread"].items()},
                                   "paired_spread_points": {k: ci(v["pooled"]) for k, v in rob5["metro_relative"]["paired"].items()}},
            },
            "single_signals": {f: {"spearman": share(v["spearman"]["pooled"]), "spread_points": ci(v["spread"]["pooled"]), "origins": v["origins"], "share_origins_same_sign": v["share_origins_same_sign"]} for f, v in H5["single_signals"].items()},
            "model_weights_last_origin": H5["ridge_weights_last_origin"],
        },
        "results_3y": {
            "test_origins": H3["test_origins"],
            "spread_points": table(H3, "spread", ci), "spearman": table(H3, "rho", share), "hit_rate_top_third": table(H3, "hit", share),
            "paired_spread_points": {k: ci(v["pooled"]) for k, v in H3["paired_spread"].items()},
            "calibration_80pct_range": {"model": share(H3["calibration"]["ridge"]["coverage"]["pooled"]), "no_skill": share(H3["calibration"]["noskill"]["coverage"]["pooled"])},
            "excluding_2020_2022_origins": {k: ci(v["pooled"]) for k, v in H3["robustness"]["excluding_2020_2022_origins"]["paired_spread"].items()},
        },
        "features": [{"feature": f, "label": FT.LABEL[f], "as_of_rule": FT.ASOF_RULE[f], "source": SOURCE[f], "why_it_should_lead": WHY[f], "price_level": f in FT.PRICE_LEVEL} for f in FT.FEATURES],
        "metro_variant_county_features": [{"feature": f, "as_of_rule": FT.ASOF_RULE[f]} for f in FT.COUNTY_FEATURES],
        "data_vintages": {
            "fhfa": {"retrieved": fhfa_meta["retrieved"], "note": fhfa_meta["zip5_note"], "years": fhfa_meta["tract_years"], "revised": "one current vintage; every year re-estimated on each release"},
            "hmda": "home-purchase applications 2012-2025 (2012-2021 on 2010 tract codes, moved to 2020 tracts by land area)",
            "lodes": {"years": "2010-2024", "not_published": lodes_cov["not_found"], "note": "2010-2021 re-created in 2023"},
            "acs": "5-year 2010-2014 and 2015-2019 (the newest vintages on file; 2020-2024 is published but not in data/signals)",
            "bps": "annual place and county files 2010-2025", "irs_migration": "pairs 2011-12 to 2023-24",
            "geography": [{"url": s["url"], "last_modified": s.get("last_modified")} for s in geo_meta["sources"][:3]] + [{"block_assignment_files": len(geo_meta["sources"]) - 3, "retrieved": geo_meta["retrieved"]}],
            "details": "docs/audit/prediction-signals-2026-11-22.md",
        },
        "counties": counties,
        "tract_files": [],
        "caveats": [
            "Relative to the county: a county-wide rise or fall is not predicted.",
            "FHFA's tract index is re-estimated every release, so the past values used here are today's revised figures, not what was known then; the same holds for LODES 2010-2021.",
            "Only two 5-year test windows (starting 2019 and 2020) could be scored without overlapping the fitting windows; both contain the 2020-2022 boom.",
            "After 2020 FHFA publishes fewer tracts (thin sales), so recent outcomes rest on the better-traded tracts.",
            f"The cheap-tracts edge shrank in recent windows: its 3-year top-minus-bottom spread was {pts(H3['spread']['cheapest']['by_origin']['2017']['mean'])} points for windows starting 2017 and {pts(H3['spread']['cheapest']['by_origin']['2022']['mean'])} for windows starting 2022; past catch-up may not repeat.",
            "Tested on tracts; block groups get their tract's figures, labelled as tract-level.",
            f"The stated 80% ranges were too narrow in the test: the model's held {round(100 * H5['calibration']['ridge']['coverage']['pooled']['mean'])}% of 5-year outcomes and the screen's fifth ranges {round(100 * ff['out_of_time_coverage_of_80pct_range']['pooled']['mean'])}%, so outcomes spread wider than the range says.",
            "Nothing here covers rents, cash flow or a price fall across the whole county.",
        ],
    }
    if D["overall_pass"]:
        os.makedirs(TRACT_DIR, exist_ok=True)
        for c, v in counties.items():
            if v["applies"] == "model" and c in cur["counties"]:
                tf = tract_file(c, cur, cur["q"], v["hit_rate_top_third_5y"]["ridge"], tested_on)
                path = os.path.join(TRACT_DIR, f"{c}.json")
                json.dump(tf, open(path, "w"), separators=(",", ":"))
                out["tract_files"].append(f"app/data/prediction/{c}.json")
    s = json.dumps(out, indent=1)
    assert len(s) < 15e6
    open(OUT, "w").write(s + "\n")
    print(OUT, len(s), "bytes;", "overall pass" if D["overall_pass"] else "model failed overall: baseline everywhere")


if __name__ == "__main__":
    main()
