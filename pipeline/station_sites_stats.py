"""Counts for docs/audit/station-sites-2026-11-22.md, from the work files and the written county files.
Usage: python3 pipeline/station_sites_stats.py <work dir> [out json]"""
import json, os, sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "app/data/station_sites")


def main():
    work = sys.argv[1]
    out_fn = sys.argv[2] if len(sys.argv) > 2 else os.path.join(work, "stats.json")
    data = json.load(open(os.path.join(work, "parcels.json")))
    caps = json.load(open(os.path.join(work, "cap_counts.json")))
    anchors = json.load(open(os.path.join(work, "anchors.json")))
    index = json.load(open(os.path.join(D, "index.json")))
    reg = json.load(open(os.path.join(ROOT, "national/data/counties.json")))
    S = {"found_total": sum(c["found"] for c in caps.values()), "queried_total": len(data), "files_total": sum(c["sites"] for c in index["counties"].values())}
    # queried records (the largest 800 per county): by kind, nearest class, any class
    S["queried_by_kind"] = Counter(d["rec"]["kind"] for d in data)
    S["queried_by_nearest_class"] = Counter(d["rec"]["near"]["cls"] for d in data)
    S["queried_by_any_class"] = Counter(c for d in data for c in d["rec"]["classes"])
    S["acres_total"] = round(sum(d["rec"]["acres"] for d in data))
    S["acres_by_kind"] = {k: round(sum(d["rec"]["acres"] for d in data if d["rec"]["kind"] == k)) for k in S["queried_by_kind"]}
    # parcel
    pq = [d["rec"] for d in data]
    got = [r for r in pq if r.get("parcel")]
    ok = [r for r in got if not r["parcel"]["mismatch"]]
    S["parcel"] = {"queried": len(pq), "parcel_found": len(got), "found_rate": round(len(got) / len(pq), 3), "no_parcel_at_point": sum(1 for r in pq if not r.get("parcel") and "no parcel" in (r.get("parcelWhy") or "")),
                   "service_error": sum(1 for r in pq if not r.get("parcel") and "did not answer" in (r.get("parcelWhy") or "")),
                   "area_ok_0.5_to_2": len(ok), "area_mismatch": len(got) - len(ok), "mismatch_rate_of_found": round((len(got) - len(ok)) / max(1, len(got)), 3),
                   "parcel_larger_than_2x": sum(1 for r in got if (r["parcel"]["areaRatio"] or 0) > 2), "parcel_smaller_than_half": sum(1 for r in got if r["parcel"]["areaRatio"] and r["parcel"]["areaRatio"] < 0.5),
                   "with_owner_type": sum(1 for r in got if r["parcel"]["ownerType"]), "with_owner_name_stored": sum(1 for r in got if r["parcel"]["owner"]), "with_land_value": sum(1 for r in got if r["parcel"]["landValue"] is not None),
                   "with_zoning": sum(1 for r in got if r["parcel"]["zoning"]), "with_use": sum(1 for r in got if r["parcel"]["useCode"] or r["parcel"]["useText"])}
    byservice = defaultdict(lambda: Counter())
    for r in pq:
        p = r.get("parcel")
        nm = (p or {}).get("service") or next((a["parcelService"] for a in anchors["anchors"] if a["id"] == r["near"]["id"]), None)
        c = byservice[nm]
        c["queried"] += 1
        if p:
            c["found"] += 1; c["mismatch"] += 1 if p["mismatch"] else 0
            for k, f in (("owner_type", "ownerType"), ("land_value", "landValue"), ("zoning", "zoning"), ("use", "useCode")):
                if p.get(f) is not None or (k == "use" and p.get("useText")):
                    c[k] += 1
    S["by_service"] = {k: dict(v) for k, v in byservice.items()}
    # by county, from the files
    S["counties"] = {}
    for fips, c in index["counties"].items():
        S["counties"][fips] = {"name": c["name"], "found": caps[fips]["found"], "in_file": c["sites"], "left_out": c["leftOut"], "by_kind": c["byKind"], "by_nearest_class": c["byNearestClass"], "bytes": c["bytes"],
                               "parcel_service": c["parcelService"], "parcel_matched": c["parcelMatched"], "parcel_area_mismatch": c["parcelAreaMismatch"]}
    # Austin light rail (the local project's stations), five largest
    a = json.load(open(os.path.join(D, "48453.json")))
    top = [s for s in a["sites"] if s["near"]["c"] == "pipeline_station"][:5]
    S["austin_top5"] = top
    json.dump(S, open(out_fn, "w"), indent=1, default=dict)
    print(json.dumps({k: v for k, v in S.items() if k not in ("counties", "by_service", "austin_top5")}, indent=1, default=dict))


if __name__ == "__main__":
    main()
