#!/usr/bin/env python3
"""Walk-forward test of the pre-registered models (docs/PREDICTION-MODEL.md Part A). numpy only.

Usage: python3 scripts/predict/walkforward.py [--out <dir>] [--draws 2000] [--no-zillow]
Writes <out>/results.json (every table) and <out>/current.json (origin-2026 predictions, all models' inputs).
Default <out>: $PREDICT_SCRATCH or the session scratch folder 'predict/run'. Nothing here reads data after T for a feature
(features.features_at goes through asof.Guard); the outcome is read only by features.targets.
"""
import argparse
import collections
import json
import math
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import features as FT  # noqa: E402
import model as M  # noqa: E402

ORIGINS = {5: list(range(2014, 2021)), 3: list(range(2014, 2023))}
LAST_OUTCOME_YEAR = 2025
CURRENT_T = 2026
MIN_TRACTS = 20
LAMBDAS = [0.001, 0.01, 0.1, 1.0]
DEFAULT_LAMBDA = 0.01
TREES = [50, 150, 300]
DEFAULT_TREES = 150
BOOM = {2020, 2021, 2022}


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, file=sys.stderr, flush=True)


# ---------------------------------------------------------------- cells
def make_cells(F, Y, T, feats, group="county", target="y", geo=None):
    """One cell per county (or CBSA) at origin T: tracts with an outcome, features ranked within the cell."""
    groups = collections.defaultdict(list)
    for t, yy in Y.items():
        if yy.get(target) is None:
            continue
        key = t[:5] if group == "county" else geo["cbsa"].get(t[:5])
        if key:
            groups[key].append(t)
    cells = []
    for key, ts in sorted(groups.items()):
        if len(ts) < MIN_TRACTS:
            continue
        ts.sort()
        raw = np.array([[np.nan if F[t].get(f) is None else F[t][f] for f in feats] for t in ts], dtype=float)
        X = np.column_stack([M.centred_ranks(raw[:, j]) for j in range(len(feats))])
        y = np.array([Y[t][target] for t in ts])
        cells.append({"T": T, "key": key, "county": ts[0][:5] if group == "county" else key, "tracts": ts, "raw": raw, "X": X, "y": y,
                      "stable": np.array([t in geo["stable"] for t in ts]), "survivor": np.array([t in geo["survivors"] for t in ts])})
    return cells


def winsor(y):
    lo, hi = np.quantile(y, [0.01, 0.99])
    return np.clip(y, lo, hi)


def stack(cells, cols=None):
    X = np.vstack([c["X"] if cols is None else c["X"][:, cols] for c in cells])
    y = np.concatenate([winsor(c["y"]) for c in cells])
    return X, y


# ---------------------------------------------------------------- learners
def learner(kind, cols=None):
    def fit(cells, hp):
        X, y = stack(cells, cols)
        if kind == "ridge":
            return {"w": M.ridge_fit(X, y - y.mean(), hp), "b": float(y.mean())}
        return M.gbm_fit(X, y, hp)

    def predict(m, cell):
        X = cell["X"] if cols is None else cell["X"][:, cols]
        if kind == "ridge":
            return X @ m["w"] + 0.0  # county-relative: the cell's centre is 0 by construction
        return M.gbm_predict(m, X) - m["base"]
    return fit, predict, (LAMBDAS if kind == "ridge" else TREES), (DEFAULT_LAMBDA if kind == "ridge" else DEFAULT_TREES)


