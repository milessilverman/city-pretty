"""Hold-out-metro prediction test (docs/audit/prediction-2026-11-23.md). Run from the repository root:
    python3 -m unittest tests.predict2.test_features -v

1. The as-of guard refuses any source-year published after the origin.
2. Planting extreme values in every source-year after T (and the outcome years) changes no feature or baseline at T.
3. Metric helpers: ties are averaged in the top decile; unit weights give the plain Spearman; weights act like copies.
4. The hold-out split is fixed by the CBSA code alone.
"""
import copy
import os
import sys
import unittest

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts", "predict2"))
sys.path.insert(0, os.path.join(ROOT, "scripts", "predict"))
import hfeatures as FT  # noqa: E402
import holdout as HO  # noqa: E402


def synthetic(n=8, seed=1):
    rng = np.random.default_rng(seed)
    tracts = [f"{'01001' if i < n // 2 else '01003'}{i:06d}" for i in range(n)]
    H = np.exp(np.cumsum(rng.normal(0.03, 0.05, size=(n, FT.Y1 - FT.Y0 + 1)), axis=1)) * 100
    acs = {v: {"hv": rng.uniform(1e5, 5e5, n), "inc": rng.uniform(3e4, 1e5, n), "rent": rng.uniform(600, 2000, n),
               "units": rng.uniform(500, 3000, n), "vacant": rng.uniform(10, 200, n)} for v in FT.ACS_VINTAGES}
    bps = {(c, y): float(rng.integers(10, 900)) for c in ("01001", "01003") for y in range(2010, 2026)}
    J = rng.uniform(100, 5000, size=(n, 2024 - 2010 + 1))
    county = np.array([t[:5] for t in tracts])
    return {"tracts": tracts, "H": H, "county": county, "cbsa": np.where(county == "01001", "10000", "20000"), "acs": acs,
            "county_units": {v: {"01001": 20000.0, "01003": 30000.0} for v in FT.ACS_VINTAGES}, "bps": bps, "J": J,
            "holdout": np.array([False] * (n // 2) + [True] * (n - n // 2))}


def poison_after(S, T):
    """Extreme values in every year that is not published by the end of T (per source lag)."""
    P = copy.deepcopy(S)
    P["H"][:, (T - FT.Asof.LAG["fhfa"] + 1) - FT.Y0:] = 1e9
    for (c, y) in list(P["bps"]):
        if y > T - FT.Asof.LAG["bps"]:
            P["bps"][(c, y)] = 1e12
    if T - FT.Asof.LAG["lodes"] + 1 - 2010 < P["J"].shape[1]:
        P["J"][:, max(0, T - FT.Asof.LAG["lodes"] + 1 - 2010):] = 1e9
    for v in FT.ACS_VINTAGES:
        if v > T - FT.Asof.LAG["acs"]:
            for k in P["acs"][v]:
                P["acs"][v][k][:] = 1e9
    return P


class AsofTests(unittest.TestCase):
    def test_guard(self):
        g = FT.Asof(2018)
        self.assertEqual(g.ok("fhfa", 2017), 2017)
        self.assertEqual(g.ok("lodes", 2016), 2016)
        for src, y in (("fhfa", 2018), ("bps", 2018), ("acs", 2018), ("lodes", 2017)):
            with self.assertRaises(FT.Leak):
                g.ok(src, y)

    def test_no_future_data_in_features(self):
        S = synthetic()
        for T in range(2012, 2024):
            X, pool, E = FT.features_at(S, T)
            Xp, poolp, Ep = FT.features_at(poison_after(S, T), T)
            np.testing.assert_array_equal(np.isnan(X), np.isnan(Xp))
            np.testing.assert_allclose(np.nan_to_num(X), np.nan_to_num(Xp), err_msg=f"T={T}")
            self.assertEqual(E, Ep)
            self.assertLessEqual(E, T - 1)
            for h in (3, 5):
                b, bp = FT.baselines_at(S, T, h, X), FT.baselines_at(poison_after(S, T), T, h, Xp)
                for k in b:
                    np.testing.assert_allclose(np.nan_to_num(b[k]), np.nan_to_num(bp[k]), err_msg=f"{k} T={T}")

    def test_jobs_missing_when_no_span(self):
        X, _, _ = FT.features_at(synthetic(), 2012)
        self.assertTrue(np.isnan(X[:, FT.FEATURES.index("jobs_tract")]).all())

    def test_value_now_rolls_forward_with_own_index(self):
        S = synthetic()
        T = 2016
        X, _, E = FT.features_at(S, T)
        self.assertEqual(E, 2014)
        exp = np.log(S["acs"][2014]["hv"] * S["H"][:, T - 1 - FT.Y0] / S["H"][:, 2012 - FT.Y0])
        np.testing.assert_allclose(X[:, FT.FEATURES.index("value_now")], exp)

    def test_target(self):
        S = synthetic()
        y = FT.targets(S, 2015, 5)
        np.testing.assert_allclose(y, 100 * np.log(S["H"][:, 2020 - FT.Y0] / S["H"][:, 2015 - FT.Y0]))


class MetricTests(unittest.TestCase):
    def test_top_decile_ties_averaged(self):
        y = np.arange(20, dtype=float)
        self.assertAlmostEqual(HO.top_decile(np.zeros(20), y, np.ones(20)), y.mean())
        p = np.arange(20, dtype=float)
        self.assertAlmostEqual(HO.top_decile(p, y, np.ones(20)), (19 + 18) / 2)

    def test_weights_act_like_copies(self):
        rng = np.random.default_rng(3)
        p, y = rng.normal(size=30), rng.normal(size=30)
        w = rng.integers(0, 3, 30).astype(float)
        rep = np.repeat(np.arange(30), w.astype(int))
        self.assertAlmostEqual(HO.top_decile(p, y, w), HO.top_decile(p[rep], y[rep], np.ones(len(rep))), places=10)
        a = HO.wspearman(p, y, w, HO._groups(p), HO._groups(y))
        b = HO.wspearman(p[rep], y[rep], np.ones(len(rep)), HO._groups(p[rep]), HO._groups(y[rep]))
        self.assertAlmostEqual(a, b, places=10)

    def test_spearman_unit_weights(self):
        rng = np.random.default_rng(4)
        p, y = rng.normal(size=50), rng.normal(size=50)
        rp, ry = np.argsort(np.argsort(p)), np.argsort(np.argsort(y))
        self.assertAlmostEqual(HO.wspearman(p, y, np.ones(50), HO._groups(p), HO._groups(y)), np.corrcoef(rp, ry)[0, 1], places=10)


class SplitTests(unittest.TestCase):
    def test_holdout_is_by_code(self):
        self.assertEqual(FT.holdout_metro("12420"), FT.holdout_metro("12420"))
        share = np.mean([FT.holdout_metro(str(c)) for c in range(10000, 50000, 7)])
        self.assertTrue(0.25 < share < 0.35)


if __name__ == "__main__":
    unittest.main()
