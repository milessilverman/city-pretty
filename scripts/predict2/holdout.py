#!/usr/bin/env python3
"""Hold-out-metro walk-forward test (docs/audit/prediction-2026-11-23.md, Part A). numpy only.

Usage: python3 scripts/predict2/holdout.py [--out DIR] [--draws 2000] [--skip-gbm]
Writes DIR/results.json (every table). Default DIR: the session scratch folder pred1123/run.
"""
import argparse
import json
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "predict"))
import hfeatures as FT  # noqa: E402
import model as M  # noqa: E402  (scripts/predict/model.py: ridge_fit, gbm_fit, gbm_predict)

ORIGINS = {5: list(range(2012, 2021)), 3: list(range(2012, 2023))}
FIRST = 2012
LAMBDAS = [0.001, 0.01, 0.1, 1.0, 10.0]
SEED = 20261123
BASELINES = ["no_change", "metro_average", "momentum", "cheapest_in_metro", "cheapest_dollars"]
MODELS = ["ridge_all", "ridge_trend_level", "gbm_all"]
TREND_LEVEL = [FT.FEATURES.index(f) for f in FT.FAMILIES["trend"] + FT.FAMILIES["level"]]


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, file=sys.stderr, flush=True)


# ---------------------------------------------------------------- scaling (A.4): within origin, training metros' pool only
def scaler(X, ref):
    R = X[ref]
    lo = np.nanpercentile(R, 1, axis=0)
    hi = np.nanpercentile(R, 99, axis=0)
    Rc = np.clip(R, lo, hi)
    mu = np.nanmean(Rc, axis=0)
    sd = np.nanstd(Rc, axis=0)
    sd[~(sd > 0)] = 1.0
    mu = np.where(np.isnan(mu), 0.0, mu)
    lo = np.where(np.isnan(lo), -np.inf, lo)
    hi = np.where(np.isnan(hi), np.inf, hi)
    sorted_ref = [np.sort(Rc[:, j][~np.isnan(Rc[:, j])]) for j in range(X.shape[1])]

    def z(Xs):
        Z = (np.clip(Xs, lo, hi) - mu) / sd
        Z[np.isnan(Z)] = 0.0
        return Z

    def ranks(Xs):
        """within-origin percentile among training-pool tracts, centred to -0.5..0.5; missing -> 0"""
        out = np.zeros(Xs.shape)
        for j, s in enumerate(sorted_ref):
            x = np.clip(Xs[:, j], lo[j], hi[j])
            ok = ~np.isnan(x)
            if len(s) == 0:
                continue
            r = (np.searchsorted(s, x[ok], "left") + np.searchsorted(s, x[ok], "right")) / 2 / len(s)
            out[ok, j] = r - 0.5
        return out
    return z, ranks


# ---------------------------------------------------------------- origin data
def origin_data(S, T, h):
    X, pool, E = FT.features_at(S, T)
    train_pool = pool & ~S["holdout"]
    z, ranks = scaler(X, train_pool)
    y = FT.targets(S, T, h) if T + h <= FT.Y1 else np.full(len(pool), np.nan)
    uni = pool & np.isfinite(y)
    return {"T": T, "X": X, "Z": z(X), "R": ranks(X), "pool": pool, "uni": uni, "y": y, "E": E,
            "base": FT.baselines_at(S, T, h, X)}


def winsor(y):
    lo, hi = np.quantile(y, [0.01, 0.99])
    return np.clip(y, lo, hi)


def train_rows(ods, S, cols, key="Z", mask_fn=None):
    Xs, ys = [], []
    for od in ods:
        m = od["uni"] & ~S["holdout"]
        if mask_fn is not None:
            m = m & mask_fn(od)
        if m.sum() == 0:
            continue
        yy = od["y"][m]
        yy = winsor(yy - yy.mean())
        Xs.append(od[key][m][:, cols])
        ys.append(yy)
    return np.vstack(Xs), np.concatenate(ys)


