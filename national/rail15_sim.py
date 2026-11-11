"""Simulate the selection-15 rail-stop change on every built county without rebuilding: for each rail feed in a county's
transit_rail_stops.json, read today's hosted copy and map each rail stop to its parent station's name and id, dropping stops with no
boarding or alighting (every rail stop_time pickup_type 1 and drop_off_type 1) and employee-only stops. Then replay the additions of
metrics_oc.confirm_rail_stations with the old entries and with the new ones (platforms of one parent grouped at their centre), against the
county's kept stations (rail_confirm.json), and check that each kept station a stop confirmed still has a stop within 400 m.
usage: python3 -I rail15_sim.py <out.json>"""
import sys, json, glob, io, csv, zipfile, collections, re, math, urllib.request, time
from multiprocessing import Pool
N = "/home/user/national"
RAIL = {0, 1, 2, 5, 7, 12} | set(range(100, 118)) | set(range(400, 406)) | set(range(900, 907)) | {1400}
UA = {"User-Agent": "CityPretty-OC-build/1.0 (civic data map)"}


def get(url):
    last = None
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=900) as r:
                return r.read()
        except Exception as e:
            last = e; time.sleep(5 * (i + 1))
    raise last


def feed_map(fid):
    url = f"https://storage.googleapis.com/mobilitydata-datasets-prod/{'mdb-' + fid if fid.isdigit() else fid}/latest.zip"
    try:
        z = zipfile.ZipFile(io.BytesIO(get(url)))
    except Exception as e:
        return fid, {"error": repr(e)[:100]}
    names = set(z.namelist()); alias = {}
    for nm in sorted(names):
        base, dot, ext = nm.rsplit("/", 1)[-1].rpartition(".")
        if dot and base and ext.lower() in ("txt", "csv"):
            alias.setdefault(base.lower() + ".txt", nm)
    def rd(n):
        m = n if n in names else alias.get(n.lower())
        return [] if not m else ({(k or "").strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
                                 for row in csv.DictReader(io.TextIOWrapper(z.open(m), encoding="utf-8-sig")))
    try:
        rt = {x["route_id"] for x in rd("routes.txt") if (x.get("route_type") or "").strip().isdigit() and int(x["route_type"]) in RAIL and x.get("route_id")}
        trips = {t["trip_id"] for t in rd("trips.txt") if t.get("route_id") in rt and t.get("trip_id")}
        used, board = set(), set()
        for st in rd("stop_times.txt"):
            if st.get("trip_id") in trips:
                sid = st.get("stop_id"); used.add(sid)
                if not ((st.get("pickup_type") or "0").strip() == "1" and (st.get("drop_off_type") or "0").strip() == "1"):
                    board.add(sid)
        S = {x.get("stop_id"): x for x in rd("stops.txt")}
        out = {}
        for sid in used:
            x = S.get(sid)
            if not x or not x.get("stop_lat") or not x.get("stop_lon"):
                continue
            nm = x.get("stop_name") or ""; pid = (x.get("parent_station") or "").strip(); par = S.get(pid) if pid else None
            pnm = (par or {}).get("stop_name") or ""
            keep = sid in board and not re.search(r"employees? only", nm + " " + pnm, re.I)
            k = f"{round(float(x['stop_lon']), 6)},{round(float(x['stop_lat']), 6)},{nm}"
            out[k] = [pnm or nm, pid if par else "", keep, "no boarding" if sid not in board else ("employees only" if not keep else "")]
        return fid, {"stops": out}
    except Exception as e:
        return fid, {"error": "unreadable " + repr(e)[:80]}


def additions(entries, kept, KX, KY, new):
    tram = lambda t: t in (0, 5, 7, 1400) or 900 <= t <= 906
    pts = [(lon * KX, lat * KY) for lon, lat in kept]
    cand = entries
    if new:
        grp = collections.OrderedDict(); cand = []
        for p in entries:
            if len(p) > 6 and p[6]:
                grp.setdefault((str(p[3]), p[6]), []).append(p)
            else:
                cand.append(p)
        for (fid, pid), ps in grp.items():
            nt = [p for p in ps if not tram(p[4])]; b = min(nt or ps, key=lambda p: p[4])
            cand.append([sum(p[0] for p in ps) / len(ps), sum(p[1] for p in ps) / len(ps), ps[0][2], ps[0][3], b[4], b[5], pid])
    out = []
    for lon, lat, name, fid, ty, *ag in sorted(cand, key=lambda p: (p[4], str(p[3]), p[2], p[0], p[1])):
        if tram(ty):
            continue
        if re.search(r"\byard\b", name or "", re.I) and not re.search(r"navy yard", name or "", re.I):
            continue
        x, y = lon * KX, lat * KY
        if any((x - px) ** 2 + (y - py) ** 2 <= 150.0 ** 2 for px, py in pts):
            continue
        pts.append((x, y)); out.append((round(round(lon, 6), 5), round(round(lat, 6), 5), name))   # as rail_confirm.json stores them (6 decimals), then 5
    return out


def main():
    fids = sorted({str(e[3]) for p in glob.glob(f"{N}/pipeline/data_*/transit_rail_stops.json") for e in json.load(open(p))})
    with Pool(3) as pool:
        M = dict(pool.map(feed_map, fids))
    print(len(M), "feeds;", sum(1 for v in M.values() if "error" in v), "unreadable:", {k: v["error"] for k, v in M.items() if "error" in v})
    C = json.load(open(f"{N}/data/counties.json"))
    res = {}
    for p in sorted(glob.glob(f"{N}/pipeline/data_*/transit_rail_stops.json")):
        F = p.split("data_")[1][:5]
        rc = f"{N}/pipeline/data_{F}/rail_confirm.json"
        try:
            R = json.load(open(rc))
        except Exception:
            continue
        old = json.load(open(p)); new = []; unmatched = removed = renamed = 0; notes = []
        for e in old:
            fm = M.get(str(e[3]), {})
            if "error" in fm:
                unmatched += 1; new.append(list(e)); continue
            m = fm["stops"].get(f"{round(e[0], 6)},{round(e[1], 6)},{e[2]}")
            if m is None:
                unmatched += 1; new.append(list(e)); continue
            if not m[2]:
                removed += 1; notes.append(f"removed {e[2]!r} ({e[3]}, {m[3]})"); continue
            renamed += m[0] != e[2]
            new.append([e[0], e[1], m[0], e[3], e[4], e[5] if len(e) > 5 else "", m[1]])
        LAT0 = round(C[F]["lat"], 2); KX = 111320.0 * math.cos(math.radians(LAT0)); KY = 110540.0
        kept = [(x[0], x[1]) for k in ("gtfs", "mode", "agency") for x in R.get(k, [])]
        a_old = additions([list(e) for e in old], kept, KX, KY, False); a_new = additions(new, kept, KX, KY, True)
        lost = []
        for x in R.get("gtfs", []):
            if x[3] is None or "confirm_by" in (x[4] or {}):
                continue
            if not any(math.hypot((x[0] - e[0]) * KX, (x[1] - e[1]) * KY) <= 400.0 for e in new):
                lost.append(x[2])
        cur = sorted((round(a[0], 5), round(a[1], 5), a[2]) for a in R.get("added", []))
        res[F] = {"county": C[F]["name"], "st": C[F].get("state"), "unmatched": unmatched, "removed": removed, "renamed": renamed,
                  "replay_matches_file": sorted(a_old) == cur, "added_old": len(a_old), "added_new": len(a_new),
                  "added_changed": sorted(a_old) != sorted(a_new), "confirm_lost": lost, "notes": notes[:6],
                  "gone": sorted(set(a_old) - set(a_new))[:12], "new": sorted(set(a_new) - set(a_old))[:12]}
    json.dump(res, open(sys.argv[1], "w"), indent=1)
    aff = [F for F, r in res.items() if r["added_changed"] or r["confirm_lost"]]
    print(len(res), "counties;", len(aff), "affected;", sum(1 for r in res.values() if not r["replay_matches_file"]), "replays differ from the file;",
          sum(r["unmatched"] for r in res.values()), "entries unmatched (feed changed since build)")
    for F in aff:
        r = res[F]
        print(F, r["county"], r["st"], f"added {r['added_old']} -> {r['added_new']}", "| lost:", r["confirm_lost"], "| removed:", r["removed"], "renamed:", r["renamed"],
              "| gone:", [g[2] for g in r["gone"]][:5], "| new:", [g[2] for g in r["new"]][:5])
    open(sys.argv[1].replace(".json", "_queue.txt"), "w").write("".join(F + "\n" for F in aff))


if __name__ == "__main__":
    main()