def walk(cells_by_T, h, kind, cols=None, test_origins=None):
    """For each test origin T: train on origins S with S + h <= T (nested choice of the hyper-parameter), predict T."""
    fit, predict, grid, default = learner(kind, cols)
    origins = sorted(cells_by_T)
    out = {}
    for T in (test_origins or origins):
        train = [S for S in origins if S + h <= T]
        if not train:
            continue
        inner = [V for V in train if any(S + h <= V for S in train)]
        hp, inner_resid, hp_scores = default, None, {}
        if inner:
            for cand in grid:
                rhos, res = [], []
                for V in inner:
                    m = fit([c for S in train if S + h <= V for c in cells_by_T[S]], cand)
                    for c in cells_by_T[V]:
                        p = predict(m, c)
                        r = M.spearman(p, c["y"])
                        if r is not None:
                            rhos.append(r)
                        res.append(c["y"] - p)
                hp_scores[cand] = float(np.mean(rhos)) if rhos else -1
            hp = max(hp_scores, key=hp_scores.get)
            res = []
            for V in inner:
                m = fit([c for S in train if S + h <= V for c in cells_by_T[S]], hp)
                for c in cells_by_T[V]:
                    res.append(c["y"] - predict(m, c))
            inner_resid = np.concatenate(res)
        m = fit([c for S in train for c in cells_by_T[S]], hp)
        if inner_resid is None:
            inner_resid = np.concatenate([c["y"] - predict(m, c) for S in train for c in cells_by_T[S]])
            resid_source = "training fit's own errors (no inner walk-forward fold)"
        else:
            resid_source = "inner walk-forward errors inside the training window"
        q10, q90 = np.quantile(inner_resid, [0.10, 0.90])
        ytrain = np.concatenate([c["y"] for S in train for c in cells_by_T[S]])
        nq10, nq90 = np.quantile(ytrain, [0.10, 0.90])
        if T in cells_by_T:
            out[T] = {"train": train, "hp": hp, "hp_scores": hp_scores, "resid_source": resid_source, "q": [float(q10), float(q90)],
                      "noskill_q": [float(nq10), float(nq90)], "model": m, "cells": cells_by_T[T],
                      "preds": [predict(m, c) for c in cells_by_T[T]]}
    return out


# ---------------------------------------------------------------- metrics
def cell_metrics(pred, y, idx=None):
    if idx is not None:
        pred, y = pred[idx], y[idx]
    if len(y) < MIN_TRACTS:
        return None
    return {"rho": M.spearman(pred, y), "spread": M.quintile_spread(pred, y), "hit": M.top_third_hit(pred, y), "n": int(len(y))}


def summarise(rows, metric, by=None):
    """rows: list of dicts with 'county', 'T' and metric values. Pooled + by origin, county-bootstrap intervals."""
    def agg(rs):
        b = M.county_bootstrap([r.get(metric) for r in rs], [r["county"] for r in rs], draws=DRAWS)
        return {k: (None if v is None else (round(v, 4) if isinstance(v, float) else v)) for k, v in b.items()} | {"ci90": [None if x is None else round(x, 4) for x in b["ci90"]]}
    out = {"pooled": agg(rows)}
    out["by_origin"] = {str(T): agg([r for r in rows if r["T"] == T]) for T in sorted({r["T"] for r in rows})}
    return out


def method_preds(cells_by_T, feats, wf):
    """Per test cell: predictions of every method. wf: {name: walk() result}."""
    fi = {f: j for j, f in enumerate(feats)}
    out = collections.defaultdict(dict)
    for T, cells in cells_by_T.items():
        for i, c in enumerate(cells):
            X = c["X"]
            cheap_col = fi["value_acs"] if not np.all(np.isnan(c["raw"][:, fi["value_acs"]])) else fi["loan_level"]
            d = {"noskill": np.zeros(len(c["y"])), "cheapest": -X[:, cheap_col], "trend": X[:, fi["trend_5y"]]}
            for name, res in wf.items():
                if T in res:
                    d[name] = res[T]["preds"][i]
            out[T][i] = d
    return out


def evaluate(cells_by_T, preds, methods, subset=None, only_T=None):
    """Per-cell metric rows for each method. subset: function(cell) -> boolean index or None."""
    rows = collections.defaultdict(list)
    for T, cells in cells_by_T.items():
        if only_T is not None and T not in only_T:
            continue
        for i, c in enumerate(cells):
            P = preds[T][i]
            if not all(m in P for m in methods):
                continue
            idx = subset(c) if subset else None
            for m in methods:
                if m == "noskill":
                    n = int(len(c["y"]) if idx is None else idx.sum())
                    mt = {"rho": 0.0, "spread": 0.0, "hit": 1 / 3, "n": n} if n >= MIN_TRACTS else None
                else:
                    mt = cell_metrics(P[m], c["y"], idx)
                if mt:
                    rows[m].append(dict(mt, T=T, county=c["county"]))
    return rows


