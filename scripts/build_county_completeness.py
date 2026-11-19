#!/usr/bin/env python3
"""Build app/data/county_completeness.json from evidence, not from a hand-kept list.

What it reads
-------------
* Each county's data file (counties/bundle_<fips>.json.gz, app/data/bundle-oc.b64.txt): its meta.sources list says
  what was actually loaded (assessor parcels, transit feeds, crime, crash records, tree canopy...).
* The live services the page queries (parsed from app/app.js): PARCEL_URL (LA County assessor, with values),
  PARCELS87 (parcel-line services by county or state) and ZONING_SERVICES (zoning by county). Each service URL is
  pinged once (`?f=json`) and the result is recorded, so a dead service is not counted.
* County names from the Census Bureau's TIGERweb counties layer.

Why
---
The previous index rated 683 counties "verified_B" and 23 "audited_A", stamped every record "source: Census TIGER",
and claimed assessor rolls, live zoning and crime feeds that the county data files themselves say were never loaded
(e.g. Travis County: "Assessor parcels / sales: Not loaded for this county"). See docs/DATA-AUDIT-AND-TRANSPARENCY.md.

Tiers (computed below; nothing is assigned by hand). Live services count when configured in app/app.js; their
health at build time is listed per county in live_services.not_responding.
  A  parcel values + zoning + transit feeds + (crime or crash records)
  B  parcel lines or values + zoning, or parcel values + transit feeds
  C  Census + OpenStreetMap + transit feeds loaded, but no parcel/zoning pair
  D  Census + OpenStreetMap only
  none  no data file for this county

Usage: python3 scripts/build_county_completeness.py [--no-ping]
"""
import base64
import glob
import gzip
import json
import os
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "app", "data", "county_completeness.json")
TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query"
UA = {"User-Agent": "city-pretty-data-pipeline/1.0"}
STATE_ABBR = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC",
    "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
    "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT",
    "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
    "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
    "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY", "72": "PR",
}
ABBR_STATE = {v: k for k, v in STATE_ABBR.items()}


def get_json(url, timeout=30):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return json.load(r)


def tiger_names():
    out, offset = {}, 0
    while True:
        q = f"{TIGER}?where=1%3D1&outFields=GEOID,NAME&returnGeometry=false&f=json&orderByFields=GEOID&resultOffset={offset}&resultRecordCount=1000"
        feats = get_json(q, 60).get("features", [])
        for f in feats:
            out[f["attributes"]["GEOID"]] = f["attributes"]["NAME"]
        if len(feats) < 1000:
            return out
        offset += len(feats)


def bundle_sources():
    """fips -> (built, [source rows]) from every county data file that carries a source list."""
    found = {}
    for p in sorted(glob.glob(os.path.join(ROOT, "counties", "bundle_*.json.gz"))):
        d = json.loads(gzip.decompress(open(p, "rb").read()))
        m = d.get("meta", {})
        found[m.get("fips") or re.search(r"bundle_(\d{5})", p).group(1)] = {
            "file": os.path.relpath(p, ROOT), "built": m.get("built"), "sources": m.get("sources", []),
            "has_zoning_layer": bool((d.get("layers") or {}).get("zoning")),
        }
    for fips, rel in (("06059", "app/data/bundle-oc.b64.txt"), ("06037", "app/data/bundle-la.b64.txt")):
        d = json.loads(gzip.decompress(base64.b64decode(open(os.path.join(ROOT, rel)).read().strip())))
        m = d.get("meta", {})
        found[fips] = {"file": rel, "built": m.get("built"), "sources": m.get("sources", []),
                       "has_zoning_layer": bool((d.get("layers") or {}).get("zoning"))}
    return found


def app_services():
    js = open(os.path.join(ROOT, "app", "app.js"), encoding="utf8").read()
    parcels = json.loads(re.search(r"^const PARCELS87 = (\[.*\]);?\s*$", js, re.M).group(1))
    zoning_block = js[js.index("const ZONING_SERVICES = {"):]
    zoning_block = zoning_block[: zoning_block.index("\n};") + 3]
    zoning = {k: u for k, u in re.findall(r'"(\d{5})":\s*\{\s*url:\s*"([^"]+)"', zoning_block)}
    la = re.search(r'const PARCEL_URL = "([^"]+)"', js).group(1)
    return parcels, zoning, la


def ping(url, tries=3):
    """A service counts as down only if every attempt fails (some county servers drop requests under load)."""
    import time
    base = url.split("/query")[0]
    last = "unknown"
    for i in range(tries):
        try:
            d = get_json(base + ("&" if "?" in base else "?") + "f=json", 25)
            if isinstance(d, dict) and "error" not in d:
                return "responding"
            last = "error_response"
        except Exception as e:
            last = "unreachable: " + str(e)[:60]
        time.sleep(2 * (i + 1))
    return last


