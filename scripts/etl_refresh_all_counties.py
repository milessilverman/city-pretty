import json
import os
from datetime import datetime, timedelta, timezone
import pandas as pd
import geopandas as gpd
import requests

BUILD_DIR = "build"
PUBLIC_DATA_DIR = "public/data"
os.makedirs(BUILD_DIR, exist_ok=True)
os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)

ROLLING_12M_START = (datetime.now(timezone.utc) - timedelta(days=365)).strftime("%Y-%m-%d")

def fetch_socrata_rolling_crime(endpoint: str, date_field: str, lat_field: str, lon_field: str) -> gpd.GeoDataFrame:
    params = {
        "$where": f"{date_field} >= '{ROLLING_12M_START}T00:00:00'",
        "$limit": 250000,
    }
    resp = requests.get(endpoint, params=params, timeout=60)
    resp.raise_for_status()
    rows = resp.json()
    if not rows:
        return gpd.GeoDataFrame()
    df = pd.DataFrame(rows)
    df = df.dropna(subset=[lat_field, lon_field])
    df[lat_field] = pd.to_numeric(df[lat_field], errors="coerce")
    df[lon_field] = pd.to_numeric(df[lon_field], errors="coerce")
    df = df[(df[lat_field] != 0) & (df[lon_field] != 0)]
    return gpd.GeoDataFrame(
        df,
        geometry=gpd.points_from_xy(df[lon_field], df[lat_field]),
        crs="EPSG:4326",
    )

def compute_county_readiness(df_counties: pd.DataFrame) -> list[dict]:
    manifest = []
    for _, row in df_counties.iterrows():
        has_assessor = pd.notna(row.get("assessor_roll_vintage"))
        has_live_zoning = row.get("zoning_source") in ("live_municipal_gis", "statewide_parcel")
        has_gtfs = int(row.get("gtfs_agencies_count", 0)) > 0
        crime_ok = row.get("crime_feed_status") == "rolling_12m"

        if has_assessor and has_live_zoning and has_gtfs and crime_ok:
            tier = "audited_A"
        elif has_assessor and (has_live_zoning or has_gtfs):
            tier = "verified_B"
        elif has_assessor or has_gtfs:
            tier = "preliminary_C"
        else:
            tier = "cadastral_only_D"

        manifest.append({
            "fips": str(row["fips"]).zfill(5),
            "name": row["name"],
            "state": row["state"],
            "jurisdiction_type": row.get("jurisdiction_type", "county"),
            "assessor_roll_vintage": row.get("assessor_roll_vintage") if has_assessor else None,
            "sales_comps_window": [row["sales_start"], row["sales_end"]] if pd.notna(row.get("sales_end")) else None,
            "zoning_source": row.get("zoning_source", "fallback_2019"),
            "gtfs_agencies_count": int(row.get("gtfs_agencies_count", 0)),
            "crime_feed_status": row.get("crime_feed_status", "missing"),
            "canopy_dataset": row.get("canopy_dataset", "nlcd_proxy"),
            "readiness_tier": tier,
        })
    return manifest

def main():
    registry_path = "src/data/county_sources_master.csv"
    if not os.path.exists(registry_path):
        print(f"[WARN] {registry_path} not found.")
        return
    df_sources = pd.read_csv(registry_path, dtype={"fips": str})
    manifest = compute_county_readiness(df_sources)
    with open(f"{PUBLIC_DATA_DIR}/county_completeness.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Wrote {len(manifest)} county readiness records.")

if __name__ == "__main__":
    main()