def compare(rows, methods, metric="spread"):
    out = {}
    for m in methods:
        out[m] = summarise(rows[m], metric)
    return out


def paired(rows, a, b, metric="spread"):
    ka = {(r["T"], r["county"]): r[metric] for r in rows[a] if r.get(metric) is not None}
    kb = {(r["T"], r["county"]): r[metric] for r in rows[b] if r.get(metric) is not None}
    common = sorted(set(ka) & set(kb))
    d = [{"T": k[0], "county": k[1], "diff": ka[k] - kb[k]} for k in common]
    return summarise(d, "diff")


def per_county(rows, methods, metric="spread"):
    out = {}
    for c in sorted({r["county"] for r in rows[methods[0]]}):
        out[c] = {}
        for m in methods:
            v = [r[metric] for r in rows[m] if r["county"] == c and r.get(metric) is not None]
            out[c][m] = round(float(np.mean(v)), 4) if v else None
        out[c]["cells"] = len([r for r in rows[methods[0]] if r["county"] == c])
    return out


def interval_coverage(cells_by_T, wf_res, which="model"):
    rows = []
    for T, res in wf_res.items():
        for i, c in enumerate(cells_by_T[T]):
            if which == "model":
                lo, hi = res["preds"][i] + res["q"][0], res["preds"][i] + res["q"][1]
            else:
                lo, hi = np.full(len(c["y"]), res["noskill_q"][0]), np.full(len(c["y"]), res["noskill_q"][1])
            rows.append({"T": T, "county": c["county"], "coverage": M.coverage(lo, hi, c["y"]), "width": float(np.mean(hi - lo))})
    return {"coverage": summarise(rows, "coverage"), "mean_width_points": round(100 * float(np.mean([r["width"] for r in rows])), 2) if rows else None,
            "resid_source": sorted({r["resid_source"] for r in wf_res.values()})}


def single_signals(cells_by_T, feats):
    out = {}
    for j, f in enumerate(feats):
        rows = []
        for T, cells in cells_by_T.items():
            for c in cells:
                if np.all(np.isnan(c["raw"][:, j])):
                    continue
                r = M.spearman(c["X"][:, j], c["y"])
                s = M.quintile_spread(c["X"][:, j], c["y"])
                rows.append({"T": T, "county": c["county"], "rho": r, "spread": s})
        s = summarise(rows, "rho")
        sp = summarise(rows, "spread")
        signs = [np.sign(v["mean"]) for v in s["by_origin"].values() if v["mean"] is not None]
        main = np.sign(s["pooled"]["mean"]) if s["pooled"]["mean"] is not None else 0
        out[f] = {"spearman": s, "spread": sp, "origins": len(signs),
                  "share_origins_same_sign": round(float(np.mean([x == main for x in signs])), 3) if signs else None}
    return out


