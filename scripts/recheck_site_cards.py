#!/usr/bin/env python3
"""Re-derive, for randomly chosen station sites, every new figure on their project cards from the source files, and
compare with what the card engine shows. Writes data/backtests/site_cards_rederive_<date>.json.

Independent of the build where it can be:
  - census tract: asked again of the Census Geocoder (geographies/coordinates, Census2020 vintage), not the shapefile
  - ZIP area: asked of Census TIGERweb (2020 ZCTA layer, full outline), not the generalised outline
  - QCT: read from HUD's QCT<year>CSV.zip as downloaded; DDA: from HUD's <year>-DDAs-Data-Used-to-Designate.xlsx
  - permit value per home: the county's line of the Census co<year>a.txt files, divided by hand
  - tax-credit rent ceilings: HUD's MTSP API response for the county (saved raw), x 0.30 / 12
  - Fair Market Rents: HUD's FMR API asked again for the county
Usage: python3 -I scripts/recheck_site_cards.py <dl> <mtsp_raw_dir> [seed] [n]
"""
import csv
import io
import json
import os
import random
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from datetime import date

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEOCODER = "https://geocoding.geo.census.gov/geocoder/geographies/coordinates"
TIGERWEB = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/7/query"
FMR_API = "https://www.huduser.gov/hudapi/public/fmr/data/{f}99999?year=2027"


def get_json(url, headers=None):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=dict({"User-Agent": "city-pretty-data-pipeline/1.0"}, **(headers or {}))), timeout=90) as r:
                return json.load(r)
        except Exception:
            time.sleep(3 * (i + 1))
    return None


