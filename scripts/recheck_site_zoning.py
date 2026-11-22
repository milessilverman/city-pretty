#!/usr/bin/env python3
"""Re-derive by hand the home counts and costs of a random sample of zoned station sites (site zoning work, step 5).

Input: data/backtests/site_zoning_sample_<seed>.json (scripts/site_zoning_sample.mjs). For each site, with no cache:
  1. ask the city's zoning map again at the site's point (and, in New York, the special purpose district layer);
  2. fetch the code section again and find the density in it (San Diego: the zone's sentence "permits a maximum density
     of 1 dwelling unit for each N square feet of lot area"; New York: the dwelling unit factor of ZR 23-52 and the
     district's floor-area ratio row in ZR 23-21 / 23-22, through its residential equivalent in ZR 34-112 for a
     commercial district);
  3. recompute homes from the mapped lot area (acres x 43,560 sq ft) and cost = homes x the county's lowest and highest
     declared permit value per home (the Census rows of app/data/building_costs.json, re-derived on 22 Nov in
     data/backtests/site_cards_rederive_2026-11-22.json).
Writes data/backtests/site_zoning_rederive_<seed>.json with every figure side by side.
Usage: python3 -I scripts/recheck_site_zoning.py <seed>
"""
import html
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0 (city-pretty re-check)"}
SD_PDF = "https://docs.sandiego.gov/municode/MuniCodeChapter13/Ch13Art01Division0{n}.pdf"
NYC = "https://zr.planning.nyc.gov"


def get(url, binary=False):
    d = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180).read()
    return d if binary else d.decode("utf-8", "replace")


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def page(url):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", get(url), flags=re.S)
    return norm(html.unescape(re.sub(r"<[^>]+>", " ", t)))


def pdf(url):
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "a.pdf")
        open(p, "wb").write(get(url, True))
        subprocess.run(["pdftotext", "-layout", p, p + ".txt"], check=True)
        t = open(p + ".txt", encoding="utf8", errors="replace").read()
    t = re.sub(r"\n\s*Ch\.\s+Art\.\s+Div\.\s*\n[^\n]*\n", "\n", t)
    t = re.sub(r"\n\s*San Diego Municipal Code\s+Chapter 13: [A-Za-z ]+\n\s*\(\d+-\d{4}\)\s*\n", "\n", t)
    return norm(t)


def at_point(url, lat, lng, fields):
    q = urllib.parse.urlencode({"geometry": f"{lng},{lat}", "geometryType": "esriGeometryPoint", "inSR": "4326", "spatialRel": "esriSpatialRelIntersects", "outFields": fields, "returnGeometry": "false", "f": "json"})
    d = json.loads(get(url + "/query?" + q))
    return [f["attributes"] for f in d.get("features") or []]


def permit_range(fips):
    rows = [r for r in json.load(open(os.path.join(ROOT, "app/data/building_costs.json")))["rows"] if r.get("source_key") == "census_bps_county" and r.get("county_fips") == fips and r.get("measure") == "cost_per_unit"]
    vals = []
    for r in rows:
        vals.append(r["value"])
    return min(vals), max(vals), [(r["year"], r["value"], r["homes"]) for r in rows]


