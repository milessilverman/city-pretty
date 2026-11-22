"""Output writer and metric helpers of the prediction pipeline. Run: python3 -m unittest tests.predict.test_outputs -v"""
import json
import math
import os
import sys
import unittest

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts", "predict"))
import features as FT  # noqa: E402
import model as M  # noqa: E402
import write_outputs as W  # noqa: E402


class Metrics(unittest.TestCase):
    def test_ranks_and_spread(self):
        r = M.centred_ranks([3.0, np.nan, 1.0, 2.0, 2.0])
        self.assertEqual(r[1], 0.0)  # missing -> county middle
        self.assertAlmostEqual(r[2], 0.5 / 4 - 0.5)
        self.assertAlmostEqual(r[3], r[4])
        y = np.arange(20, dtype=float)
        self.assertAlmostEqual(M.quintile_spread(y, y), np.mean(y[-4:]) - np.mean(y[:4]))
        self.assertAlmostEqual(M.spearman(y, -y), -1.0)
        self.assertEqual(M.top_third_hit(y, y), 1.0)

    def test_bootstrap_resamples_counties(self):
        b = M.county_bootstrap([1, 1, 3, 3], ["a", "a", "b", "b"], draws=500)
        self.assertEqual(b["counties"], 2)
        self.assertAlmostEqual(b["mean"], 2.0)
        self.assertGreaterEqual(b["ci90"][0], 1.0)
        self.assertLessEqual(b["ci90"][1], 3.0)

    def test_ridge_recovers_weights(self):
        rng = np.random.default_rng(1)
        X = rng.uniform(-0.5, 0.5, size=(2000, 3))
        y = X @ np.array([0.2, -0.1, 0.0]) + rng.normal(0, 0.01, 2000)
        w = M.ridge_fit(X, y, 1e-6)
        np.testing.assert_allclose(w, [0.2, -0.1, 0.0], atol=0.01)

    def test_gbm_learns_a_step(self):
        X = np.linspace(-0.5, 0.5, 1000).reshape(-1, 1)
        y = (X[:, 0] > 0).astype(float)
        m = M.gbm_fit(X, y, 100, min_leaf=20)
        p = M.gbm_predict(m, X)
        self.assertLess(p[:400].mean(), 0.2)
        self.assertGreater(p[-400:].mean(), 0.8)


class Writer(unittest.TestCase):
    def test_tract_file_range_rank_and_drivers(self):
        feats = FT.FEATURES
        w = {f: 0.0 for f in feats}
        w["loan_growth"], w["value_acs"] = 0.05, -0.1
        x1 = [0.0] * len(feats)
        x1[feats.index("loan_growth")], x1[feats.index("value_acs")] = 0.4, -0.3
        cur = {"origin": 2026, "weights": w, "counties": {"99001": {"tracts": ["99001000001", "99001000002"], "pred": [0.05, -0.02], "X": [x1, [0.0] * len(feats)]}}}
        tf = W.tract_file("99001", cur, [-0.1, 0.08], 0.5, "tested on test windows")
        a, b = tf["tracts"]
        self.assertEqual((a["rank_in_county"], b["rank_in_county"]), (1, 2))
        self.assertEqual(a["relative_5y_range_pct"], [round(100 * (math.exp(-0.05) - 1), 1), round(100 * (math.exp(0.13) - 1), 1)])
        self.assertEqual(a["drivers"][0]["feature"], "value_acs")  # largest contribution first
        self.assertIn("raises", a["drivers"][0]["text"])  # cheap (rank -0.3) with a negative weight raises it
        self.assertIn("block groups inherit", tf["level"])

    def test_shipped_file(self):
        d = json.load(open(os.path.join(ROOT, "app", "data", "neighborhood_prediction.json")))
        self.assertLess(os.path.getsize(os.path.join(ROOT, "app", "data", "neighborhood_prediction.json")), 15e6)
        self.assertEqual(len(d["counties"]), 50)
        if not d["decision"]["overall_pass"]:
            self.assertTrue(all(c["applies"] == "baseline" for c in d["counties"].values()))
            self.assertEqual(d["tract_files"], [])
        self.assertEqual([f["feature"] for f in d["features"]], FT.FEATURES)
        for k in ("excluding_2020_2022_origins", "fhfa_thinning", "tract_vintage", "metro_relative"):
            self.assertIn(k, d["results_5y"]["robustness"])


if __name__ == "__main__":
    unittest.main()
