#!/usr/bin/env python3
"""Descriptive follow-up, written AFTER the pre-registered run failed (docs/audit/prediction-2026-11-23.md, A.9): how each
single signal ranked hold-out tracts at every origin, including the training years. No fitting, nothing chosen from it.
Output: data/backtests/prediction_holdout_2026-11-23_signals.json
Usage: python3 scripts/predict2/diagnostics.py
"""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "predict"))
import hfeatures as FT  # noqa: E402
import holdout as HO  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))


def main():
    S = FT.load()
    out = {"note": "Descriptive, computed after the pre-registered test failed. Spearman of each signal (higher value first) with the realised change, "
                   "hold-out metros only, per origin. Not used to choose or fit anything.", "by_horizon": {}}
    for h in (5, 3):
        rows = {}
        for T in HO.ORIGINS[h]:
            X, pool, E = FT.features_at(S, T)
            y = FT.targets(S, T, h)
            m = pool & np.isfinite(y) & S["holdout"]
            row = {"tracts": int(m.sum()), "market_mean": float(y[m].mean())}
            for j, f in enumerate(FT.FEATURES):
                x = X[m, j]
                ok = ~np.isnan(x)
                if ok.sum() < 100:
                    row[f] = None
                    continue
                w = np.ones(ok.sum())
                row[f] = HO.wspearman(x[ok], y[m][ok], w, HO._groups(x[ok]), HO._groups(y[m][ok]))
            rows[T] = row
        out["by_horizon"][str(h)] = rows
    p = os.path.join(ROOT, "data", "backtests", "prediction_holdout_2026-11-23_signals.json")
    json.dump(out, open(p, "w"), indent=1)
    for h, rows in out["by_horizon"].items():
        print("h", h)
        print("T     " + " ".join(f"{f[:10]:>10}" for f in FT.FEATURES))
        for T, r in rows.items():
            print(T, " ".join(f"{(r[f] if r[f] is not None else float('nan')):10.3f}" for f in FT.FEATURES), f"mkt {r['market_mean']:.1f}")


if __name__ == "__main__":
    main()
