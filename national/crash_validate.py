import json, urllib.request, urllib.parse
def stat(url, where, field):
    q = urllib.parse.urlencode({"where": where, "outStatistics": json.dumps([{"statisticType": "sum", "onStatisticField": field, "outStatisticFieldName": "k"}]), "f": "json"})
    with urllib.request.urlopen(urllib.request.Request(url + "/query?" + q, headers={"User-Agent": "city-pretty-check"}), timeout=300) as r:
        j = json.loads(r.read())
    return (j.get("features") or [{}])[0].get("attributes", {}).get("k"), j.get("error")
FARS = "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Fatality_Analysis_Reporting_System_FinalRelease_Accidents/FeatureServer/0"
rows = [
  ("PA", 42, "https://services1.arcgis.com/jOy9iZUXBy03ojXb/arcgis/rest/services/CRASH2019_2023/FeatureServer/8", "CRASH_YEAR=2023", "FATAL_COUNT"),
  ("UT", 49, "https://services.arcgis.com/pA2nEVnB6tquxgOW/arcgis/rest/services/Utah_Crash_Locations/FeatureServer/3", "1=1", "number_fatalities"),
  ("ME", 23, "https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/Crashes_Attributes_10_Year_and_Current_Year_Test_View/FeatureServer/44", "ACCIDENT_YEAR=2023", "NO_OF_K_INJ"),
  ("TN", 47, "https://services8.arcgis.com/LXsQ6ODUaTWmnnpV/arcgis/rest/services/TITAN_Dashboard_Crashes__12_03_25_WFL1/FeatureServer/17", "Collision_Year=2023", "Fatality"),
  ("VA", 51, "https://services.arcgis.com/p5v98VHDX9Atv3l7/arcgis/rest/services/Full_Crash/FeatureServer/0", "CRASH_YEAR='2023'", "K_PEOPLE"),
  ("IL", 17, "https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/CRASHES_2023/FeatureServer/0", "1=1", "TotalFatals"),
]
for st, sf, url, where, field in rows:
    try:
        k, e = stat(url, where, field); f, e2 = stat(FARS, f"STATE={sf}", "FATALS")
        print(f"{st} 2023: state source {k} deaths, NHTSA FARS {f}" + (f" ({(k - f) / f:+.1%})" if k and f else "") + (f" errors {e} {e2}" if e or e2 else ""))
    except Exception as ex:
        print(st, "failed", repr(ex)[:120])
