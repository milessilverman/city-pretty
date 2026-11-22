"""Sample re-check of the station-site files (docs/audit/station-sites-2026-11-22.md).
  parcel: 30 random records that have a parcel record are asked again from the county's parcel service (fresh query, no cache);
          parcel id, land use, owner type, zoning, parcel area and (where not withheld) land value must equal what the file holds.
  osm:    20 random records are looked up again by element id in the main OpenStreetMap database (api.openstreetmap.org, a second
          source apart from the extract / Overpass mirror the candidates came from): the element must exist and its tags must
          still give the same kind and the same matched tag text.
Usage: python3 pipeline/station_sites_recheck.py [out json]    (seed fixed so the sample can be repeated)"""
import json, os, random, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import station_sites_parcels as P
import station_sites_osm as O

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "app/data/station_sites")


def main():
    out_fn = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "data/backtests/station_sites_recheck_2026-11-22.json")
    reg = {s["name"]: s for s in json.load(open(os.path.join(ROOT, "app/data/parcel_services.json")))["services"]}
    recs = []
    for fn in sorted(os.listdir(D)):
        if fn == "index.json":
            continue
        doc = json.load(open(os.path.join(D, fn)))
        for s in doc["sites"]:
            recs.append((doc, s))
    rnd = random.Random(20261122)
    withp = [r for r in recs if r[1].get("p")]
    ps = rnd.sample(withp, min(30, len(withp)))
    os_ = rnd.sample(recs, min(20, len(recs)))
    today = time.strftime("%Y-%m-%d")
    res = {"made": today, "seed": 20261122, "population": {"records": len(recs), "with_parcel": len(withp)}, "parcel": [], "osm": []}
    for doc, s in ps:
        ps_ = doc["parcelService"]
        svc = reg.get(ps_["name"]) if ps_ else None
        if doc["fips"] == "06037":
            svc = P.service_for("06037", list(reg.values()))
        if doc["fips"] == "06059":
            svc = P.service_for("06059", [])
        r = P.lookup(svc, s["pt"][0], s["pt"][1])
        row = {"osm": s["id"], "fips": doc["fips"], "service": svc["name"], "result": None, "diffs": []}
        if "attrs" not in r:
            row["result"] = "no answer: " + json.dumps({k: v for k, v in r.items() if k != "attrs"})[:120]; res["parcel"].append(row); continue
        now = P.facts(svc, r, s["ac"] * O.ACRE, today)
        h = s["p"]
        chk = [("id", now.get("parcelId"), h.get("id")), ("uc", now.get("useCode"), h.get("uc")), ("ut", now.get("useText"), h.get("ut")), ("zn", now.get("zoning"), h.get("zn")), ("lv", now.get("landValue"), h.get("lv")),
               ("tv", now.get("totalValue"), h.get("tv")), ("ot", now.get("ownerType"), h.get("ot")), ("own", now.get("owner"), h.get("own"))]
        pa = round(now["parcelM2"] / 4046.8564224, 2) if now.get("parcelM2") else None
        chk.append(("pa", pa, h.get("pa")))
        for k, a, b in chk:
            same = (a == b) if k != "pa" else (a == b or (a is not None and b is not None and abs(a - b) <= 0.02 * max(a, b)))
            if not same:
                row["diffs"].append({"field": k, "now": a, "file": b})
        row["result"] = "same" if not row["diffs"] else "differs"
        res["parcel"].append(row)
    for doc, s in os_:
        typ, oid = s["id"].split("/")
        row = {"osm": s["id"], "kind_file": s["k"], "tag_file": s["tag"], "result": None}
        j = None
        for i in range(3):
            try:
                j = json.loads(urllib.request.urlopen(urllib.request.Request(f"https://api.openstreetmap.org/api/0.6/{typ}/{oid}.json", headers=P.UA), timeout=40).read())
                break
            except urllib.error.HTTPError as e:
                row["result"] = f"HTTP {e.code}"; break
            except Exception as e:
                row["result"] = "error " + str(e)[:60]; time.sleep(3)
        time.sleep(1.1)
        if j:
            el = j["elements"][0]
            if el.get("visible") is False:
                row["result"] = "deleted"
            else:
                c = O.classify(el.get("tags") or {})
                row["result"] = "same" if c and c[0] == s["k"] and c[1] == s["tag"] else "tags differ"
                row["tags_now"] = {k: v for k, v in (el.get("tags") or {}).items() if k in ("amenity", "parking", "landuse", "vacant", "leisure", "building", "access")}
                row["version"] = el.get("version"); row["timestamp"] = el.get("timestamp")
                if typ == "way":   # the area again, by a different method: the way's current nodes and a geodesic area (pyproj), against the file's acres
                    try:
                        from pyproj import Geod
                        jf = json.loads(urllib.request.urlopen(urllib.request.Request(f"https://api.openstreetmap.org/api/0.6/way/{oid}/full.json", headers=P.UA), timeout=40).read())
                        nodes = {e["id"]: (e["lon"], e["lat"]) for e in jf["elements"] if e["type"] == "node"}
                        pts = [nodes[i] for i in el["nodes"]]
                        a_m2, _ = Geod(ellps="WGS84").polygon_area_perimeter([p[0] for p in pts], [p[1] for p in pts])
                        row["acres_now_geodesic"] = round(abs(a_m2) / 4046.8564224, 2); row["acres_file"] = s["ac"]
                        row["area_within_2pct"] = abs(row["acres_now_geodesic"] - s["ac"]) <= 0.02 * s["ac"]
                    except Exception as ex:
                        row["area_check"] = "not done: " + str(ex)[:60]
                    time.sleep(1.1)
        res["osm"].append(row)
    n = lambda L, v: sum(1 for x in L if x["result"] == v)
    res["summary"] = {"parcel_checked": len(res["parcel"]), "parcel_same": n(res["parcel"], "same"), "parcel_differs": n(res["parcel"], "differs"), "parcel_no_answer": sum(1 for x in res["parcel"] if str(x["result"]).startswith("no answer")),
                      "osm_checked": len(res["osm"]), "osm_same": n(res["osm"], "same"), "osm_tags_differ": n(res["osm"], "tags differ"), "area_checked_ways": sum(1 for x in res["osm"] if "area_within_2pct" in x), "area_within_2pct": sum(1 for x in res["osm"] if x.get("area_within_2pct")), "osm_deleted_or_missing": sum(1 for x in res["osm"] if x["result"] in ("deleted",) or str(x["result"]).startswith("HTTP"))}
    os.makedirs(os.path.dirname(out_fn), exist_ok=True)
    json.dump(res, open(out_fn, "w"), indent=1)
    print(json.dumps(res["summary"]))


if __name__ == "__main__":
    main()
