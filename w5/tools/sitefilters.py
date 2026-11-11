"""Shared filters for site suggestions (used by combine_sites.py and export_county.py)."""
import json, math
import shapely
from shapely.strtree import STRtree
# Round-5 rule added after the runs (same as sites.py now): drop parking-lot-to-park candidates within 120 m of a supermarket,
# shopping center, department store or hospital (the lot most likely serves that business). Applied here to the saved runs.
COMMERCIAL = {"supermarket", "shopping center", "department store", "hospital"}
def drop_commercial(res, osm_file, lat0=34.0):
    kx = 111320 * math.cos(math.radians(lat0)); ky = 110540
    d = [x for x in json.load(open(osm_file))["dest"] if x[0] in COMMERCIAL]
    T = STRtree(shapely.points([x[2] * kx for x in d], [x[3] * ky for x in d])); n = 0
    for g in list(res["sites"]):
        keep = []
        for s in res["sites"][g]:
            if s["t"] == "lot_park" and any(math.hypot((d[int(i)][2] - s["pt"][0]) * kx, (d[int(i)][3] - s["pt"][1]) * ky) <= 120
                                            for i in T.query(shapely.Point(s["pt"][0] * kx, s["pt"][1] * ky).buffer(120))):
                n += 1; continue
            keep.append(s)
        if keep: res["sites"][g] = keep
        else: del res["sites"][g]
    res["meta"]["counts"]["lot_park"] = res["meta"]["counts"].get("lot_park", 0) - n
    res["meta"]["lot_park_commercial_dropped"] = n
    return n
