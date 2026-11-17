#!/usr/bin/env python3
"""Cross-check a county's OpenStreetMap extract (pipeline/osm_extract.py output) against a direct Overpass query of the
same box, ID for ID.

Box: the county's block groups plus 0.02 degree (osm_extract.county_box). Roads: the highway classes the Alaska checks
used; bus stops: node highway=bus_stop. Where the extract comes from a dated snapshot (openstreetmap.fr, cut by
osm_split.py) and Overpass is live, a small difference can be edits made since the snapshot; the IDs that differ are
listed so they can be looked at.

Usage: python3 scripts/check_osm_extract_vs_overpass.py <pipeline data dir (holds bg.geojson, osm_roads.json, osm_bus_stops.json)> <fips> <out.json>
"""
import json, sys, time, urllib.request, urllib.parse

URL = "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
SEL = {
    "roads": ('way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|secondary|tertiary|residential|living_street|unclassified|primary_link|secondary_link|tertiary_link)$"]', "osm_roads.json"),
    "bus_stops": ('node["highway"="bus_stop"]', "osm_bus_stops.json"),
}


def main():
    d, fips, out_path = sys.argv[1].rstrip("/") + "/", sys.argv[2], sys.argv[3]
    xs, ys = [], []

    def walk(c):
        if isinstance(c[0], (int, float)):
            xs.append(c[0]); ys.append(c[1])
        else:
            for q in c:
                walk(q)
    for f in json.load(open(d + "bg.geojson"))["features"]:
        walk(f["geometry"]["coordinates"])
    w, s, e, n = min(xs) - .02, min(ys) - .02, max(xs) + .02, max(ys) + .02
    box = f"{s},{w},{n},{e}"
    snap = ""
    try:
        import glob
        st = glob.glob(d + "osm/*.state.txt")
        if st:
            snap = next((l.split("=", 1)[1] for l in open(st[0]).read().splitlines() if l.startswith("timestamp=")), "").replace("\\", "")
    except Exception:
        pass
    out = {"fips": fips, "box_s_w_n_e": box, "endpoint": URL, "extract_snapshot": snap, "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    for k, (sel, fn) in SEL.items():
        j = None
        for i in range(8):
            try:
                q = f"[out:json][timeout:600];{sel}({box});out ids;"
                j = json.loads(urllib.request.urlopen(urllib.request.Request(URL, data=("data=" + urllib.parse.quote(q)).encode()), timeout=650).read())
                break
            except Exception as ex:
                print(k, "try", i + 1, str(ex)[:80], file=sys.stderr); time.sleep(15 * (i + 1))
        if j is None:
            out[k] = {"error": "Overpass did not answer"}; continue
        direct = {x["id"] for x in j["elements"]}
        ext = {x["id"] for x in json.load(open(d + fn))["elements"] if (k != "roads" or x.get("type") == "way")}
        out[k] = {"direct": len(direct), "extract": len(ext), "missing_from_extract": sorted(direct - ext)[:50], "extra_in_extract": sorted(ext - direct)[:50],
                  "n_missing": len(direct - ext), "n_extra": len(ext - direct), "match": direct == ext}
    json.dump(out, open(out_path, "w"), indent=1)
    print(json.dumps({k: (v if not isinstance(v, dict) else {kk: vv for kk, vv in v.items() if not isinstance(vv, list)}) for k, v in out.items()}))


if __name__ == "__main__":
    main()
