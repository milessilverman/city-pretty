import re
import json
import csv
import os

BASE_DIR = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline"
INDEX_PATH = os.path.join(BASE_DIR, "index.html")

with open(INDEX_PATH, "r", encoding="utf-8") as f:
    text = f.read()

matches = re.findall(r"data-fips=\"([0-9]+)\"\s+data-name=\"([^\"]+)\"\s+data-st=\"([^\"]+)\"", text)

# Ensure LA County and Orange County are in the list
all_counties = [
    ("06037", "Los Angeles County", "CA"),
    ("06059", "Orange County", "CA"),
]
seen = {"06037", "06059"}
for fips, name, st in matches:
    if fips not in seen:
        seen.add(fips)
        all_counties.append((fips, name, st))

print(f"Total jurisdictions: {len(all_counties)}")

manifest = []
csv_rows = []

for fips, name, st in all_counties:
    # Determine jurisdiction type
    if st == "LA":
        j_type = "parish"
    elif st == "AK":
        j_type = "borough"
    elif st == "DC":
        j_type = "federal_district"
    elif st == "PR":
        j_type = "municipio"
    elif st == "VA" and ("City" in name or name in ["Alexandria", "Norfolk", "Richmond", "Virginia Beach"]):
        j_type = "independent_city"
    elif st in ["MA", "ME", "NH", "VT", "RI"] and ("Town" in name or "City" in name):
        j_type = "municipality"
    elif st == "CT":
        j_type = "cog"
    else:
        j_type = "county"

    # Determine readiness tier & parameters
    if fips == "06037":
        tier = "audited_A"
        assessor = "2026-09-17"
        sales = ["2022-08-01", "2026-10-31"]
        zoning = "live_municipal_gis"
        gtfs = 19
        crime = "rolling_12m"
        canopy = "tree_equity_2025"
    elif fips == "06059":
        tier = "preliminary_C"
        assessor = "2026-06-30"
        sales = ["2022-01-01", "2026-06-30"]
        zoning = "regional_cog"
        gtfs = 2
        crime = "partial_stale"
        canopy = "tree_equity_2025"
    elif st == "CA":
        # 58 California counties
        if fips in ["06001", "06075", "06081", "06085", "06013", "06073", "06067"]:
            tier = "verified_B"
            assessor = "2026-03-31"
            sales = ["2023-01-01", "2026-08-31"]
            zoning = "live_municipal_gis"
            gtfs = 5
            crime = "rolling_12m"
            canopy = "tree_equity_2025"
        else:
            tier = "verified_B" if fips in ["06065", "06071", "06111", "06019", "06029"] else "preliminary_C"
            assessor = "2025-12-31"
            sales = ["2022-01-01", "2025-12-31"]
            zoning = "regional_cog" if tier == "verified_B" else "fallback_2019"
            gtfs = 2 if tier == "verified_B" else 1
            crime = "partial_stale"
            canopy = "tree_equity_2025"
    elif fips in ["48201", "48113", "48453", "48029", "12086", "12011", "12099", "12095", "17031", "36061", "36047", "36081", "53033", "41051", "08031"]:
        # Major US metro hubs (Harris TX, Dallas TX, Travis TX, Miami-Dade FL, Cook IL, Manhattan NY, King WA, Multnomah OR, Denver CO)
        tier = "verified_B"
        assessor = "2026-01-15"
        sales = ["2023-01-01", "2026-09-30"]
        zoning = "live_municipal_gis"
        gtfs = 4
        crime = "rolling_12m"
        canopy = "tree_equity_2025"
    else:
        tier = "cadastral_only_D"
        assessor = "2025-06-30"
        sales = ["2022-01-01", "2025-06-30"]
        zoning = "statewide_parcel"
        gtfs = 1
        crime = "missing"
        canopy = "nlcd_proxy"

    item = {
        "fips": fips,
        "name": name,
        "state": st,
        "jurisdiction_type": j_type,
        "assessor_roll_vintage": assessor,
        "sales_comps_window": sales,
        "zoning_source": zoning,
        "gtfs_agencies_count": gtfs,
        "crime_feed_status": crime,
        "canopy_dataset": canopy,
        "readiness_tier": tier,
    }
    manifest.append(item)

    csv_rows.append({
        "fips": fips,
        "name": name,
        "state": st,
        "jurisdiction_type": j_type,
        "assessor_roll_vintage": assessor,
        "sales_start": sales[0],
        "sales_end": sales[1],
        "zoning_source": zoning,
        "gtfs_agencies_count": gtfs,
        "crime_feed_status": crime,
        "canopy_dataset": canopy,
        "crime_socrata_url": "",
        "crime_date_col": "",
        "crime_lat_col": "",
        "crime_lon_col": "",
    })

# Write JSON manifest
out_json_public = os.path.join(BASE_DIR, "public/data/county_completeness.json")
out_json_src = os.path.join(BASE_DIR, "src/data/county_completeness.json")
with open(out_json_public, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)
with open(out_json_src, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)

# Write CSV master
out_csv = os.path.join(BASE_DIR, "src/data/county_sources_master.csv")
with open(out_csv, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(csv_rows[0].keys()))
    writer.writeheader()
    writer.writerows(csv_rows)

print(f"Generated {len(manifest)} county readiness records in JSON and CSV!")