def baseline_fifths(cells_by_T, feats, h):
    """Added after the pre-registration (doc A.10): realised relative change by the cheapest baseline's fifth.
    Fifth 1 = cheapest fifth of the cell's tracts by home value (loan amount where no ACS vintage is published).
    Returns 10th/50th/90th percentiles pooled over origins and counties, by origin, by county, and an out-of-time
    coverage test (ranges from origins S <= T - h applied at T)."""
    fi = {f: j for j, f in enumerate(feats)}
    recs = []  # (T, county, fifth, y)
    for T, cells in cells_by_T.items():
        for c in cells:
            col = fi["value_acs"] if not np.all(np.isnan(c["raw"][:, fi["value_acs"]])) else fi["loan_level"]
            ok = ~np.isnan(c["raw"][:, col])
            r = M.rank01(np.where(ok, c["raw"][:, col], np.nan))
            fifth = np.minimum(5, np.floor(r * 5).astype(int) + 1)
            for k, y, o in zip(fifth, c["y"], ok):
                if o:
                    recs.append((T, c["county"], int(k), float(y)))
    def q(ys):
        return None if len(ys) < 30 else [round(100 * float(x), 2) for x in np.quantile(ys, [0.1, 0.5, 0.9])] + [len(ys)]
    out = {"note": "points = 100 x log change vs the county median tract; [p10, median, p90, tracts]",
           "pooled": {str(k): q([y for T, c, f, y in recs if f == k]) for k in range(1, 6)},
           "by_origin": {str(T): {str(k): q([y for t, c, f, y in recs if t == T and f == k]) for k in range(1, 6)} for T in sorted(cells_by_T)},
           "by_county": {}}
    for cty in sorted({r[1] for r in recs}):
        out["by_county"][cty] = {str(k): q([y for T, c, f, y in recs if c == cty and f == k]) for k in range(1, 6)}
    cov = []
    for T in sorted(cells_by_T):
        past = [r for r in recs if r[0] + h <= T]
        if not past:
            continue
        rng = {k: np.quantile([y for _, _, f, y in past if f == k], [0.1, 0.9]) for k in range(1, 6)}
        for cty in sorted({r[1] for r in recs if r[0] == T}):
            ys = [(f, y) for t, c, f, y in recs if t == T and c == cty]
            cov.append({"T": T, "county": cty, "coverage": float(np.mean([rng[f][0] <= y <= rng[f][1] for f, y in ys]))})
    out["out_of_time_coverage_of_80pct_range"] = summarise(cov, "coverage") if cov else None
    return out


