"""Recompute each county's data tier (A to D) from src/data/county_sources_master.csv into
src/data/county_completeness.json:  python3 scripts/build_county_readiness.py

This only re-scores what the CSV says about each county's sources; it downloads nothing. The page's own copy of
the tiers is COUNTY_COMPLETENESS_INDEX in app/app.js, so update that too when the tiers change.
"""
import csv
import json
import os

SRC_DATA_DIR = "src/data"

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
    out_path = f"{SRC_DATA_DIR}/county_completeness.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Wrote {len(manifest)} county readiness records to {out_path}.")

if __name__ == "__main__":
    main()
