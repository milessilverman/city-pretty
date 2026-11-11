"""Round 8.5: give every county bundle the final wording of two sources rows (text only), where an older build left an earlier one:
  - "GTFS feeds": that untimed stops are interpolated (transit selection 17; every county served by a feed with untimed stops was re-run
    with it, logs/untimed_scan.json + rebundle85b);
  - "GTFS rail stops": rule 2 as the code has it (a network that runs no rail routes in a current feed here: audit finding 19), the
    not-open (v7) and not-served (v8) exclusions, the added route types (findings 10, 21) and the 300 m name / Amtrak merge (v4).
Each bundle is decoded, the exact old strings are replaced, the result must differ from the original only in those strings, and the
file is replaced atomically. Writes logs/sources_text85.json (per file: variants found, sha256 before and after).
usage: python3 sources_text85.py [--dry]"""
import glob, gzip, base64, json, hashlib, os, sys
N = "/home/user/national"
HEAD = "which OpenStreetMap rail stations are served, for the distance to rail: a station counts where a rail route stops within 400 m; "
RAIL_FINAL = HEAD + ("so does a named subway, light-rail or monorail station of a network that runs no rail routes in a current feed here, or a station newer "
                     "than its operator's out-of-date feed, unless OpenStreetMap marks it under construction, proposed, disused or abandoned or its operator's "
                     "current schedule omits the line; heritage, excursion, airport and unserved stations are left out, and a subway, commuter, intercity or "
                     "monorail stop with no station within 150 m (300 m for a same-named station or an Amtrak stop) is added")
RAIL_OLD = {
 "pre85": HEAD + ("so does a named subway, light-rail or monorail station of a network with no current feed here, or a station newer than its operator's "
                  "out-of-date feed; heritage, excursion, airport and unserved stations are left out, and a rail stop with no station within 150 m is added"),
 "85_1553": HEAD + ("so does a named subway, light-rail or monorail station of a network with no current feed here, or a station newer than its operator's "
                    "out-of-date feed; heritage, excursion, airport and unserved stations are left out, and a rail stop with no station within 150 m (300 m for a "
                    "same-named station or an Amtrak stop) is added"),
 "85_1630": HEAD + ("so does a named subway, light-rail or monorail station of a network that runs no rail routes in a current feed here, or a station newer "
                    "than its operator's out-of-date feed, unless OpenStreetMap marks it under construction, proposed, disused or abandoned; heritage, excursion, "
                    "airport and unserved stations are left out, and a subway, commuter, intercity or monorail stop with no station within 150 m (300 m for a "
                    "same-named station or an Amtrak stop) is added"),
}
BUS_OLD = "weekday 7-9 am bus departures per stop on one weekday per feed, each bus route counted once: "
BUS_FINAL = "weekday 7-9 am bus departures per stop on one weekday per feed, each bus route counted once, stops listed without a time interpolated between the trip's timed stops: "
dry = "--dry" in sys.argv
for x in [RAIL_FINAL, BUS_FINAL, BUS_OLD, *RAIL_OLD.values()]:
    assert '"' not in x and "\\" not in x and all(ord(c) >= 32 for c in x)
files = sorted(glob.glob(f"{N}/pipeline/data_*/bundle-oc.b64")) + [f"{N}/oc_regress/bundle-oc.b64"]
rep, n_changed = {}, 0
for p in files:
    raw = open(p).read().strip()
    s = gzip.decompress(base64.b64decode(raw)).decode("utf-8")
    t = s; found = []
    for k, old in RAIL_OLD.items():
        if old in t:
            t = t.replace(old, RAIL_FINAL); found.append("rail " + k)
    if BUS_OLD in t:
        t = t.replace(BUS_OLD, BUS_FINAL); found.append("bus")
    final_ok = (RAIL_FINAL in t or HEAD not in t)
    if t != s:
        # the edit is text only: with every old and final variant replaced by a marker, the two texts are identical (the strings hold
        # no character JSON escapes, so the replacement cannot break the JSON)
        back = t.replace(RAIL_FINAL, "\0R").replace(BUS_FINAL, "\0B")
        orig = s.replace(RAIL_FINAL, "\0R").replace(BUS_FINAL, "\0B")
        for old in RAIL_OLD.values(): orig = orig.replace(old, "\0R")
        orig = orig.replace(BUS_OLD, "\0B")
        assert back == orig, p
        out = base64.b64encode(gzip.compress(t.encode("utf-8"), mtime=0)).decode()
        if not dry:
            tmp = p + ".tmp85"; open(tmp, "w").write(out); os.replace(tmp, p)
        n_changed += 1
    rep[p.replace(N + "/", "")] = {"found": found, "final_rail_text": final_ok, "sha_before": hashlib.sha256(raw.encode()).hexdigest()[:16],
                                   "sha_after": hashlib.sha256((out if t != s else raw).encode()).hexdigest()[:16]}
if not dry:
    json.dump(rep, open(f"{N}/logs/sources_text85.json", "w"), indent=0)
import collections
print(len(files), "bundles;", n_changed, "changed" + (" (dry run)" if dry else ""), dict(collections.Counter(" + ".join(v["found"]) or "none" for v in rep.values())),
      "| without the final rail text:", [k for k, v in rep.items() if not v["final_rail_text"]][:5])