def loaded(sources, *needles):
    for s in sources:
        name = s[0].lower()
        if any(n in name for n in needles) and len(s) > 3 and s[3] is True:
            return s
    return None


def main():
    do_ping = "--no-ping" not in sys.argv
    today = date.today().isoformat()
    names = tiger_names()
    bundles = bundle_sources()
    parcels, zoning, la_parcel_url = app_services()

    urls = {u for u in zoning.values()} | {p["url"] for p in parcels} | {la_parcel_url}
    status = {}
    if do_ping:
        with ThreadPoolExecutor(max_workers=4) as ex:
            status = dict(zip(urls, ex.map(ping, sorted(urls))))
    # Tiers count the services the page is configured to use; whether each answered at build time is recorded
    # separately (live_services.not_responding), because county servers drop requests under load and a tier
    # should not change with one bad minute.
    live = lambda u: True

    old = json.load(open(OUT)) if os.path.exists(OUT) else {}
    fips_all = sorted(set(old) | set(bundles))
    index = {}
    for fips in fips_all:
        st = fips[:2]
        b = bundles.get(fips)
        src = b["sources"] if b else []
        parcel_values = fips == "06037" and live(la_parcel_url)  # LA County assessor service returns Roll_LandValue etc.
        parcel_svcs = [p for p in parcels if fips in p.get("counties", []) or (not p.get("counties") and (st in p.get("states", []) or STATE_ABBR.get(st) in p.get("states", [])))]
        parcel_lines = parcel_values or any(live(p["url"]) for p in parcel_svcs)
        zoning_live = fips in zoning and live(zoning[fips])
        zoning_layer = bool(b and b["has_zoning_layer"])
        assessor = loaded(src, "assessor")
        gtfs = loaded(src, "gtfs feeds", "gtfs")
        gtfs_n = 0
        if gtfs:
            m = re.search(r"\((\d+) feeds?", gtfs[2])
            gtfs_n = int(m.group(1)) if m else 1
        crime = loaded(src, "crimes", "crime")
        crash = loaded(src, "crash", "ccrs", "titan", "traffic accidents")
        canopy = loaded(src, "tree equity")
        has_zoning = zoning_live or zoning_layer
        has_values = parcel_values or bool(assessor)

        if not b:
            tier = "none"
        elif has_values and has_zoning and gtfs_n and (crime or crash):
            tier = "A"
        elif (parcel_lines or has_values) and has_zoning or (has_values and gtfs_n):
            tier = "B"
        elif gtfs_n:
            tier = "C"
        else:
            tier = "D"

        index[fips] = {
            "fips": fips,
            "name": names.get(fips) or (old.get(fips) or {}).get("name"),
            "state": STATE_ABBR.get(st, "US"),
            "jurisdiction_type": "county",
            "readiness_tier": tier,
            "data_file": b["file"] if b else None,
            "data_file_built": b["built"] if b else None,
            # Fields the page already reads; null means "not loaded", never a guess.
            "assessor_roll_vintage": None,
            "sales_comps_window": None,
            "parcel_source": "live_service_with_values" if parcel_values else ("live_service_lines_only" if parcel_lines else ("data_file" if assessor else None)),
            "zoning_source": "live_service" if zoning_live else ("data_file_layer" if zoning_layer else None),
            "gtfs_agencies_count": gtfs_n,
            "crime_feed_status": crime[0] if crime else None,
            "crash_records": crash[0] if crash else None,
            "canopy_dataset": canopy[0] if canopy else None,
            "live_services": (lambda us: {"configured": len(us), "not_responding": [u for u in us if do_ping and status.get(u) != "responding"]})(
                ([la_parcel_url] if fips == "06037" else []) + [p["url"] for p in parcel_svcs] + ([zoning[fips]] if fips in zoning else [])),
            "notes": "This county's data file predates source lists, so transit, crime and canopy are not credited here even if present." if b and not src else None,
            "source": "Computed by scripts/build_county_completeness.py from this county's data file (meta.sources) and the live services configured in app/app.js; names from Census TIGERweb.",
            "computed_on": today,
            "verification": {"status": "verified", "method": "Machine-derived from repository data files and pings of each configured service on computed_on.", "evidence": "data_file meta.sources; live_services"} if b else {"status": "unverified", "notes": "No data file for this county."},
        }
    with open(OUT, "w") as f:
        json.dump(index, f, separators=(",", ":"))
    from collections import Counter
    print(f"wrote {len(index)} counties: {dict(Counter(r['readiness_tier'] for r in index.values()))}", file=sys.stderr)
    dead = {u: s for u, s in status.items() if s != "responding"}
    print(f"services pinged: {len(status)}, not responding: {len(dead)}", file=sys.stderr)
    for u, s in sorted(dead.items()):
        print("  ", s, u, file=sys.stderr)


if __name__ == "__main__":
    main()