def ridge_fit(X, y, lam):
    return M.ridge_fit(X, y - y.mean(), lam)


def choose_lambda(ods, S, cols):
    """5-fold CV by CBSA over training metros on the training origins; criterion: mean over origins of the held-out
    folds' top-decile mean (demeaned y)."""
    fold = np.array([FT.cv_fold(c) for c in S["cbsa"]])
    scores = {}
    for lam in LAMBDAS:
        per_origin = {od["T"]: (np.full(len(fold), np.nan)) for od in ods}
        for k in range(5):
            X, y = train_rows(ods, S, cols, mask_fn=lambda od, k=k: fold != k)
            w = ridge_fit(X, y, lam)
            for od in ods:
                m = od["uni"] & ~S["holdout"] & (fold == k)
                per_origin[od["T"]][m] = od["Z"][m][:, cols] @ w
        vals = []
        for od in ods:
            p = per_origin[od["T"]]
            m = od["uni"] & ~S["holdout"]
            vals.append(top_decile(p[m], od["y"][m] - od["y"][m].mean(), np.ones(m.sum())))
        scores[lam] = float(np.mean(vals))
    best = max(LAMBDAS, key=lambda l: (scores[l], l))
    return best, scores


# ---------------------------------------------------------------- metrics with weights (bootstrap) and ties averaged
def _groups(pred):
    """order (descending), tie-group id per sorted position"""
    o = np.argsort(-pred, kind="mergesort")
    ps = pred[o]
    gid = np.concatenate([[0], np.cumsum(ps[1:] != ps[:-1])])
    return o, gid


def top_decile(pred, y, w, frac=0.10, pre=None):
    o, gid = pre if pre is not None else _groups(pred)
    ws, ys = w[o], y[o]
    G = gid[-1] + 1
    gw = np.bincount(gid, weights=ws, minlength=G)
    gy = np.bincount(gid, weights=ws * ys, minlength=G)
    cum = np.cumsum(gw)
    target = frac * cum[-1]
    before = cum - gw
    take = np.clip(target - before, 0, gw)
    with np.errstate(invalid="ignore", divide="ignore"):
        gmean = np.where(gw > 0, gy / gw, 0.0)
    return float(np.sum(take * gmean) / target)


def _wranks(v, w, pre):
    o, gid = pre
    ws = w[o]
    G = gid[-1] + 1
    gw = np.bincount(gid, weights=ws, minlength=G)
    cum = np.cumsum(gw)
    mid = cum - gw / 2
    r = np.empty(len(v))
    r[o] = mid[gid]
    return r


def wspearman(pred, y, w, pre_p, pre_y):
    rp, ry = _wranks(pred, w, pre_p), _wranks(y, w, pre_y)
    W = w.sum()
    mp, my = np.sum(w * rp) / W, np.sum(w * ry) / W
    cov = np.sum(w * (rp - mp) * (ry - my))
    vp, vy = np.sum(w * (rp - mp) ** 2), np.sum(w * (ry - my) ** 2)
    return float(cov / np.sqrt(vp * vy)) if vp > 0 and vy > 0 else 0.0