def main(seed):
    S = json.load(open(os.path.join(ROOT, f"data/backtests/site_zoning_sample_{seed}.json")))
    sd_text = {n: pdf(SD_PDF.format(n=n)) for n in (4, 5)}
    nyc_pages = {}
    t2352 = page(f"{NYC}/article-ii/chapter-3/23-52")
    factor = int(re.search(r"applicable dwelling unit factor shall be (\d+)\.", t2352).group(1))
    out = []
    for x in S["sample"]:
        lat, lng = x["point"]
        r = {"id": x["id"], "city": x["city"], "acres": x["acres"], "card": {"zone": x["zone"], "homes": x["homes"], "cost": x["cost"]}}
        sqft = x["acres"] * 43560
        if x["city"].startswith("San Diego"):
            z = at_point("https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0", lat, lng, "ZONE_NAME")
            r["zoneAgain"] = sorted({a["ZONE_NAME"] for a in z})
            zone = r["zoneAgain"][0] if len(r["zoneAgain"]) == 1 else None
            m = None
            for n in (4, 5):
                m = m or re.search(re.escape(zone or "#") + r" (?:[^•§]*?)?permits (?:a )?maximum density of 1 dwelling unit for (?:each )?([\d,]+) square feet of lot area", sd_text[n])
            per = int(m.group(1).replace(",", "")) if m else None
            r["codeAgain"] = {"url": SD_PDF.format(n=4 if (zone or "").startswith("RM") else 5), "sentence": m.group(0) if m else None, "sqftPerHome": per}
            # §113.0222(a)(1): a quotient that exceeds a whole number by 0.50 or more rounds up
            homes = [math.floor(sqft / per) + (1 if sqft / per - math.floor(sqft / per) >= 0.5 else 0)] * 2 if per else None
        else:
            z = at_point("https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/nyzd/FeatureServer/0", lat, lng, "ZONEDIST")
            sp = at_point("https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/nysp/FeatureServer/0", lat, lng, "SDLBL")
            r["zoneAgain"] = sorted({a["ZONEDIST"] for a in z})
            r["specialDistrictAgain"] = sorted({a["SDLBL"] for a in sp if a.get("SDLBL")})
            zone = r["zoneAgain"][0] if len(r["zoneAgain"]) == 1 else None
            eq = zone
            if zone and zone.startswith("C"):
                t = nyc_pages.setdefault("34-112", page(f"{NYC}/article-iii/chapter-4/34-112"))
                # the 34-112 table lists districts and then their residential equivalent, e.g. "C1-6 C2-6 C4-4 C4-5 C6-1 | R7-2"
                m = re.search(r"(?:^|\s)" + re.escape(zone) + r"(?:\s+C[\w-]+)*\s+(R\d+[A-Z]?(?:-\d)?[A-Z]?)\b", t)
                eq = m.group(1) if m else None
                r["equivalentAgain"] = eq
            far = None
            if eq:
                sec = "23-21" if re.match(r"R[1-5](?!\d)", eq) else "23-22"
                t = nyc_pages.setdefault(sec, page(f"{NYC}/article-ii/chapter-3/{sec}"))
                if sec == "23-21":
                    # "<districts> <standard FAR> <qualifying residential site FAR>"
                    rows = re.findall(r"((?:R\d+[A-Z]?(?:-\d)?[A-Z]? ?)+) (\d\.\d\d) (\d\.\d\d)", t)
                    cand = [(float(a), row) for row, a, b in rows if re.search(r"(?:^| )" + re.escape(eq) + r"(?: |$)", row.strip() + " ")]
                else:
                    # the 23-22 table as text: district names (a lone digit after one is its footnote), then the standard
                    # FAR, then the qualifying FAR (each may carry a footnote digit)
                    body = t[t.index("MAXIMUM FLOOR AREA RATIO FOR R6-R12 DISTRICTS"):t.index(" 1 For zoning lots")]
                    body = body.split("qualifying senior housing", 1)[1].split()
                    cand, dists, nums = [], [], []
                    for tok in body + ["END"]:
                        if re.fullmatch(r"\d\.\d\d", tok):
                            nums.append(tok)
                        elif re.fullmatch(r"R\d+[A-Z]?(?:-\d)?[A-Z]?|END", tok):
                            if len(nums) >= 2:
                                if eq in dists:
                                    cand.append((float(nums[0]), " ".join(dists) + " " + " ".join(nums)))
                                dists, nums = [], []
                            dists.append(tok)
                far = sorted({c[0] for c in cand}) if cand else None
                r["codeAgain"] = {"url": f"{NYC}/article-ii/chapter-3/{sec}", "district": eq, "farValues": far, "rows": [c[1] + " " + str(c[0]) for c in cand], "duFactor": factor}
            def at(f):
                v = f * sqft / factor
                return math.floor(v) + (1 if v - math.floor(v) >= 0.75 else 0)
            homes = [at(min(far)), at(max(far))] if far else None
        lo, hi, rows = permit_range(x["placeCounty"])
        r["permitRows"] = rows
        r["byHand"] = {"homes": homes, "cost": [lo * homes[0], hi * homes[1]] if homes else None}
        r["zoneSame"] = zone == x["zone"].split("|")[0]
        r["homesSame"] = homes == x["homes"]
        r["costSame"] = bool(homes and x["cost"] and abs(r["byHand"]["cost"][0] - x["cost"][0]) < 0.5 and abs(r["byHand"]["cost"][1] - x["cost"][1]) < 0.5)
        out.append(r)
        print(r["city"], x["zone"], r["zoneAgain"], x["homes"], homes, r["zoneSame"], r["homesSame"], r["costSame"])
    res = {"seed": seed, "checked": date.today().isoformat(), "script": "scripts/recheck_site_zoning.py", "n": len(out),
           "zoneSame": sum(r["zoneSame"] for r in out), "homesSame": sum(r["homesSame"] for r in out), "costSame": sum(r["costSame"] for r in out), "sites": out}
    json.dump(res, open(os.path.join(ROOT, f"data/backtests/site_zoning_rederive_{seed}.json"), "w"), indent=1)
    print({k: res[k] for k in ("n", "zoneSame", "homesSame", "costSame")})


if __name__ == "__main__":
    main(int(sys.argv[1]))
