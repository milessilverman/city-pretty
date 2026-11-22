#!/usr/bin/env python3
"""HUD income limits for every county in counties/manifest.json, from HUD's own API (www.huduser.gov/hudapi/public/il).

Endpoint: GET https://www.huduser.gov/hudapi/public/il/data/<5-digit county FIPS>99999 (latest year HUD serves; the
response says which). "Authorization: Bearer <HUD_API_TOKEN>" is sent; in City Pretty's cloud environment a network
proxy injects the real token, so any placeholder works there.

The API returns the area median income and three limits by household size 1-8: extremely low (30%), very low (50%) and
low (80%). It does NOT return a 60% limit; this script does not invent one.

Writes app/data/hud_income_limits.json (values copied, never edited) and saves raw responses to a scratch folder.
Usage: HUD_API_TOKEN=x python3 scripts/costs/fetch_hud_income_limits.py [raw_dir]
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "app", "data", "hud_income_limits.json")
API = "https://www.huduser.gov/hudapi/public/il"
NEW_ENGLAND_STATE_FIPS = {"09", "23", "25", "33", "44", "50"}
# Counties that are NOT in counties/manifest.json because the page loads them from app/data/ (bundle-la.b64.txt,
# bundle-oc.b64.txt) instead of counties/bundle_<fips>.json.gz. Reading the manifest alone silently left them out of this
# file and out of its failed list (found 22 Nov 2026: no Los Angeles County row).
EXTRA_FIPS = ["06037", "06059"]


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


def row_from(fips, d):
    """One output row from the `data` object of HUD's response (values copied, never edited)."""
    row = {"fips": fips, "area_name": d.get("area_name"), "county_name": d.get("county_name"), "metro_name": d.get("metro_name"),
           "year": d.get("year"), "median_income": d.get("median_income")}
    for key, grp, pre in (("il30", "extremely_low", "il30_p"), ("il50", "very_low", "il50_p"), ("il80", "low", "il80_p")):
        row[key] = [d[grp].get(f"{pre}{n}") for n in range(1, 9)]
    if d.get("town_name"):
        row["town_name"] = d["town_name"]
    if d.get("counties_msa"):
        row["counties_msa"] = d["counties_msa"]
    return row


def main():
    raw_dir = sys.argv[1] if len(sys.argv) > 1 else None
    if raw_dir:
        os.makedirs(raw_dir, exist_ok=True)
    counties = json.load(open(os.path.join(ROOT, "counties", "manifest.json")))["counties"]
    fips_list = sorted({c["fips"] for c in counties} | set(EXTRA_FIPS))

    def one(fips):
        cached = os.path.join(raw_dir, f"{fips}.json") if raw_dir else None
        if cached and os.path.exists(cached) and '"data"' in open(cached).read():
            txt = open(cached).read()  # resume: reuse a response saved by an earlier run of this script
        else:
            txt = get(f"data/{fips}99999")
            if cached:
                open(cached, "w").write(txt)
        return fips, json.loads(txt)

    with ThreadPoolExecutor(8) as ex:
        results = list(ex.map(one, fips_list))

    rows, failed = [], []
    for fips, resp in results:
        d = resp.get("data")
        if not d:
            reason = resp.get("error", "no data")
            if fips[:2] in NEW_ENGLAND_STATE_FIPS:
                reason += "; New England: HUD sets limits by town / area (entity ids are town-level), so no county-wide row exists and none is invented"
            failed.append({"fips": fips, "reason": reason})
            continue
        rows.append(row_from(fips, d))
    for f in EXTRA_FIPS:
        assert any(r["fips"] == f for r in rows) or any(x["fips"] == f for x in failed), f"{f} is neither a row nor in the failed list"
    years = sorted({r["year"] for r in rows})
    payload = {
        "_source": {
            "dataset": "HUD Income Limits (area median income and 30/50/80 percent limits, household sizes 1-8)",
            "publisher": "U.S. Department of Housing and Urban Development, Office of Policy Development and Research",
            "api": f"{API}/data/<county FIPS>99999",
            "fiscal_year": years[0] if len(years) == 1 else years,
            "retrieved": date.today().isoformat(),
            "columns": "il30 / il50 / il80 = arrays of 8 dollar limits for household sizes 1..8 (extremely low = 30%, very low = 50%, low = 80% of area median income, as HUD defines them)",
            "not_provided": "The API has no 60% (LIHTC / MTSP) limit and no 120% limit; none is computed here.",
            "county_count": len(rows),
            "failed": failed,
        },
        "counties": rows,
    }
    json.dump(payload, open(OUT, "w"), separators=(",", ":"))
    print(f"wrote {len(rows)} counties, {len(failed)} failed, years {years}", file=sys.stderr)


if __name__ == "__main__":
    main()