# ---------------------------------------------------------------- run one horizon
def run_h(S, h, draws, skip_gbm):
    od = {T: origin_data(S, T, h) for T in ORIGINS[h]}
    log("h", h, "origins built", {T: int(o["uni"].sum()) for T, o in od.items()})
    tests = [T for T in ORIGINS[h] if T - h >= FIRST]
    preds, lam_log = {}, {}
    for T in tests:
        tr = [od[S_] for S_ in ORIGINS[h] if S_ + h <= T]
        P = {}
        all_cols = list(range(len(FT.FEATURES)))
        lam, sc = choose_lambda(tr, S, all_cols)
        X, y = train_rows(tr, S, all_cols)
        w = ridge_fit(X, y, lam)
        P["ridge_all"] = od[T]["Z"] @ w
        lam2, sc2 = choose_lambda(tr, S, TREND_LEVEL)
        X2, y2 = train_rows(tr, S, TREND_LEVEL)
        w2 = ridge_fit(X2, y2, lam2)
        P["ridge_trend_level"] = od[T]["Z"][:, TREND_LEVEL] @ w2
        if not skip_gbm:
            Xr, yr = train_rows(tr, S, all_cols, key="R")
            gm = M.gbm_fit(Xr, yr, 150, seed=SEED)
            P["gbm_all"] = M.gbm_predict(gm, od[T]["R"])
        for b in BASELINES:
            P[b] = od[T]["base"][b].copy()
        preds[T] = P
        lam_log[T] = {"ridge_all": {"lambda": lam, "cv": sc, "weights": dict(zip(FT.FEATURES, map(float, w))), "train_rows": int(len(y)),
                                    "train_origins": [o["T"] for o in tr]},
                      "ridge_trend_level": {"lambda": lam2, "cv": sc2, "weights": {FT.FEATURES[c]: float(v) for c, v in zip(TREND_LEVEL, w2)}}}
        log("h", h, "T", T, "lambda", lam, lam2, "train rows", len(y))
    methods = [m for m in MODELS if not (skip_gbm and m == "gbm_all")] + BASELINES
    res = {"tests": tests, "lambda": lam_log}
    for scope, sel in (("holdout", True), ("seen", False)):
        res[scope] = evaluate(S, od, preds, tests, methods, sel, draws)
    # baselines at every origin (hold-out tracts; no fitting)
    res["baselines_every_origin"] = {}
    for T in ORIGINS[h]:
        m = od[T]["uni"] & S["holdout"]
        y = od[T]["y"][m]
        row = {"n": int(m.sum()), "all_mean": float(y.mean())}
        for b in BASELINES:
            p = fill(od[T]["base"][b][m])
            row[b] = top_decile(p, y, np.ones(len(y)))
        res["baselines_every_origin"][T] = row
    res["universe"] = {T: {"pool": int(od[T]["pool"].sum()), "universe": int(od[T]["uni"].sum()),
                           "holdout_tracts": int((od[T]["uni"] & S["holdout"]).sum()), "acs_vintage": od[T]["E"]} for T in ORIGINS[h]}
    return res, od, preds


def fill(p):
    p = p.astype(float).copy()
    if np.isnan(p).any():
        p[np.isnan(p)] = np.nanmedian(p) if (~np.isnan(p)).any() else 0.0
    return p


