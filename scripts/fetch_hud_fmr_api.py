#!/usr/bin/env python3
"""HUD Fair Market Rents for every U.S. county, current fiscal year, from HUD's own FMR API.

Replaces the map-service pull (scripts/fetch_hud_fmr.py), which turned out to hold FY2026 as first published: HUD
revised seven FY2026 areas in April 2026 without updating that service, and FY2027 took effect on 1 Oct 2026
(Federal Register 2026-17891) and is not in it. HUD's API (www.huduser.gov/hudapi) serves the current values.

Needs a free HUD User API token: https://www.huduser.gov/hudapi/public/register . The script sends it as
"Authorization: Bearer <HUD_API_TOKEN>". (In City Pretty's cloud environment a network proxy injects it; any
placeholder value works there.)

Sanity check before writing: the API's FY2026 values for Los Angeles County must equal the Federal Register's
revised FY2026 values (2026-07741: 2-bedroom $2,903), which HUD's map service never picked up.

New England: HUD defines FMR areas by town there, so those counties carry their towns' values and a min-max range,
and no single county value is invented.

Usage: HUD_API_TOKEN=... python3 scripts/fetch_hud_fmr_api.py [year] [--safmr]      (default 2027)
"""
import json
import os
import sys
import time
import urllib.request
from collections import defaultdict
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "app", "data", "hud_fair_market_rents.json")
API = "https://www.huduser.gov/hudapi/public/fmr"
STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA",
          "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR",
          "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "PR"]
NEW_ENGLAND = {"CT", "ME", "MA", "NH", "RI", "VT"}
FIELDS = [("zero_bed_eff", "Efficiency"), ("one_bed_1br", "One-Bedroom"), ("two_bed_2br", "Two-Bedroom"),
          ("three_bed_3br", "Three-Bedroom"), ("four_bed_4br", "Four-Bedroom")]


def get(path):
    token = os.environ.get("HUD_API_TOKEN")
    if not token:
        sys.exit("Set HUD_API_TOKEN (free at https://www.huduser.gov/hudapi/public/register)")
    req = urllib.request.Request(f"{API}/{path}", headers={"Authorization": f"Bearer {token}", "User-Agent": "city-pretty-data-pipeline/1.0"})
    for i in range(5):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r)["data"]
        except Exception:
            if i == 4:
                raise
            time.sleep(3 * (i + 1))


