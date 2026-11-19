#!/usr/bin/env python3
"""Runner probe script to test live API/data sources from current IP (e.g. GitHub Actions runner).

Verifies network accessibility, HTTP status, and checks for bot-gating (e.g. Cloudflare 403,
Incapsula, Akamai, or rate limits).

Outputs results to data/runner_probe_report.json.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(ROOT, "data", "runner_probe_report.json")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

ENDPOINTS = [
    {
        "id": "census_geocoder",
        "name": "U.S. Census Bureau Geocoder",
        "url": "https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=-97.7431&y=30.2672&benchmark=4&vintage=4&format=json",
    },
    {
        "id": "usgs_elevation",
        "name": "USGS Elevation Point Query Service (EPQS)",
        "url": "https://epqs.nationalmap.gov/v1/json?x=-97.7431&y=30.2672&units=Feet&wkid=4326",
    },
    {
        "id": "fema_nfhl",
        "name": "FEMA National Flood Hazard Layer (NFHL)",
        "url": "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry=-97.7431,30.2672&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE&returnGeometry=false&f=json",
    },
    {
        "id": "fema_nri",
        "name": "FEMA National Risk Index (NRI)",
        "url": "https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Census_Tracts/FeatureServer/0/query?geometry=-97.7431,30.2672&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=RISK_SCORE,RISK_RATNG&returnGeometry=false&f=json",
    },
    {
        "id": "usgs_seismic",
        "name": "USGS ASCE 7-22 Seismic Design Values",
        "url": "https://earthquake.usgs.gov/ws/designmaps/asce7-22.json?latitude=30.2672&longitude=-97.7431&riskCategory=II&siteClass=D&title=Probe",
    },
    {
        "id": "cdc_places",
        "name": "CDC PLACES Health Indicators (Socrata)",
        "url": "https://chronicdata.cdc.gov/resource/cwsq-ngmh.json?$limit=1",
    },
    {
        "id": "nces_schools",
        "name": "NCES EDGE Public School Locations",
        "url": "https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/Public_School_Locations_Current/FeatureServer/0/query?where=1%3D1&outFields=NAME&resultRecordCount=1&f=json",
    },
    {
        "id": "epa_walkability",
        "name": "EPA National Walkability Index",
        "url": "https://geodata.epa.gov/arcgis/rest/services/OA/WalkabilityIndex/MapServer/0/query?geometry=-97.7431,30.2672&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=NatWalkInd&returnGeometry=false&f=json",
    },
    {
        "id": "noaa_slr",
        "name": "NOAA Sea Level Rise (1ft Scenario)",
        "url": "https://coast.noaa.gov/arcgis/rest/services/dc_slr/slr_1ft/MapServer/0/query?geometry=-80.19,25.76&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json",
    },
    {
        "id": "nps_historic",
        "name": "NPS National Register of Historic Places",
        "url": "https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/1/query?geometry=-97.7431,30.2672&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=RESNAME&returnGeometry=false&f=json",
    },
    {
        "id": "fhwa_nhcci",
        "name": "FHWA National Highway Construction Cost Index (NHCCI)",
        "url": "https://data.transportation.gov/resource/r94d-n4f9.json?$limit=1&$order=quarter%20desc",
    },
    {
        "id": "fhfa_hpi_head",
        "name": "FHFA Annual Tract HPI Download Header",
        "url": "https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv",
        "method": "HEAD",
    },
    {
        "id": "lacounty_parcel",
        "name": "LA County Assessor Parcel Service",
        "url": "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query?where=1%3D1&returnGeometry=false&resultRecordCount=1&f=json",
    },
]


def probe_url(ep):
    url = ep["url"]
    method = ep.get("method", "GET")
    req = urllib.request.Request(url, headers={"User-Agent": UA}, method=method)
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            duration_ms = round((time.time() - start) * 1000)
            status = resp.status
            content_type = resp.headers.get("Content-Type", "")
            return {
                "id": ep["id"],
                "name": ep["name"],
                "url": url,
                "status": status,
                "ok": True,
                "bot_gated": False,
                "duration_ms": duration_ms,
                "content_type": content_type,
                "error": None,
            }
    except urllib.error.HTTPError as e:
        duration_ms = round((time.time() - start) * 1000)
        bot_gated = e.code in (401, 403, 429)
        return {
            "id": ep["id"],
            "name": ep["name"],
            "url": url,
            "status": e.code,
            "ok": False,
            "bot_gated": bot_gated,
            "duration_ms": duration_ms,
            "content_type": e.headers.get("Content-Type", ""),
            "error": f"HTTP {e.code}: {e.reason}",
        }
    except Exception as e:
        duration_ms = round((time.time() - start) * 1000)
        return {
            "id": ep["id"],
            "name": ep["name"],
            "url": url,
            "status": None,
            "ok": False,
            "bot_gated": False,
            "duration_ms": duration_ms,
            "content_type": None,
            "error": str(e),
        }


def main():
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    print(f"Probing {len(ENDPOINTS)} endpoints from current runner IP...")
    results = []
    for ep in ENDPOINTS:
        res = probe_url(ep)
        status_str = f"HTTP {res['status']}" if res["status"] else "FAILED"
        gate_str = " [BOT-GATED]" if res["bot_gated"] else ""
        print(f"  [{res['duration_ms']}ms] {res['name']}: {status_str}{gate_str}")
        results.append(res)

    report = {
        "_meta": {
            "probed_at": datetime.now(timezone.utc).isoformat(),
            "total_endpoints": len(results),
            "passed_count": sum(1 for r in results if r["ok"]),
            "bot_gated_count": sum(1 for r in results if r["bot_gated"]),
        },
        "results": results,
    }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nReport written to {OUT_PATH}")
    print(f"Passed: {report['_meta']['passed_count']}/{report['_meta']['total_endpoints']}")


if __name__ == "__main__":
    main()
