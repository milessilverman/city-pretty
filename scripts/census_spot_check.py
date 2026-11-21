"""Census spot check: for a sample of block groups in each county, compare the county file's population, median home
value, median gross rent and median household income with the Census Bureau's ACS 2020-2024 5-year table files
(www2.census.gov .../table-based-SF/data/5YRData/acsdt5y2024-<table>.dat), read here with a separate parser.
Where the block group's own median is suppressed (negative sentinel), the file is expected to hold the tract's
published median (and acs_fallback_flags.json to say so) or nothing.
usage: python3 -I scripts/census_spot_check.py <repo root> <acs .dat dir> <per county> <out.json> fips...
"""
import gzip, json, os, sys, random

root, acs, per, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
fipss = sys.argv[5:]
TAB = {"pop": ("b01003", "B01003_E001"), "hv": ("b25077", "B25077_E001"), "rent": ("b25064", "B25064_E001"), "inc": ("b19013", "B19013_E001")}
URL = "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-{}.dat"
flags = json.load(open(os.path.join(root, "app/data/acs_fallback_flags.json")))["counties"]


def read(table, col, prefixes):
    vals = {}
    with open(os.path.join(acs, f"acs_{table}.dat"), encoding="utf-8") as f:
        head = f.readline().rstrip("\n").split("|")
        i = head.index(col)
        for line in f:
            if line.startswith(prefixes):
                p = line.rstrip("\n").split("|")
                vals[p[0]] = p[i]
    return vals


pref = tuple(f"1500000US{f}" for f in fipss) + tuple(f"1400000US{f}" for f in fipss)
census = {k: read(t, c, pref) for k, (t, c) in TAB.items()}
rng = random.Random(20261119)
res = {"_source": {"census_files": [URL.format(t) for t, _ in TAB.values()], "method": __doc__.strip(), "seed": 20261119}, "counties": {}}
tot = mism = 0
for fips in fipss:
    B = json.loads(gzip.decompress(open(os.path.join(root, "counties", f"bundle_{fips}.json.gz"), "rb").read()))
    bgs = sorted(B["details"])
    pick = sorted(rng.sample(bgs, min(per, len(bgs))))
    rows = []
    for bg in pick:
        m = B["details"][bg].get("m", B["details"][bg])
        for k in TAB:
            raw = census[k].get("1500000US" + bg)
            tract = census[k].get("1400000US" + bg[:11])
            have = m.get(k)
            own = None if raw in (None, "") or raw.lstrip("-").isdigit() and int(raw) < 0 else float(raw)
            fl = flags.get(fips, {})
            if own is not None:
                ok = have is not None and abs(float(have) - own) < 0.5
                why = "block group value"
            else:
                t = None if tract in (None, "") or int(tract) < 0 else float(tract)
                tagged = bg[5:] in fl.get(f"{k}_tract", [])
                ok = (have is None) or (t is not None and abs(float(have) - t) < 0.5 and (k not in ("hv", "rent") or tagged))
                why = f"suppressed in block group ({raw}); tract {tract}; flagged as tract value: {tagged}"
            rows.append({"bg": bg, "field": k, "file": have, "census_bg": raw, "census_tract": tract, "match": ok, "rule": why})
            tot += 1; mism += (not ok)
    res["counties"][fips] = {"county": B["meta"].get("county"), "block_groups": len(bgs), "checked": rows}
res["_source"]["values_checked"] = tot
res["_source"]["mismatches"] = mism
json.dump(res, open(out, "w"), indent=1)
print("values", tot, "mismatches", mism)
for fips, c in res["counties"].items():
    bad = [r for r in c["checked"] if not r["match"]]
    print(fips, c["county"], len(c["checked"]), "checked,", len(bad), "mismatch", bad[:2])
