"""probe each parcel service from the round-8.7 research at a dense block group of a built county in its state (or the named county)"""
import json, subprocess, os, sys, glob, time, urllib.parse
from shapely.geometry import shape
R = json.load(open("/home/user/w5/round87/parcels_research.json"))["sources"]
C = json.load(open("/home/user/national/data/counties.json"))
ST = {"North Carolina": "NC", "Florida": "FL", "Wisconsin": "WI", "Massachusetts": "MA", "Utah": "UT", "Montana": "MT", "Texas": "TX", "Washington": "WA",
      "New Jersey": "NJ", "Connecticut": "CT", "Maryland": "MD", "Vermont": "VT", "New York": "NY", "Colorado": "CO", "Indiana": "IN", "Minnesota": "MN",
      "Virginia": "VA", "West Virginia": "WV", "Delaware": "DE", "Hawaii": "HI", "Arkansas": "AR", "District of Columbia": "DC", "Maine": "ME",
      "New Hampshire": "NH", "Ohio": "OH", "North Dakota": "ND", "Wyoming": "WY", "Idaho": "ID", "Nebraska": "NE", "Rhode Island": "RI", "Tennessee": "TN"}
COUNTY = {"New York City": "36061", "Maricopa": "04013", "Cook": "17031", "San Diego": "06073", "Orange County, CA": "06059", "Franklin County, OH": "39049",
          "Fulton": "13121", "Allegheny": "42003", "Clark County, NV": "32003", "Los Angeles": "06037", "Philadelphia": "42101"}
built = {p.split("data_")[1][:5] for p in glob.glob("/home/user/national/pipeline/data_*/bg.geojson")}
def test_point(fips):
    j = json.load(open(f"/home/user/national/pipeline/data_{fips}/bg.geojson")) if fips in built else None
    if not j: return None
    M = json.load(open(f"/home/user/national/pipeline/data_{fips}/metrics.json"))["metrics"] if os.path.exists(f"/home/user/national/pipeline/data_{fips}/metrics.json") else {}
    best = max(j["features"], key=lambda f: ((M.get(f["properties"].get("GEOID")) or {}).get("homes") or 0) / max(shape(f["geometry"]).area, 1e-9))
    p = shape(best["geometry"]).representative_point(); return p.x, p.y, best["properties"].get("GEOID")
out = []
for s in R:
    if s["kind"] not in ("parcels_statewide", "parcels_county"): continue
    scope = s["state_or_scope"]; url = s["url"].split("?")[0].rstrip("/")
    fips = next((v for k, v in COUNTY.items() if k in scope), None) if s["kind"] == "parcels_county" else None
    if not fips:
        st = next((v for k, v in ST.items() if scope.startswith(k)), None)
        cands = sorted([f for f in built if C.get(f, {}).get("state") == st], key=lambda f: -os.path.getsize(f"/home/user/national/pipeline/data_{f}/bg.geojson"))
        fips = cands[0] if cands else None
    rec = {"scope": scope, "kind": s["kind"], "url": url, "fips": fips}
    tp = test_point(fips) if fips else None
    if not tp or "carto.com" in url or "comptroller.tn.gov" in url:
        rec["result"] = "not probed (" + ("no built county" if not tp else "not an ArcGIS layer") + ")"; out.append(rec); continue
    if url.split("/")[-1] in ("MapServer", "FeatureServer"): url += "/0"; rec["url"] = url
    q = {"geometry": f"{tp[0]-0.0002},{tp[1]-0.0002},{tp[0]+0.0002},{tp[1]+0.0002}", "geometryType": "esriGeometryEnvelope", "inSR": "4326", "spatialRel": "esriSpatialRelIntersects", "outFields": "*", "returnGeometry": "false", "f": "json"}
    t0 = time.time()
    hf = "/tmp/claude-0/-home-user-city-pretty/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad/parcelprobe/h.txt"
    r = subprocess.run(["curl", "-sS", "-m", "45", "-D", hf, "-H", "Origin: https://milessilverman.github.io", "-A", "Mozilla/5.0 (compatible; city-pretty/1.0)", url + "/query?" + urllib.parse.urlencode(q)], capture_output=True, text=True)
    dt = round(time.time() - t0, 1)
    head = open(hf, errors="replace").read() if os.path.exists(hf) else ""; body = r.stdout
    acao = next((l.split(":", 1)[1].strip() for l in head.splitlines() if l.lower().startswith("access-control-allow-origin")), None)
    try:
        d = json.loads(body); feats = d.get("features") or []; err = d.get("error")
    except Exception:
        d, feats, err = {}, [], body[:120]
    rec.update({"point": tp, "secs": dt, "acao": acao, "n": len(feats), "error": err, "fields": list((feats[0]["attributes"] if feats else {}).keys())[:60], "sample": (feats[0]["attributes"] if feats else None)})
    out.append(rec)
    print(f"{scope[:28]:28s} {fips} n={len(feats)} acao={acao} {dt}s err={str(err)[:60]}", flush=True)
json.dump(out, open(sys.argv[1], "w"), indent=1, default=str)
