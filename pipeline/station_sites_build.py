"""Write app/data/station_sites/<fips>.json (one per county, under 300 KB) and index.json from the checked candidates.
Usage: python3 pipeline/station_sites_build.py <work dir> [out dir]
Reads <work>/parcels.json (list of {rec, info}) and <work>/anchors.json. A county file keeps the largest sites first; any sites
left out to stay under the size limit are counted in the file ("leftOut") and in the index."""
import json, os, sys, time
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIMIT = 290_000
RULES = {"minAcres": 0.5, "builtShareMax": 0.20, "parcelAreaRatioOk": [0.5, 2.0], "searchRadiusMiles": {"pipeline_station": 0.5, "existing_station": 0.5, "corridor_stop_city": 1.0},
         "tags": {"surface_parking": "amenity=parking with parking=surface or no parking tag, no building tag",
                  "vacant_or_brownfield": "landuse=brownfield or landuse=greenfield or vacant=yes",
                  "golf_course": "leisure=golf_course"},
         "notBuilt": "building=roof, carport and canopy polygons are not counted as buildings",
         "notDone": "Large single-storey retail with big parking is not listed: no OpenStreetMap tag defines it without joining a store to a lot by guesswork."}


def compact(rec, src_idx, anchor=None):
    p = rec.get("parcel")
    o = {"id": f"{rec['osmType']}/{rec['osmId']}", "k": rec["kind"], "tag": rec["osmTags"], "ac": rec["acres"], "pt": rec["pt"], "bs": rec["builtShare"],
         "near": {"n": rec["near"]["name"], "c": rec["near"]["cls"], "d": rec["near"]["distM"], "e": rec["near"]["edgeDistM"]}, "s": src_idx}
    if rec["near"].get("line"):
        o["near"]["ln"] = rec["near"]["line"]
    if anchor is not None and rec["near"]["cls"] == "pipeline_station" and not anchor.get("locationVerified"):
        o["near"]["u"] = 1   # the project's own record marks this stop location as unverified or illustrative
    if rec.get("access"):
        o["acc"] = rec["access"]
    if rec.get("name"):
        o["nm"] = rec["name"]
    if rec.get("alsoNear"):
        o["also"] = [f"{a['name']} ({a['cls']}, {a['distM']} m)" for a in rec["alsoNear"]]
    if p:
        q = {k: v for k, v in (("id", p.get("parcelId")), ("own", p.get("owner")), ("ot", p.get("ownerType")), ("oc", p.get("ownerTypeCode")), ("uc", p.get("useCode")), ("ut", p.get("useText")), ("zn", p.get("zoning")),
                               ("lv", p.get("landValue")), ("tv", p.get("totalValue")), ("pa", round(p["parcelM2"] / 4046.8564224, 2) if p.get("parcelM2") else None), ("r", p.get("areaRatio"))) if v is not None}
        if p.get("mismatch"):
            q["mm"] = True
        q["d"] = p["retrieved"]
        o["p"] = q
    else:
        o["pw"] = rec.get("parcelWhy")
    return o


def main():
    work = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "app/data/station_sites")
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        os.remove(os.path.join(out, f))
    data = json.load(open(os.path.join(work, "parcels.json")))
    anchors = json.load(open(os.path.join(work, "anchors.json")))
    reg = json.load(open(os.path.join(ROOT, "national/data/counties.json")))
    svcs = {s["name"]: s for s in json.load(open(os.path.join(ROOT, "app/data/parcel_services.json")))["services"]}
    abyid = {a["id"]: a for a in anchors["anchors"]}
    by = defaultdict(list)
    for d in data:
        by[d["rec"]["near"]["fips"]].append(d)
    caps = json.load(open(os.path.join(work, "cap_counts.json")))
    fmap = json.load(open(os.path.join(work, "field_map.json"))) if os.path.exists(os.path.join(work, "field_map.json")) else {}
    index = {"built": time.strftime("%Y-%m-%d"), "rules": RULES, "counties": {}, "scope": anchors["notes"]}
    today = time.strftime("%Y-%m-%d")
    for fips, items in sorted(by.items()):
        items.sort(key=lambda d: -d["rec"]["acres"])
        srcs, sidx = [], {}
        for d in items:
            i = d["info"]; k = (i["source"], i["url"], i["data_timestamp"])
            if k not in sidx:
                sidx[k] = len(srcs); srcs.append({"source": i["source"], "url": i["url"], "dataTimestamp": i["data_timestamp"], "backend": i["backend"]})
        a0 = next(a for a in anchors["anchors"] if a["fips"] == fips)
        svc = svcs.get(a0["parcelService"]) if a0["parcelService"] else None
        recs = [(d, compact(d["rec"], sidx[(d["info"]["source"], d["info"]["url"], d["info"]["data_timestamp"])], abyid.get(d["rec"]["near"]["id"]))) for d in items]
        head = {"fips": fips, "county": (reg.get(fips) or {}).get("name"), "state": a0["state"], "built": today, "sources": srcs, "rules": "see index.json rules",
                "parcelService": ({"name": svc["name"], "url": svc["url"]} if svc else ({"name": a0["parcelService"], "url": None} if a0["parcelService"] else None)),
                "parcelFields": fmap.get(fips), "total": caps[fips]["found"], "leftOut": 0}
        keep = recs
        while True:
            head["leftOut"] = caps[fips]["found"] - len(keep)
            doc = dict(head, sites=[c for _, c in keep])
            text = json.dumps(doc, separators=(",", ":"), ensure_ascii=False)
            if len(text.encode()) <= LIMIT:
                break
            keep = keep[:int(len(keep) * 0.95)]
        open(os.path.join(out, f"{fips}.json"), "w").write(text)
        kinds = Counter(c["k"] for _, c in keep); cls = Counter(c["near"]["c"] for _, c in keep)
        pm = sum(1 for _, c in keep if c.get("p")); mm = sum(1 for _, c in keep if c.get("p", {}).get("mm"))
        index["counties"][fips] = {"name": head["county"], "file": f"{fips}.json", "bytes": len(text.encode()), "sites": len(keep), "leftOut": head["leftOut"], "byKind": dict(kinds), "byNearestClass": dict(cls),
                                   "parcelMatched": pm, "parcelAreaMismatch": mm, "parcelService": head["parcelService"]["name"] if head["parcelService"] else None}
    open(os.path.join(out, "index.json"), "w").write(json.dumps(index, separators=(",", ":"), ensure_ascii=False))
    print(len(index["counties"]), "county files;", sum(c["sites"] for c in index["counties"].values()), "sites;", sum(c["leftOut"] for c in index["counties"].values()), "left out for size")


if __name__ == "__main__":
    main()
