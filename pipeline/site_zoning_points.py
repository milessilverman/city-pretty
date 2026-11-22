#!/usr/bin/env python3
"""Step 2a of the site zoning work: ask a city's official zoning map service for the zone at each station-area site.

For the sites of one jurisdiction (from <work>/site_juris.json, written by pipeline/site_zoning_measure.py) the site's
interior point is sent to the city's zoning layer (an ArcGIS REST point query, at most 2 requests a second, 4 tries,
answers cached in <work>/zq/<city>/). The answer is stored with the service URL and the date asked; a point that falls
in no zone polygon, or in two with different codes, is stored as such (never guessed).

Writes <work>/zq_<city>.json: { site id: { zone, fields, layer, url, asked } }.
Usage: python3 -I pipeline/site_zoning_points.py <work> <city>      (city: one of SERVICES)
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import date

UA = "Mozilla/5.0 (compatible; city-pretty site zoning)"
# Each city's own zoning map layer(s), asked in order; the first layer with a feature at the point answers.
SERVICES = {
    "los_angeles": {"juris": "place:0644000", "layers": [
        # City of Los Angeles Department of City Planning's zoning layer on the City's GeoHub (owner GIS@LADCP): the full
        # zone string and the Department's own category (Commercial, Multiple Family Residential, ...), Chapter 1 and
        # Chapter 1A zones in one layer. ZIMAS (zimas.lacity.org zma/zoning layers 1101 and 1102) answers the same
        # strings but took 30 s or more per point; it is asked again for the sample re-check.
        {"url": "https://services5.arcgis.com/7nsPwEMP38bSkCjy/arcgis/rest/services/Zoning/FeatureServer/15", "fields": ["Zoning", "CATEGORY"], "zone": "Zoning"}]},
    "los_angeles_zimas": {"juris": "place:0644000", "layers": [
        {"url": "https://zimas.lacity.org/arcgis/rest/services/zma/zoning/MapServer/1101", "fields": ["ZONE_CMPLT", "ZONE_CLASS", "ZONELEGEND"], "zone": "ZONE_CMPLT", "chapter": "1A"},
        {"url": "https://zimas.lacity.org/arcgis/rest/services/zma/zoning/MapServer/1102", "fields": ["ZONE_CMPLT", "ZONE_CLASS", "ZONELEGEND"], "zone": "ZONE_CMPLT", "chapter": "1"}]},
    "austin": {"juris": "place:4805000", "layers": [
        # City of Austin zoning (the layer app/app.js ZONING_SERVICES already registers for 48453)
        {"url": "https://maps.austintexas.gov/gis/rest/Shared/Zoning_1/MapServer/0", "fields": ["ZONING_ZTYPE", "ZONING_BASE"], "zone": "ZONING_ZTYPE"}]},
    "nyc": {"juris": "place:3651000", "layers": [
        # NYC Department of City Planning zoning districts (the GIS zoning features DCP publishes), and at the same point
        # the special purpose districts and the commercial overlays
        {"url": "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/nyzd/FeatureServer/0", "fields": ["ZONEDIST"], "zone": "ZONEDIST"}],
        "aux": [{"key": "special_district", "url": "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/nysp/FeatureServer/0", "fields": ["SDNAME", "SDLBL"], "value": "SDLBL"},
                {"key": "commercial_overlay", "url": "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/nyco/FeatureServer/0", "fields": ["OVERLAY"], "value": "OVERLAY"}]},
    "san_diego": {"juris": "place:0666000", "layers": [
        # City of San Diego Official Zoning Map (the layer app/data/zoning_standards.json already uses for lots)
        {"url": "https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0", "fields": ["ZONE_NAME"], "zone": "ZONE_NAME"}]},
}


def ask(url, lat, lng, fields, cache):
    cp = os.path.join(cache, f"{lat:.6f}_{lng:.6f}.json")
    if os.path.exists(cp):
        return json.load(open(cp))
    q = urllib.parse.urlencode({"geometry": f"{lng},{lat}", "geometryType": "esriGeometryPoint", "inSR": "4326", "spatialRel": "esriSpatialRelIntersects",
                                "outFields": ",".join(fields), "returnGeometry": "false", "f": "json"})
    err = None
    for i in range(4):
        try:
            time.sleep(0.5)
            with urllib.request.urlopen(urllib.request.Request(url + "/query?" + q, headers={"User-Agent": UA}), timeout=60) as r:
                d = json.load(r)
            if "error" in d:
                raise RuntimeError(json.dumps(d["error"])[:200])
            json.dump(d, open(cp, "w"))
            return d
        except Exception as e:  # noqa: BLE001 - recorded, retried
            err = str(e)
            time.sleep(2 * (i + 1))
    return {"error": err}


def main(work, city):
    S = SERVICES[city]
    sites = [s for s in json.load(open(os.path.join(work, "site_juris.json"))) if s["juris"] == S["juris"]]
    out, today = {}, date.today().isoformat()
    for s in sites:
        lat, lng = s["pt"]
        rec = None
        for L in S["layers"]:
            cache = os.path.join(work, "zq", city, L["url"].split("/")[-1])
            os.makedirs(cache, exist_ok=True)
            d = ask(L["url"], lat, lng, L["fields"], cache)
            if "error" in d:
                rec = {"zone": None, "why": "the service did not answer: " + str(d["error"])[:160], "url": L["url"], "asked": today}
                break
            feats = d.get("features") or []
            zones = sorted({(f["attributes"].get(L["zone"]) or "").strip() for f in feats} - {""})
            if not feats:
                continue
            if len(zones) != 1:
                rec = {"zone": None, "why": f"the point lies in {len(feats)} zone polygons with {len(zones)} different codes ({', '.join(zones)})", "url": L["url"], "asked": today}
            else:
                rec = {"zone": zones[0], "fields": feats[0]["attributes"], "url": L["url"], "asked": today, "chapter": L.get("chapter")}
            break
        if rec is None:
            rec = {"zone": None, "why": "the point is in no zone polygon of the city's zoning map (street, water or land outside the map)", "url": S["layers"][-1]["url"], "asked": today}
        for A in S.get("aux", []):
            cache = os.path.join(work, "zq", city, A["key"])
            os.makedirs(cache, exist_ok=True)
            d = ask(A["url"], lat, lng, A["fields"], cache)
            if "error" in d:
                rec[A["key"]] = {"error": str(d["error"])[:160], "url": A["url"]}
            else:
                vals = sorted({(f["attributes"].get(A["value"]) or "").strip() for f in d.get("features") or []} - {""})
                rec[A["key"]] = {"values": vals, "url": A["url"]}
        rec["fips"] = s["fips"]
        rec["pt"] = s["pt"]
        out[s["id"]] = rec
    json.dump(out, open(os.path.join(work, f"zq_{city}.json"), "w"), indent=0)
    n = sum(1 for r in out.values() if r["zone"])
    print(city, len(out), "sites;", n, "with a zone")
    import collections
    print(collections.Counter(r["zone"] for r in out.values()).most_common(60))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