def r4(x):
    return None if x is None else round(float(x), 4)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.environ.get("PREDICT_SCRATCH_RUN", "/tmp/claude-0/-home-user-city-pretty/3156622b-69a9-5d91-83c1-d393ef77389e/scratchpad/predict/run"))
    ap.add_argument("--draws", type=int, default=2000)
    ap.add_argument("--no-zillow", action="store_true")
    ap.add_argument("--skip-gbm", action="store_true")
    a = ap.parse_args()
    global DRAWS
    DRAWS = a.draws
    os.makedirs(a.out, exist_ok=True)
    zillow_ok = (not a.no_zillow) and os.path.exists(os.path.join(FT.ROOT, "data", "signals", "zillow_zhvi_zip_monthly_50counties.csv.gz"))
    log("loading store, zillow:", zillow_ok)
    store = FT.load_store(with_zillow=zillow_ok)
    geo = store["_geo"]
    geo["survivors"] = set(store["fhfa"].get(LAST_OUTCOME_YEAR, {}))
    feats = FT.FEATURES
    allT = sorted(set(ORIGINS[3]) | set(ORIGINS[5]) | {CURRENT_T})
    F = {T: FT.features_at(store, T) for T in allT}
    log("features built")
    noprice = [j for j, f in enumerate(feats) if f not in FT.PRICE_LEVEL]
    R = {"generated": time.strftime("%Y-%m-%d"), "features": feats, "zillow_variant_run": zillow_ok, "horizons": {}}
    for h in (5, 3):
        log("horizon", h)
        Y = {T: FT.targets(store, T, h) for T in ORIGINS[h]}
        cells = {T: make_cells(F[T], Y[T], T, feats, geo=geo) for T in ORIGINS[h]}
        wf = {"ridge": walk(cells, h, "ridge"), "ridge_noprice": walk(cells, h, "ridge", cols=noprice)}
        if not a.skip_gbm:
            wf["gbm"] = walk(cells, h, "gbm")
        if zillow_ok:
            fz = feats + ["zillow_1y"]
            cz = {T: make_cells(F[T], Y[T], T, fz, geo=geo) for T in ORIGINS[h]}
            wfz = walk(cz, h, "ridge")
        log("walk done", h)
        test_T = sorted(wf["ridge"])
        P = method_preds(cells, feats, wf)
        methods = ["noskill", "cheapest", "trend"] + list(wf)
        rows = evaluate(cells, P, methods)
        base_rows = evaluate(cells, P, ["noskill", "cheapest", "trend"])
        H = {"origins": ORIGINS[h], "test_origins": test_T,
             "cells_per_origin": {str(T): len(cells[T]) for T in cells}, "tracts_per_origin": {str(T): int(sum(len(c["y"]) for c in cells[T])) for T in cells},
             "hyperparameters": {m: {str(T): {"value": r["hp"], "train_origins": r["train"], "inner_scores": {str(k): r4(v) for k, v in r["hp_scores"].items()}} for T, r in wf[m].items()} for m in wf}}
        for metric in ("spread", "rho", "hit"):
            H[metric] = compare(rows, methods, metric)
            H[metric + "_baselines_all_origins"] = compare(base_rows, ["cheapest", "trend"], metric)
        H["paired_spread"] = {f"{m}_minus_{b}": paired(rows, m, b) for m in wf for b in ("cheapest", "trend")}
        H["paired_rho"] = {f"{m}_minus_{b}": paired(rows, m, b, "rho") for m in wf for b in ("cheapest", "trend")}
        H["paired_hit"] = {f"{m}_minus_{b}": paired(rows, m, b, "hit") for m in wf for b in ("cheapest", "trend")}
        H["by_county_spread"] = per_county(rows, methods)
        H["by_county_hit"] = per_county(rows, methods, "hit")
        H["by_county_rho"] = per_county(rows, methods, "rho")
        H["calibration"] = {"ridge": interval_coverage(cells, wf["ridge"]), "noskill": interval_coverage(cells, wf["ridge"], "noskill")}
        # robustness
        rob = {}
        exT = [T for T in test_T if T not in BOOM]
        rx = evaluate(cells, P, methods, only_T=exT)
        rob["excluding_2020_2022_origins"] = {"origins": exT, "spread": compare(rx, methods), "hit": compare(rx, methods, "hit"),
                                              "paired_spread": {f"ridge_minus_{b}": paired(rx, "ridge", b) for b in ("cheapest", "trend")}}
        early = [T for T in ORIGINS[h] if T + h <= 2021]
        for nm, fn in (("survivors", lambda c: c["survivor"]), ("all", None)):
            rr = evaluate(cells, P, ["cheapest", "trend"] + [m for m in wf if any(T in wf[m] for T in early)], subset=fn, only_T=early)
            rob.setdefault("thinning", {"origins_with_outcome_by_2021": early})[nm] = {m: summarise(v, "spread")["pooled"] for m, v in rr.items()}
        for nm, fn in (("stable_2010_2020", lambda c: c["stable"]), ("converted", lambda c: ~c["stable"])):
            rr = evaluate(cells, P, methods, subset=fn)
            rob.setdefault("tract_vintage", {})[nm] = {m: summarise(v, "spread")["pooled"] for m, v in rr.items()} | {"paired_ridge_minus_cheapest": paired(rr, "ridge", "cheapest")["pooled"] if rr.get("ridge") else None}
        rob["ablation_no_price_level"] = {"spread": H["spread"]["ridge_noprice"], "paired": {b: H["paired_spread"][f"ridge_noprice_minus_{b}"] for b in ("cheapest", "trend")}}
        if zillow_ok:
            Pz = method_preds(cz, feats + ["zillow_1y"], {"ridge_zillow": wfz})
            rz = evaluate(cz, Pz, ["cheapest", "ridge_zillow"])
            rob["internal_zillow_variant"] = {"spread": summarise(rz["ridge_zillow"], "spread")["pooled"], "paired_vs_cheapest": paired(rz, "ridge_zillow", "cheapest")["pooled"],
                                              "note": "internal test only; Zillow terms not confirmed; nothing from this variant is shipped"}
        # metro-relative
        fm = feats + FT.COUNTY_FEATURES
        Ym = Y
        cm = {T: make_cells(F[T], Ym[T], T, fm, group="cbsa", target="y_metro", geo=geo) for T in ORIGINS[h]}
        wfm = {"ridge_metro": walk(cm, h, "ridge")}
        Pm = method_preds(cm, fm, wfm)
        rm = evaluate(cm, Pm, ["noskill", "cheapest", "trend", "ridge_metro"])
        rob["metro_relative"] = {"cells": {str(T): len(cm[T]) for T in cm}, "spread": compare(rm, ["cheapest", "trend", "ridge_metro"]),
                                 "paired": {b: paired(rm, "ridge_metro", b) for b in ("cheapest", "trend")}}
        H["robustness"] = rob
        H["single_signals"] = single_signals(cells, feats)
        H["baseline_fifths"] = baseline_fifths(cells, feats, h)
        # weights of the last walk-forward ridge
        lastT = max(wf["ridge"])
        H["ridge_weights_last_origin"] = {"origin": lastT, "weights": {f: r4(w) for f, w in zip(feats, wf["ridge"][lastT]["model"]["w"])}}
        # decision (5-year only)
        if h == 5:
            pc = H["paired_spread"]["ridge_minus_cheapest"]["pooled"]
            pt = H["paired_spread"]["ridge_minus_trend"]["pooled"]
            overall = (pc["ci90"][0] or -1) > 0 and (pt["ci90"][0] or -1) > 0
            bc = H["by_county_spread"]
            per = {}
            for c, d in bc.items():
                ok = overall and d.get("ridge") is not None and d["ridge"] >= (d.get("cheapest") or -9) and d["ridge"] >= (d.get("trend") or -9)
                per[c] = {"uses_model": bool(ok), "ridge": d.get("ridge"), "cheapest": d.get("cheapest"), "trend": d.get("trend"), "cells": d["cells"]}
            R["decision"] = {"overall_pass": bool(overall), "paired_vs_cheapest": pc, "paired_vs_trend": pt, "per_county": per,
                             "counties_using_model": sum(1 for v in per.values() if v["uses_model"])}
            # final model for the current prediction: all 5-year origins, nested choice with the walk-forward folds
            fin = walk({**cells, CURRENT_T: make_current_cells(F[CURRENT_T], feats, geo)}, h, "ridge", test_origins=[CURRENT_T])
            res = fin[CURRENT_T]
            cur = {"origin": CURRENT_T, "train": res["train"], "lambda": res["hp"], "resid_source": res["resid_source"], "q": res["q"],
                   "weights": {f: r4(w) for f, w in zip(feats, res["model"]["w"])}, "counties": {}}
            for i, c in enumerate(res["cells"]):
                cur["counties"][c["key"]] = {"tracts": c["tracts"], "pred": [r4(x) for x in res["preds"][i]], "X": c["X"].round(4).tolist(),
                                             "raw": [[None if np.isnan(v) else round(float(v), 5) for v in row] for row in c["raw"]],
                                             "cheapest": [r4(x) for x in -c["X"][:, feats.index("value_acs")]]}
            json.dump(cur, open(os.path.join(a.out, "current.json"), "w"))
        R["horizons"][str(h)] = H
        json.dump(R, open(os.path.join(a.out, "results.json"), "w"), indent=1, default=lambda o: None)
        log("wrote", h)
    print(json.dumps({"decision": {k: v for k, v in R.get("decision", {}).items() if k != "per_county"}}, indent=1))


def make_current_cells(F, feats, geo):
    groups = collections.defaultdict(list)
    for t in geo["sample"]:
        groups[t[:5]].append(t)
    cells = []
    for key, ts in sorted(groups.items()):
        ts.sort()
        raw = np.array([[np.nan if F[t].get(f) is None else F[t][f] for f in feats] for t in ts], dtype=float)
        X = np.column_stack([M.centred_ranks(raw[:, j]) for j in range(len(feats))])
        cells.append({"T": CURRENT_T, "key": key, "county": key, "tracts": ts, "raw": raw, "X": X, "y": np.zeros(len(ts))})
    return cells


DRAWS = 2000

if __name__ == "__main__":
    main()