def evaluate(S, od, preds, tests, methods, holdout, draws):
    cells = {}
    for T in tests:
        m = od[T]["uni"] & (S["holdout"] if holdout else ~S["holdout"])
        y = od[T]["y"][m]
        metros = S["cbsa"][m]
        cells[T] = {"y": y, "metros": metros, "pre_y": _groups(y),
                    "p": {k: fill(preds[T][k][m]) for k in methods}}
        cells[T]["pre"] = {k: _groups(v) for k, v in cells[T]["p"].items()}
    metro_ids = sorted(set(np.concatenate([c["metros"] for c in cells.values()])))
    mix = {c: i for i, c in enumerate(metro_ids)}
    for c in cells.values():
        c["mi"] = np.array([mix[x] for x in c["metros"]])
    K = len(metro_ids)

    def stats(wm):
        out = {}
        for T, c in cells.items():
            w = wm[c["mi"]]
            out[T] = {k: (top_decile(c["p"][k], c["y"], w, pre=c["pre"][k]), wspearman(c["p"][k], c["y"], w, c["pre"][k], c["pre_y"]),
                          float(np.sum(w * c["y"]) / np.sum(w))) for k in methods}
        return out
    point = stats(np.ones(K))
    rng = np.random.default_rng(SEED)
    boots = []
    for d in range(draws):
        wm = np.bincount(rng.integers(0, K, K), minlength=K).astype(float)
        boots.append(stats(wm))
    T_ = list(cells)

    def agg(st, k, i):
        return float(np.mean([st[T][k][i] for T in T_]))

    def ci(vals):
        return [float(np.quantile(vals, 0.025)), float(np.quantile(vals, 0.975))]
    out = {"metros": K, "tracts_per_origin": {T: int(len(c["y"])) for T, c in cells.items()}, "methods": {}, "paired": {}, "by_origin": {}}
    for k in methods:
        out["methods"][k] = {"top_decile": agg(point, k, 0), "top_decile_ci95": ci([agg(b, k, 0) for b in boots]),
                             "excess_over_all": float(np.mean([point[T][k][0] - point[T][k][2] for T in T_])),
                             "spearman": agg(point, k, 1), "spearman_ci95": ci([agg(b, k, 1) for b in boots])}
    for mdl in [m for m in methods if m in MODELS]:
        for b in BASELINES:
            dv = [float(np.mean([bt[T][mdl][0] - bt[T][b][0] for T in T_])) for bt in boots]
            ds = [float(np.mean([bt[T][mdl][1] - bt[T][b][1] for T in T_])) for bt in boots]
            out["paired"][f"{mdl}|{b}"] = {
                "top_decile_diff": float(np.mean([point[T][mdl][0] - point[T][b][0] for T in T_])), "top_decile_diff_ci95": ci(dv),
                "share_draws_le_0": float(np.mean(np.array(dv) <= 0)),
                "spearman_diff": float(np.mean([point[T][mdl][1] - point[T][b][1] for T in T_])), "spearman_diff_ci95": ci(ds),
                "origins_won": int(sum(point[T][mdl][0] > point[T][b][0] for T in T_)), "origins": len(T_)}
    for T in T_:
        out["by_origin"][T] = {k: {"top_decile": point[T][k][0], "spearman": point[T][k][1]} for k in methods}
        out["by_origin"][T]["_all_mean"] = point[T][methods[0]][2]
    return out


def decision(res):
    """A.7: for both horizons, on hold-out metros, ridge_all beats each baseline (95% interval above 0) and Spearman above each."""
    why = []
    for h, r in res.items():
        H = r["holdout"]
        for b in BASELINES:
            p = H["paired"][f"ridge_all|{b}"]
            if not p["top_decile_diff_ci95"][0] > 0:
                why.append(f"{h}-year: top-decile difference vs {b} has a 95% interval {p['top_decile_diff_ci95'][0]:+.1f} to {p['top_decile_diff_ci95'][1]:+.1f} (not above zero)")
            if not H["methods"]["ridge_all"]["spearman"] > H["methods"][b]["spearman"]:
                why.append(f"{h}-year: Spearman {H['methods']['ridge_all']['spearman']:.3f} not above {b} {H['methods'][b]['spearman']:.3f}")
    return {"pass": not why, "failed_conditions": why}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/tmp/claude-0/-home-user-city-pretty/3156622b-69a9-5d91-83c1-d393ef77389e/scratchpad/pred1123/run")
    ap.add_argument("--draws", type=int, default=2000)
    ap.add_argument("--skip-gbm", action="store_true")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    S = FT.load()
    log("loaded", len(S["tracts"]), "tracts in metro counties;", int(S["holdout"].sum()), "in hold-out metros;",
        len(set(S["cbsa"])), "metros,", len(set(S["cbsa"][S["holdout"]])), "hold-out")
    res = {}
    for h in (5, 3):
        res[h], _, _ = run_h(S, h, a.draws, a.skip_gbm)
    out = {"run": time.strftime("%Y-%m-%d %H:%M"), "draws": a.draws, "seed": SEED, "features": FT.FEATURES, "families": FT.FAMILIES,
           "metros": {"all": len(set(S["cbsa"])), "holdout": sorted(set(S["cbsa"][S["holdout"]]))},
           "results": {str(h): r for h, r in res.items()}, "decision": decision(res)}
    json.dump(out, open(os.path.join(a.out, "results.json"), "w"), indent=1, default=lambda x: x.item() if hasattr(x, "item") else str(x))
    log("decision", out["decision"])


if __name__ == "__main__":
    main()
