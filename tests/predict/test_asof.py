"""As-of rules of the prediction features (docs/PREDICTION-MODEL.md A.3). Run from the repository root:
    python3 -m unittest tests.predict.test_asof -v

1. The guard refuses any read published after the origin.
2. Building every origin's features (2014-2026) never reads data dated after T (each read is checked against the rules).
3. Planting extreme values in every source-year published after T changes no feature at T (so nothing after T leaks in,
   even through a path that skipped the guard).
4. Spot checks of feature arithmetic against the tables.
"""
import copy
import math
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts", "predict"))
import asof  # noqa: E402
import features as FT  # noqa: E402

COUNTIES = ["48453", "26163"]  # Travis TX; Wayne MI (LODES 2022-2024 missing for Michigan)
ORIGINS = list(range(2014, 2027))
STORE = None


def store():
    global STORE
    if STORE is None:
        STORE = FT.load_store(counties=COUNTIES)
    return STORE


def poison(v):
    if isinstance(v, dict):
        return {k: poison(x) for k, x in v.items()}
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return 7.7e9
    return v


def poisoned(s, T):
    out = {"_geo": s["_geo"]}
    for src, years in s.items():
        if src == "_geo":
            continue
        out[src] = {y: (d if asof.usable(src, y, T) else poison(d)) for y, d in years.items()}
        for y in range(T - 1, T + 12):  # also plant years the store does not have
            if not asof.usable(src, y, T) and y not in out[src]:
                some = next(iter(years.values()), {})
                out[src][y] = poison(copy.deepcopy(some))
    return out


def same(a, b):
    if a is None or b is None:
        return a is None and b is None
    return math.isclose(a, b, rel_tol=1e-12, abs_tol=1e-12)


class Guard(unittest.TestCase):
    def test_refuses_future_reads(self):
        g = asof.Guard({"fhfa": {2015: {}}}, 2015)
        with self.assertRaises(asof.AsOfViolation):
            g.get("fhfa", 2015)  # year-2015 index is published in 2016
        g.get("fhfa", 2014)
        with self.assertRaises(asof.AsOfViolation):
            asof.Guard({}, 2020).get("lodes", 2019)  # LODES lag is two years
        asof.Guard({}, 2020).get("lodes", 2018)
        with self.assertRaises(asof.AsOfViolation):
            asof.Guard({}, 2019).get("acs", 2019)  # ACS 2015-2019 released Dec 2020
        with self.assertRaises(asof.AsOfViolation):
            asof.Guard({}, 2025).get("irs", 2024)  # pair 2324 posted Nov 2026

    def test_latest_acs(self):
        s = {"acs": {2014: {}, 2019: {}}}
        self.assertIsNone(asof.Guard(s, 2014).latest("acs"))
        self.assertEqual(asof.Guard(s, 2015).latest("acs"), 2014)
        self.assertEqual(asof.Guard(s, 2019).latest("acs"), 2014)
        self.assertEqual(asof.Guard(s, 2020).latest("acs"), 2019)


class EveryOrigin(unittest.TestCase):
    def test_no_read_after_T(self):
        s = store()
        for T in ORIGINS:
            g = asof.Guard(s, T)
            FT.features_at(s, T, guard=g)
            self.assertTrue(g.reads)
            for src, y in g.reads:
                self.assertLessEqual(y + asof.PUB_LAG[src], T, f"origin {T} read {src} {y}")

    def test_future_values_do_not_change_features(self):
        s = store()
        tr = s["_geo"]["sample"]
        for T in ORIGINS:
            a = FT.features_at(s, T, tracts=tr)
            b = FT.features_at(poisoned(s, T), T, tracts=tr)
            for t in tr:
                for k in a[t]:
                    self.assertTrue(same(a[t][k], b[t][k]), f"origin {T} tract {t} feature {k}: {a[t][k]} vs {b[t][k]}")

    def test_poison_is_detectable(self):
        # sanity check of the test itself: poisoning a USABLE year must change something
        s = store()
        T = 2019
        bad = dict(s)
        bad["hmda"] = dict(s["hmda"])
        bad["hmda"][2018] = poison(s["hmda"][2018])
        a, b = FT.features_at(s, T), FT.features_at(bad, T)
        self.assertTrue(any(not same(a[t]["loan_level"], b[t]["loan_level"]) for t in a))


class Arithmetic(unittest.TestCase):
    def test_trend_and_hmda(self):
        s = store()
        T = 2019
        f = FT.features_at(s, T)
        t = next(t for t in s["_geo"]["sample"] if s["fhfa"][2018].get(t) and s["fhfa"][2013].get(t) and s["hmda"][2018].get(t, {}).get("median_loan"))
        self.assertAlmostEqual(f[t]["trend_5y"], math.log(s["fhfa"][2018][t] / s["fhfa"][2013][t]))
        self.assertAlmostEqual(f[t]["loan_level"], math.log(s["hmda"][2018][t]["median_loan"]))
        self.assertIsNone(FT.features_at(s, 2014)[t]["value_acs"])  # no ACS vintage published by end of 2014
        self.assertAlmostEqual(f[t]["value_acs"], math.log(s["acs"][2014][t]["hv"]))  # ACS 2010-14 at T 2019

    def test_lodes_missing_state_years_stay_missing(self):
        s = store()
        f = FT.features_at(s, 2026)  # needs LODES 2024 and 2022: not published for Michigan
        wayne = [t for t in f if t.startswith("26163")]
        self.assertTrue(wayne and all(f[t]["jobs_tract"] is None for t in wayne))
        travis = [t for t in f if t.startswith("48453")]
        self.assertTrue(any(f[t]["jobs_tract"] is not None for t in travis))

    def test_targets_relative_to_county_median(self):
        s = store()
        y = FT.targets(s, 2015, 5)
        import statistics
        allc = [math.log(s["fhfa"][2020][t] / s["fhfa"][2015][t]) for t in s["fhfa"][2015] if t.startswith("48453") and t in s["fhfa"][2020]]
        med = statistics.median(allc)
        t = next(t for t in y if t.startswith("48453"))
        self.assertAlmostEqual(y[t]["y"], math.log(s["fhfa"][2020][t] / s["fhfa"][2015][t]) - med)


if __name__ == "__main__":
    unittest.main()
