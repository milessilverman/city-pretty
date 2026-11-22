#!/usr/bin/env python3
"""HUD Multifamily Tax Subsidy Project (MTSP) income limits, the limits HUD publishes for the Low-Income Housing Tax
Credit, from HUD's own API (www.huduser.gov/hudapi/public/mtspil).

Endpoint: GET https://www.huduser.gov/hudapi/public/mtspil/data/<5-digit county FIPS>99999 (latest year HUD serves; the
response says which). "Authorization: Bearer <HUD_API_TOKEN>" is sent; in City Pretty's cloud environment a network
proxy injects the real token, so any placeholder works there.

The response holds the 20 to 80 percent limits for household sizes 1-8 (and HERA special limits). This file keeps the
50 and 60 percent limits (the statute's 20-50 and 40-60 tests, 26 U.S.C. 42(g)(1)) and the area median, copied, never
edited. It replaces the note in hud_income_limits.json that "the API has no 60% limit": the il endpoint has none, this
endpoint has it (found 22 Nov 2026).

Default counties: those with a station-area site file (app/data/station_sites/index.json) and any other county that holds
a site's point (app/data/hud_qct_dda.json tracts). --all: every county in
app/data/hud_income_limits.json.
Usage: HUD_API_TOKEN=x python3 -I scripts/costs/fetch_hud_mtsp_limits.py [raw_dir] [--all]
"""
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "app", "data", "hud_mtsp_income_limits.json")
API = "https://www.huduser.gov/hudapi/public/mtspil"
NEW_ENGLAND_STATE_FIPS = {"09", "23", "25", "33", "44", "50"}


def get(path):
    token = os.environ.get("HUD_API_TOKEN", "x")
    req = urllib.request.Request(f"{API}/{path}", headers={"Authorization": f"Bearer {token}", "User-Agent": "city-pretty-data-pipeline/1.0"})
    for i in range(5):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read().decode()
        except urllib.error.HTTPError as e:
            if e.code in (400, 404):
                return json.dumps({"error": f"HTTP {e.code}"})
            time.sleep(3 * (i + 1))
        except Exception:
            time.sleep(3 * (i + 1))
    return json.dumps({"error": "failed after retries"})


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    raw_dir = args[0] if args else None
    if raw_dir:
        os.makedirs(raw_dir, exist_ok=True)
    if "--all" in sys.argv:
        fips_list = sorted({r["fips"] for r in json.load(open(os.path.join(ROOT, "app", "data", "hud_income_limits.json")))["counties"]})
    else:
        fips_list = set(json.load(open(os.path.join(ROOT, "app", "data", "station_sites", "index.json")))["counties"].keys())
        qd = os.path.join(ROOT, "app", "data", "hud_qct_dda.json")   # counties a site's point lies in (some sites sit over a county line)
        if os.path.exists(qd):
            fips_list |= {t[:5] for t in json.load(open(qd))["tracts"]}
        fips_list = sorted(fips_list)

    def one(fips):
        cached = os.path.join(raw_dir, f"{fips}.json") if raw_dir else None
        if cached and os.path.exists(cached) and '"data"' in open(cached).read():
            txt = open(cached).read()
        else:
            txt = get(f"data/{fips}99999")
            time.sleep(0.25)
            if cached:
                open(cached, "w").write(txt)
        return fips, txt

    with ThreadPoolExecutor(3) as ex:
        results = list(ex.map(one, fips_list))
    rows, failed = [], []
    for fips, txt in results:
        resp = json.loads(txt)
        d = resp.get("data")
        if not d or "60percent" not in d:
            reason = resp.get("error", "no data")
            if fips[:2] in NEW_ENGLAND_STATE_FIPS:
                reason += "; New England: HUD sets limits by town / area (entity ids are town-level), so no county-wide row exists and none is invented"
            failed.append({"fips": fips, "reason": reason})
            continue
        rows.append({"fips": fips, "area_name": d.get("area_name"), "county_name": d.get("county_name"), "year": d.get("year"), "median_income": d.get("median_income"),
                     "il50": [d["50percent"][f"il50_p{n}"] for n in range(1, 9)], "il60": [d["60percent"][f"il60_p{n}"] for n in range(1, 9)],
                     "raw_sha256": hashlib.sha256(txt.encode()).hexdigest()})
    years = sorted({r["year"] for r in rows})
    payload = {"_source": {
        "dataset": "HUD Multifamily Tax Subsidy Project (MTSP) income limits: the income limits HUD publishes for LIHTC and tax-exempt bond projects",
        "publisher": "U.S. Department of Housing and Urban Development, Office of Policy Development and Research",
        "api": f"{API}/data/<county FIPS>99999",
        "fiscal_year": years[0] if len(years) == 1 else years,
        "retrieved": date.today().isoformat(),
        "builder": "scripts/costs/fetch_hud_mtsp_limits.py",
        "columns": "il50 / il60 = 8 dollar limits for household sizes 1..8 (50 and 60 percent of area median income as HUD publishes them for MTSP); raw_sha256 = hash of the API response body",
        "scope": "counties with a station-area site file (app/data/station_sites/index.json) and counties that hold a site's point (hud_qct_dda.json)" if "--all" not in sys.argv else "every county in hud_income_limits.json",
        "county_count": len(rows), "failed": failed}, "counties": rows}
    json.dump(payload, open(OUT, "w"), separators=(",", ":"))
    print(f"wrote {len(rows)} counties, {len(failed)} failed, years {years}", file=sys.stderr)


if __name__ == "__main__":
    main()
