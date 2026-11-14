import csv
import json
import os
from datetime import datetime, timedelta, timezone

BUILD_DIR = "build"
PUBLIC_DATA_DIR = "public/data"
SRC_DATA_DIR = "src/data"
os.makedirs(BUILD_DIR, exist_ok=True)
os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)
os.makedirs(SRC_DATA_DIR, exist_ok=True)

ROLLING_12M_START = (datetime.now(timezone.utc) - timedelta(days=365)).strftime("%Y-%m-%d")

def fetch_socrata_rolling_crime(endpoint: str, date_field: str, lat_field: str, lon_field: str):
    try:
        import requests
        params = {
            "$where": f"{date_field} >= '{ROLLING_12M_START}T00:00:00'",
            "$limit": 250000,
        }
        resp = requests.get(endpoint, params=params, timeout=60)
        resp.raise_for_status()
        rows = resp.json()
        return rows or []
    except Exception as e:
        print(f"[WARN] Socrata crime fetch failed for {endpoint}: {e}")
        return []

def compute_county_readiness(rows: list[dict]) -> list[dict]:
    manifest = []
    for row in rows:
        assessor_raw = (row.get("assessor_roll_vintage") or "").strip()
        has_assessor = bool(assessor_raw)
        has_live_zoning = (row.get("zoning_source") or "").strip() in ("live_municipal_gis", "statewide_parcel")
        try:
            gtfs_count = int(row.get("gtfs_agencies_count", 0) or 0)
        except ValueError:
            gtfs_count = 0
        has_gtfs = gtfs_count > 0
        crime_ok = (row.get("crime_feed_status") or "").strip() == "rolling_12m"

        if has_assessor and has_live_zoning and has_gtfs and crime_ok:
            tier = "audited_A"
        elif has_assessor and (has_live_zoning or has_gtfs):
            tier = "verified_B"
        elif has_assessor or has_gtfs:
            tier = "preliminary_C"
        else:
            tier = "cadastral_only_D"

        sales_end = (row.get("sales_end") or "").strip()
        sales_start = (row.get("sales_start") or "").strip()

        manifest.append({
            "fips": str(row["fips"]).strip().zfill(5),
            "name": row["name"].strip(),
            "state": row["state"].strip(),
            "jurisdiction_type": (row.get("jurisdiction_type") or "county").strip(),
            "assessor_roll_vintage": assessor_raw if has_assessor else None,
            "sales_comps_window": [sales_start, sales_end] if sales_end else None,
            "zoning_source": (row.get("zoning_source") or "fallback_2019").strip(),
            "gtfs_agencies_count": gtfs_count,
            "crime_feed_status": (row.get("crime_feed_status") or "missing").strip(),
            "canopy_dataset": (row.get("canopy_dataset") or "nlcd_proxy").strip(),
            "readiness_tier": tier,
        })
    return manifest

def main():
    registry_path = "src/data/county_sources_master.csv"
    if not os.path.exists(registry_path):
        print(f"[WARN] {registry_path} not found.")
        return
    with open(registry_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    manifest = compute_county_readiness(rows)
    for out_path in [f"{PUBLIC_DATA_DIR}/county_completeness.json", f"{SRC_DATA_DIR}/county_completeness.json"]:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)
    print(f"Wrote {len(manifest)} county readiness records to public/data and src/data.")

if __name__ == "__main__":
    main()
