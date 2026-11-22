"""Split the anchors into work groups: one per openstreetmap.fr sub-region extract (the county's own file in
national/data/counties.json when the registry names a downloadable file), and one per state for counties whose registry
extract is only a split of a multi-GB regional file (us-west, us-midwest, ...), which is read from the Overpass mirror.
Usage: python3 pipeline/station_sites_groups.py <work dir>"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
work = sys.argv[1]
A = json.load(open(os.path.join(work, "anchors.json")))["anchors"]
reg = json.load(open(os.path.join(ROOT, "national/data/counties.json")))
groups = {}
for a in A:
    o = (reg.get(a["fips"]) or {}).get("osm") or {}
    url = o.get("url") or ""
    # a regional file (us-west-latest.osm.pbf, 3.8 GB) is too large for this job: those counties use Overpass
    direct = bool(url) and not o.get("split") and "-latest.osm.pbf" in url and url.count("/") > 6 or (bool(url) and url.endswith(("florida-latest.osm.pbf", "texas-latest.osm.pbf")))
    if direct and not o.get("split"):
        key = url.split("extracts/north-america/")[1].replace("-latest.osm.pbf", "")
        groups.setdefault(key, {"backend": "extract", "url": url, "anchors": []})["anchors"].append(a["id"])
    else:
        groups.setdefault("overpass/" + (a["state"] or "XX"), {"backend": "overpass", "url": None, "anchors": []})["anchors"].append(a["id"])
json.dump(groups, open(os.path.join(work, "groups.json"), "w"), indent=0)
for k, g in sorted(groups.items()):
    print(k, g["backend"], len(g["anchors"]))
