#!/usr/bin/env python3
"""Source (i): Census Bureau relationship files, 2010 tract -> 2020 tract and ZCTA(ZIP) -> 2020 tract.

URLs (checked 22 Nov 2026):
  https://www2.census.gov/geo/docs/maps-data/data/rel2020/t10t20/TAB2010_TAB2020_ST<ss>.zip   (one per state/territory, block-to-block)
  https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_tract20_natl.txt   (24 MB, streamed)

Weights are LAND-AREA shares (the files carry no population). Written:
  data/signals/xwalk_tract10_tract20.csv.gz   tract10,tract20,land_int,w10to20,w20from10
      w10to20    = share of the 2010 tract's land that lies in this 2020 tract (use to split a 2010-tract COUNT/total)
      w20from10  = share of the 2020 tract's land that came from this 2010 tract (use to average a 2010 RATE/level)
  data/signals/xwalk_zcta20_tract20.csv.gz    zcta,tract20,area_part,w_zcta_to_tract,w_tract_from_zcta
Raw state zips are streamed to a scratch file and deleted one at a time.
Usage: python3 scripts/signals/fetch_crosswalks.py
"""
import collections
import io
import os
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import OUT, SCRATCH, curl_file, curl_stream, write_gz_csv  # noqa: E402

BASE = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/"
STATES = "01 02 04 05 06 08 09 10 11 12 13 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 44 45 46 47 48 49 50 51 53 54 55 56 72".split()


def tract_pairs():
    pair = collections.Counter()
    for st in STATES:
        dest = os.path.join(SCRATCH, f"t10t20_{st}.zip")
        curl_file(f"{BASE}t10t20/TAB2010_TAB2020_ST{st}.zip", dest)
        with zipfile.ZipFile(dest) as z:
            name = z.namelist()[0]
            with z.open(name) as f:
                hdr = None
                for raw in io.TextIOWrapper(f, encoding="utf-8-sig"):
                    p = raw.rstrip("\n").split("|")
                    if hdr is None:
                        hdr = {k: i for i, k in enumerate(p)}
                        continue
                    t10 = p[hdr["STATE_2010"]] + p[hdr["COUNTY_2010"]] + p[hdr["TRACT_2010"]]
                    t20 = p[hdr["STATE_2020"]] + p[hdr["COUNTY_2020"]] + p[hdr["TRACT_2020"]]
                    if len(t10) != 11 or len(t20) != 11:
                        continue  # blocks with no 2020 counterpart (open water)
                    pair[(t10, t20)] += int(p[hdr["AREALAND_INT"]] or 0)
        os.remove(dest)
    return pair


def main():
    pair = tract_pairs()
    tot10, tot20 = collections.Counter(), collections.Counter()
    for (a, b), v in pair.items():
        tot10[a] += v
        tot20[b] += v
    rows = []
    for (a, b), v in sorted(pair.items()):
        if v == 0 and tot10[a] > 0:
            continue
        rows.append([a, b, v, round(v / tot10[a], 5) if tot10[a] else "", round(v / tot20[b], 5) if tot20[b] else ""])
    n = write_gz_csv(os.path.join(OUT, "xwalk_tract10_tract20.csv.gz"), ["tract10", "tract20", "land_int", "w10to20", "w20from10"], rows)
    print("tract10->tract20 rows", len(rows), "bytes", n)

    # ZCTA -> tract (streamed)
    p = curl_stream(BASE + "zcta520/tab20_zcta520_tract20_natl.txt")
    hdr = None
    zc = collections.Counter()
    for raw in io.TextIOWrapper(p.stdout, encoding="utf-8-sig"):
        f = raw.rstrip("\n").split("|")
        if hdr is None:
            hdr = {k: i for i, k in enumerate(f)}
            continue
        z, t = f[hdr["GEOID_ZCTA5_20"]], f[hdr["GEOID_TRACT_20"]]
        if not z or not t:
            continue
        zc[(z, t)] += int(f[hdr["AREALAND_PART"]] or 0)
    p.wait()
    tz, tt = collections.Counter(), collections.Counter()
    for (z, t), v in zc.items():
        tz[z] += v
        tt[t] += v
    rows = [[z, t, v, round(v / tz[z], 5) if tz[z] else "", round(v / tt[t], 5) if tt[t] else ""] for (z, t), v in sorted(zc.items()) if v > 0]
    n = write_gz_csv(os.path.join(OUT, "xwalk_zcta20_tract20.csv.gz"), ["zcta", "tract20", "area_part", "w_zcta_to_tract", "w_tract_from_zcta"], rows)
    print("zcta->tract rows", len(rows), "bytes", n)


if __name__ == "__main__":
    main()
