#!/usr/bin/env python3
"""Adds DataSF's own crash total for the counted years to app/data/crash_counts/06075.json, so the page can say what
share of San Francisco's injury crashes were placed. (A map query returns only located crashes; DataSF can report
its total, unlike the state map services.) Run after: python3 scripts/build_state_crash_counts.py 06075"""
import json
import os
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, "app", "data", "crash_counts", "06075.json")
U = ("https://services.arcgis.com/Zs2aNLFN00jrS4gG/arcgis/rest/services/"
     "Traffic_Crashes_Resulting_in_Injury_from_DataSF_pulled_monthly_/FeatureServer/0/query")

d = json.load(open(P))
m = d["_meta"]
y0, y1 = m["years"]
q = urllib.parse.urlencode({"where": f"accident_year >= {y0} AND accident_year <= {y1}", "returnCountOnly": "true", "f": "json"})
n = json.load(urllib.request.urlopen(urllib.request.Request(f"{U}?{q}", headers={"User-Agent": "city-pretty/1.0"}), timeout=60))["count"]
m["source_total_in_years"] = n
m["located_share"] = round(m["with_coordinates"] / n, 3)
m["counting_note"] = m["counting_note"].split(" For this source")[0] + (
    f" For this source the dataset's own total for {y0}-{y1} is {n}, so {m['with_coordinates']} "
    f"({round(100 * m['with_coordinates'] / n)}%) were placed; the rest have no location or lie outside the county box.")
json.dump(d, open(P, "w"), separators=(",", ":"))
print(n, m["with_coordinates"], m["located_share"])