def main():
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2027
    today = date.today().isoformat()

    la26 = get("data/0603799999?year=2026")
    la26_2br = (la26["basicdata"][0] if isinstance(la26["basicdata"], list) else la26["basicdata"])["Two-Bedroom"]
    if la26_2br != 2903:
        sys.exit(f"Sanity check failed: API FY2026 LA 2BR = {la26_2br}, Federal Register 2026-07741 says 2903")
    print("sanity check passed: API FY2026 LA 2BR = 2903 (matches Federal Register 2026-07741)", file=sys.stderr)

    counties, towns, sub_areas = {}, defaultdict(list), []
    for st in STATES:
        d = get(f"statedata/{st}?year={year}")
        if str(d.get("year")) != str(year):
            sys.exit(f"{st}: API returned year {d.get('year')}, asked for {year}")
        for c in d.get("counties", []):
            fips10 = c["fips_code"]
            vals = {k: c.get(v) for k, v in FIELDS}
            if c.get("town_name") and st in NEW_ENGLAND:  # New England: FMR areas are towns
                towns[fips10[:5]].append({"town": c["town_name"], "fmr_area": c["metro_name"], **vals})
                counties.setdefault(fips10[:5], {"county_name": c["county_name"], "state_code": str(c.get("statecode") or "").upper(), "smallarea_status": c.get("smallarea_status")})
            elif c.get("town_name") and " part of " in c["town_name"]:
                # A piece of a county that HUD puts in a different FMR area (e.g. "Sullivan city part of Crawford County",
                # MO, in the St. Louis metro). Attached to its parent county as a sub-area, never as a county of its own.
                sub_areas.append((st, c["town_name"].split(" part of ")[1].strip(), {"area": c["town_name"], "fmr_area": c["metro_name"], **vals}))
            else:
                counties[fips10[:5]] = {"county_name": c["county_name"], "state_code": str(c.get("statecode") or "").upper(), "metro_or_county_name": c["metro_name"],
                                        "smallarea_status": c.get("smallarea_status"), **vals}
        time.sleep(0.3)

    for st, parent, sub in sub_areas:
        match = [f for f, c in counties.items() if c["state_code"] == st and c["county_name"] == parent]
        if len(match) != 1:
            sys.exit(f"Can't place HUD sub-area {sub['area']!r}: parent {parent!r} matched {match}")
        counties[match[0]].setdefault("sub_areas", []).append(sub)

    recs = []
    for fips in sorted(counties):
        c = counties[fips]
        r = {"fips": fips, "county_name": c["county_name"], "state_code": c["state_code"], "fiscal_year": year}
        if fips in towns:
            t = towns[fips]
            r.update({k: None for k, _ in FIELDS})
            r["metro_or_county_name"] = None
            r["towns"] = t
            r["two_bed_range"] = [min(x["two_bed_2br"] for x in t), max(x["two_bed_2br"] for x in t)]
            note = f"New England: HUD sets FMRs by town; {len(t)} towns in this county, 2-bedroom ${r['two_bed_range'][0]:,}-${r['two_bed_range'][1]:,}."
        else:
            r.update({k: c[k] for k, _ in FIELDS})
            r["metro_or_county_name"] = c["metro_or_county_name"]
            note = None
        if c.get("sub_areas"):
            r["sub_areas"] = c["sub_areas"]
            note = ((note + " ") if note else "") + "; ".join(f"{a['area']} uses the {a['fmr_area']} FMR (2-bedroom ${a['two_bed_2br']:,})" for a in c["sub_areas"]) + "."
        if c.get("smallarea_status") == "1":
            r["small_area_fmr_metro"] = True
            note = ((note + " ") if note else "") + "HUD uses ZIP-code Small Area FMRs in this metro; the value shown is the metro-wide FMR."
            if "--safmr" in sys.argv or os.environ.get("FETCH_SAFMR"):
                try:
                    cdata = get(f"data/{fips}99999?year={year}")
                    if cdata and "smallareadata" in cdata:
                        zips = {}
                        for zrow in cdata["smallareadata"]:
                            zc = str(zrow.get("zip_code") or zrow.get("ZIP_Code") or zrow.get("zip") or "").zfill(5)
                            if zc and len(zc) == 5:
                                zips[zc] = {k: zrow.get(v) for k, v in FIELDS}
                        if zips:
                            r["zip_rents"] = zips
                    time.sleep(0.2)
                except Exception as ex:
                    print(f"Warning: could not fetch SAFMR for {fips}: {ex}", file=sys.stderr)
        r["verification"] = {"status": "verified", "evidence": f"https://www.huduser.gov/hudapi/public/fmr/statedata/{c['state_code']}?year={year}"}
        if note:
            r["verification"]["notes"] = note
        recs.append(r)

    payload = {
        "_source": {
            "dataset": f"HUD Fair Market Rents FY{year}",
            "publisher": "U.S. Department of Housing and Urban Development, Office of Policy Development and Research",
            "api": f"{API}/statedata/<state>?year={year}",
            "fiscal_year": year,
            "effective": f"{year - 1}-10-01" if year == 2027 else None,
            "federal_register": "2026-17891 (FY2027 FMRs, published 2026-09-01, effective 2026-10-01)" if year == 2027 else None,
            "sanity_check": "API FY2026 Los Angeles 2-bedroom = $2,903, equal to the Federal Register's revised FY2026 value (2026-07741); HUD's map service still shows $2,601.",
            "verification_method": "Machine pull from HUD's official FMR API with an API token; values copied, never edited. FMRs are HUD's 40th-percentile gross rent (rent plus utilities) for voucher payment standards, not market asking rents.",
            "source_agency": "U.S. Department of Housing and Urban Development (HUD), Office of Policy Development and Research",
            "retrieved": today,
            "script": "scripts/fetch_hud_fmr_api.py",
        },
        "records": recs,
    }
    json.dump(payload, open(OUT, "w"), separators=(",", ":"))
    print(f"{len(sub_areas)} sub-county areas attached to their counties", file=sys.stderr)
    print(f"wrote {len(recs)} counties ({sum(1 for r in recs if 'towns' in r)} New England town-level) FY{year}", file=sys.stderr)


if __name__ == "__main__":
    main()
