"""Unit tests for the data/signals tables. Run from the repository root:  python3 -m unittest tests.signals.test_signals -v

Every expected number below was read from the raw source file on 22 Nov 2026 (the source and the raw row are named beside each check),
not from the output tables. Tests that need git-ignored Zillow tables are skipped when those are absent (rebuild: fetch_zillow.py).
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scripts", "signals"))
import loaders  # noqa: E402


class Fhfa(unittest.TestCase):
    def test_county(self):  # hpi_at_county.xlsx row: AL, Autauga, 01001, 1987, -2.14, 97.86
        d = loaders.fhfa("county", {"01001"})["01001"]
        self.assertEqual(d[1987], {"hpi": 97.86, "annual_change": -2.14})
        self.assertIsNone(d[1986]["annual_change"])  # first year of the series has no change; blank stays None
        self.assertEqual(d[1986]["hpi"], 100.0)

    def test_zip5(self):  # hpi_at_zip5.xlsx row: 01001, 1985, 15.82, 115.82
        self.assertEqual(loaders.fhfa("zip5", {"01001"})["01001"][1985], {"hpi": 115.82, "annual_change": 15.82})

    def test_tract(self):  # hpi_at_tract.csv row: 01001020100,AL,1999,-4.86,95.14
        d = loaders.fhfa("tract", {"01001020100"})["01001020100"]
        self.assertEqual(d[1999], {"hpi": 95.14, "annual_change": -4.86})
        self.assertEqual(d[1998]["hpi"], 100.0)


class Hmda(unittest.TestCase):
    def test_manhattan_2022_tract(self):
        # data-browser CSV counties=36061&years=2022&loan_purposes=1, tract 36061001501, total_units 1-4, read from the raw rows:
        # actions 1:65 2:1 3:8 4:14 5:9 (6:3 not counted); originations by occupancy 1:59 2:6; median loan 705000; median income 267
        d = loaders.hmda()[("36061001501", 2022)]
        self.assertEqual((d["apps"], d["orig"], d["denied"], d["withdrawn"], d["incomplete"], d["approved_not_accepted"]), (97, 65, 8, 14, 9, 1))
        self.assertEqual((d["orig_owner_occ"], d["orig_second_home"], d["orig_investor"]), (59, 6, 0))
        self.assertEqual((d["median_loan"], d["median_income_k"]), (705000.0, 267.0))
        self.assertAlmostEqual(d["denial_rate"], 8 / (65 + 1 + 8), places=3)
        self.assertEqual(loaders.hmda()[("36061001501", 2022)]["tract_vintage"], "2020")

    def test_rates_are_consistent(self):
        for (t, y), d in list(loaders.hmda().items())[:5000]:
            self.assertLessEqual(d["orig"], d["apps"])
            if d["denial_rate"] is not None:
                self.assertTrue(0 <= d["denial_rate"] <= 1)


class Bps(unittest.TestCase):
    def test_county_annual(self):  # co2020a.txt: 2020,01,001,...Autauga,332,332,105453108 ; Baldwin 3395 1-unit, 7/14/2220389 2-unit, 14/205/35095317 5+
        c = loaders.bps_county()
        self.assertEqual(c[("01001", 2020)]["u1"], 332)
        b = c[("01003", 2020)]
        self.assertEqual((b["u1"], b["u2"], b["u34"], b["u5p"]), (3395, 14, 0, 205))
        self.assertEqual(b["value_total"], 817322441 + 2220389 + 35095317)

    def test_county_monthly(self):  # co2511c.txt: 202511,01,003 Baldwin: 1-unit 282; 3-4 units 1 bldg 4 units; 5+ 4 bldgs 44 units
        m = loaders.bps_county(monthly=True)[("01003", 2025, 11)]
        self.assertEqual((m["u1"], m["u2"], m["u34"], m["u5p"]), (282, 0, 4, 44))
        self.assertEqual(loaders.bps_county(monthly=True)[("01001", 2025, 11)]["u1"], 17)


class Lodes(unittest.TestCase):
    def test_tx_tract_2019(self):
        # tx_wac_S000_JT00_2019.csv.gz: 54 blocks in tract 48001950100 sum to C000=803, CE01/02/03=147/284/372, CNS01..05=160
        d = loaders.lodes_tract({"48001950100"})[("48001950100", 2019)]
        self.assertEqual((d["jobs"], d["earn_low"], d["earn_mid"], d["earn_high"], d["s_goods"]), (803, 147, 284, 372, 160))
        self.assertEqual(d["earn_low"] + d["earn_mid"] + d["earn_high"], d["jobs"])

    def test_bg_rolls_up_to_tract(self):
        bg = loaders.lodes_bg()
        t = {}
        for (g, y), v in bg.items():
            if y == 2019:
                t[g[:11]] = t.get(g[:11], 0) + v["jobs"]
        tr = loaders.lodes_tract(set(list(t)[:200]))
        for k in list(t)[:200]:
            self.assertEqual(tr[(k, 2019)]["jobs"], t[k])


class Zillow(unittest.TestCase):
    @unittest.skipUnless(os.path.exists(os.path.join(loaders.DIR, "zillow_zhvi_zip_annual_national.csv.gz")), "Zillow tables not built")
    def test_60601(self):  # raw Zip_zhvi_..._month.csv row 60601: 2019-12-31 469848.538..., 2026-10-31 409725.907...; ZORI 2290.133..., 2961.338...
        z = loaders.zillow("zhvi", monthly=False)["60601"]
        self.assertAlmostEqual(z["values"]["dec_2019"], 469848.54, places=2)
        self.assertAlmostEqual(z["values"]["latest_2026-10"], 409725.91, places=2)
        r = loaders.zillow("zori", monthly=False)["60601"]
        self.assertAlmostEqual(r["values"]["dec_2019"], 2290.13, places=2)
        self.assertEqual(z["meta"]["county_name"], "Cook County")


class Irs(unittest.TestCase):
    def test_cook_2122(self):  # countyinflow2122.csv Cook: 97,0 US 79866/114360/7327293 ; non-migrants 2014547 ; 97,3 different state 52157 ; 98,0 foreign 161
        d = loaders.irs_migration()[("17031", 2022)]
        self.assertEqual((d["in_returns"], d["in_exempt"], d["in_agi_k"], d["nonmig_returns"]), (79866, 114360, 7327293, 2014547))
        self.assertEqual((d["in_diffstate_returns"], d["in_foreign_returns"]), (52157, 161))
        self.assertEqual(d["net_returns"], d["in_returns"] - d["out_returns"])

    def test_autauga(self):  # countyinflow2122.csv: 1,1,97,0 ... 2076,4489,130188
        d = loaders.irs_migration()[("01001", 2022)]
        self.assertEqual((d["in_returns"], d["in_exempt"], d["in_agi_k"]), (2076, 4489, 130188))


class Acs(unittest.TestCase):
    def test_maricopa_tract(self):
        # acsdt5y2019-b19013.dat 1400000US04013010101 B19013_E001 = 99489 ; b25077 = 548800 ; ACS 2010-14 values from the 2014 sequence files as read by the back-test
        a = loaders.acs()
        self.assertEqual(a[("04013010101", "2015-2019")]["inc"], 99489)
        self.assertEqual(a[("04013010101", "2015-2019")]["hv"], 548800)
        self.assertEqual(a[("04013010101", "2010-2014")]["inc"], 102458)
        self.assertEqual(a[("04013010101", "2010-2014")]["hv"], 476700)
        self.assertIsNone(a[("04013010102", "2010-2014")]["rent"])  # blank cell stays None (not 0)


class Crosswalks(unittest.TestCase):
    def test_tract10_tract20(self):
        # TAB2010_TAB2020_ST11.zip: land of 2010 tract 11001000100 lying in 2020 tract 11001000102 = 1657442 of 1868369 total
        x = {t20: (w10, w20) for t20, w10, w20 in loaders.tract10_to_tract20()["11001000100"]}
        self.assertAlmostEqual(x["11001000102"][0], 1657442 / 1868369, places=4)
        self.assertAlmostEqual(sum(w for w, _ in x.values()), 1.0, places=3)

    def test_count_mapping_preserves_total(self):
        out = loaders.count_to_tract20({"11001000100": 1000.0})
        self.assertAlmostEqual(sum(out.values()), 1000.0, delta=2.0)

    def test_zcta(self):  # tab20_zcta520_tract20_natl.txt: ZCTA 20001 / tract 11001004702 area 326418 of ZCTA total 5302364
        z = {t: (a, b) for t, a, b in loaders.zcta_to_tract20()["20001"]}
        self.assertAlmostEqual(z["11001004702"][0], 326418 / 5302364, places=4)
        self.assertAlmostEqual(sum(a for a, _ in z.values()), 1.0, places=3)


if __name__ == "__main__":
    unittest.main()