def main():
    dl, mraw = sys.argv[1], sys.argv[2]
    seed = int(sys.argv[3]) if len(sys.argv) > 3 else 20261122
    n = int(sys.argv[4]) if len(sys.argv) > 4 else 10
    rnd = random.Random(seed)
    sites = []
    for f in sorted(os.listdir(os.path.join(ROOT, "app", "data", "station_sites"))):
        if f[:5].isdigit():
            d = json.load(open(os.path.join(ROOT, "app", "data", "station_sites", f)))
            sites += [(d["fips"], s["id"], s["pt"]) for s in d["sites"]]
    while True:
        pick = rnd.sample(sites, n)
        if len({p[0] for p in pick}) >= 5:
            break
    cards = json.loads(subprocess.run(["node", os.path.join(ROOT, "scripts", "dump_site_cards.mjs")] + [f"{a}:{b}" for a, b, _ in pick], capture_output=True, text=True, check=True).stdout)

    qct = {}
    for y in ("2026", "2027"):
        z = zipfile.ZipFile(os.path.join(dl, f"QCT{y}CSV.zip"))
        qct[y] = {r["fips"].strip() for r in csv.DictReader(io.StringIO(z.read(z.namelist()[0]).decode("latin-1")))}
    sdda = {}
    for y in ("2026", "2027"):
        ws = openpyxl.load_workbook(os.path.join(dl, f"{y}-DDAs-Data-Used-to-Designate.xlsx"), read_only=True)[f"{y} MDDA"]
        it = ws.iter_rows(values_only=True)
        h = next(it)
        fc = [i for i, x in enumerate(h) if x and str(x).strip().startswith(f"{y} SDDA")][0]
        sdda[y] = {str(r[0]).zfill(5): int(r[fc] or 0) for r in it if r[0] is not None}
    bps = {}
    for y in ("2023", "2024", "2025"):
        for line in open(os.path.join(dl, f"co{y}a.txt"), encoding="latin-1").read().splitlines()[2:]:
            f = next(csv.reader([line]))
            if len(f) >= 30 and f[1].strip().isdigit():
                bps[(f[1].strip() + f[2].strip(), y)] = (int(f[28]), int(f[29]))

    rec, mism = [], 0
    for c in cards:
        fips = c["site"][:5]
        lat, lng = c["point"]
        g = get_json(GEOCODER + "?" + urllib.parse.urlencode({"x": lng, "y": lat, "benchmark": "Public_AR_Current", "vintage": "Census2020_Current", "layers": "Census Tracts", "format": "json"}))
        tracts = [t["GEOID"] for t in (g or {}).get("result", {}).get("geographies", {}).get("Census Tracts", [])]
        tw = get_json(TIGERWEB + "?" + urllib.parse.urlencode({"geometry": f"{lng},{lat}", "geometryType": "esriGeometryPoint", "inSR": "4326", "spatialRel": "esriSpatialRelIntersects", "outFields": "ZCTA5", "returnGeometry": "false", "f": "json"}))
        zctas = sorted({x["attributes"]["ZCTA5"] for x in (tw or {}).get("features", [])})
        tract = tracts[0] if len(tracts) == 1 else None
        zcta = zctas[0] if len(zctas) == 1 else None
        county = tract[:5] if tract else fips
        P = {p["id"]: p for p in c["placeFacts"]}
        checks = []

        def chk(name, card_v, hand_v, how):
            nonlocal_ok = (card_v == hand_v) if not (isinstance(card_v, float) or isinstance(hand_v, float)) else (card_v is not None and hand_v is not None and abs(card_v - hand_v) < 0.005)
            checks.append({"figure": name, "card": card_v, "by_hand": hand_v, "how": how, "same": nonlocal_ok})

        chk("census tract", (c["place"] or {}).get("tract"), tract, "Census Geocoder, Census2020 vintage, at the site's interior point")
        chk("ZIP Code Tabulation Area", (c["place"] or {}).get("zcta"), zcta, "Census TIGERweb 2020 ZCTA layer (full outline)")
        q = P["qct_dda"]
        for i, y in enumerate(("2026", "2027")):
            yy = q["years"][i] if q.get("years") else {}
            chk(f"{y} QCT", yy.get("qct"), (tract in qct[y]) if tract else None, f"HUD QCT{y}.csv: tract GEOID listed")
            chk(f"{y} metro Small DDA", yy.get("dda"), (sdda[y].get(zcta) == 1) if zcta and zcta in sdda[y] else None, f"HUD {y} MDDA sheet: ZCTA flag")
        cur = q["years"][1] if q.get("years") else {}
        chk("130% basis by location (2027)", q.get("boost"), ("applies" if (cur.get("qct") or cur.get("dda")) else "does not apply by location") if q.get("years") else None, "statute: QCT or DDA -> 130%")
        vals = [round(bps[(county, y)][1] / bps[(county, y)][0]) for y in ("2023", "2024", "2025") if (county, y) in bps and bps[(county, y)][0] > 0]
        cr = P["cost"].get("range")
        chk("permit value per home, low", cr["low"]["value"] if cr else None, min(vals) if vals else None, "co<year>a.txt 5+ units reported value / units, lowest year")
        chk("permit value per home, high", cr["high"]["value"] if cr else None, max(vals) if vals else None, "same, highest year")
        mp = os.path.join(mraw, f"{county}.json")
        m = json.load(open(mp)).get("data") if os.path.exists(mp) else None
        rl = P["rent_limits"].get("range")
        chk("60% rent ceiling, studio", round(rl["low"]["value"], 2) if rl else None, round(m["60percent"]["il60_p1"] * 0.3 / 12, 2) if m else None, "HUD MTSP API il60_p1 x 0.30 / 12")
        chk("60% rent ceiling, 2-bedroom", round(rl["high"]["value"], 2) if rl else None, round(m["60percent"]["il60_p3"] * 0.3 / 12, 2) if m else None, "HUD MTSP API il60_p3 x 0.30 / 12 (3 persons = 1.5 x 2 bedrooms)")
        fm = get_json(FMR_API.format(f=county), {"Authorization": "Bearer x"})
        bd = (fm or {}).get("data", {}).get("basicdata")
        if isinstance(bd, list):   # Small Area FMR metros list every ZIP; the metro-wide row is the one the card uses
            bd = next((b for b in bd if str(b.get("zip_code", "")).lower().startswith("msa")), None)
        fv = [bd.get(k) for k in ("Efficiency", "One-Bedroom", "Two-Bedroom", "Three-Bedroom")] if bd else None
        fr = P["fmr"].get("range")
        chk("FMR low (studio to 3-bedroom)", fr["low"]["value"] if fr else None, min(fv) if fv else None, "HUD FMR API, asked again, FY2027")
        chk("FMR high", fr["high"]["value"] if fr else None, max(fv) if fv else None, "same")
        bad = [x for x in checks if not x["same"]]
        mism += len(bad)
        rec.append({"site": c["site"], "file_county": fips, "point": c["point"], "checks": checks, "differ": len(bad)})
        time.sleep(0.5)
    out = {"date": date.today().isoformat(), "seed": seed, "n": n, "counties": sorted({r["file_county"] for r in rec}), "script": "scripts/recheck_site_cards.py",
           "figures_checked": sum(len(r["checks"]) for r in rec), "figures_differ": mism, "sites": rec}
    p = os.path.join(ROOT, "data", "backtests", f"site_cards_rederive_{out['date']}.json")
    json.dump(out, open(p, "w"), indent=1)
    print(json.dumps({k: out[k] for k in ("seed", "counties", "figures_checked", "figures_differ")}))
    for r in rec:
        for x in r["checks"]:
            if not x["same"]:
                print("DIFF", r["site"], x)


if __name__ == "__main__":
    main()
