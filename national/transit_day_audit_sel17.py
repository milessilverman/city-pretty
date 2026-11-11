"""Round 8.4 audit of the representative weekday of every bus feed in every built county (transit selections 9 to 13).
Each county's data_<fips>/transit_stops_7_9.meta.json records, per feed, the Wednesday whose 07:00-09:00 bus departures were counted and
the transit selection that chose it (9: nearest Wednesday with service; 10: nearest with 90% of the busiest candidate's whole-day trips;
11: the same by 07:00-09:00 departures; 12: no fixed-date holiday; 13: within 10% of the second-busiest candidate; 14: within 10% of
the highest count two candidates reach, a feed with no Wednesday near today judged on its own last three weeks; 15: 14's day with rail
stops by station; 16: a schedule ends on its last date with bus trips, a stale feed is judged around its last Wednesday with morning
departures, and a current calendar with no service near today has no buses; pipeline/fetch_oc.py _choose_wednesday). This downloads each feed once (the copy the county used: its recorded URL), counts per Wednesday the 07:00-09:00 bus
departures, the day's bus trips and the active services exactly as fetch_oc._gtfs_feed does, and
  - checks that the selection recorded for the county, run on the date it was built (meta "downloaded"), gives the recorded day (a check
    of this script, and of whether the feed has changed since);
  - computes selection 16's day for today and whether that day's services are the recorded day's (then a re-run gives the same buses).
Writes logs/transit_day_audit.json (per county and feed), logs/transit_day_audit.md (summary and every feed whose day changes) and
logs/transit_day_audit_queue.txt: the counties built before selection 16 where some feed's selection-16 day runs other services (or none).
Downloads are untrusted data: read in memory, nothing executed or saved.  usage: python3 -I transit_day_audit.py [<workers, default 2>]"""
import os, sys, json, glob, io, csv, zipfile, collections, datetime, hashlib, time, urllib.request
from multiprocessing import Pool
N = "/home/user/national"
BUS_TYPES = {3, 11} | set(range(700, 800))   # as fetch_oc.BUS_TYPES
HOL = ((1, 1), (6, 19), (7, 4), (11, 11), (12, 24), (12, 25), (12, 31))   # fetch_oc.FIXED_HOLIDAYS
UA = {"User-Agent": "CityPretty-OC-build/1.0 (civic data map)"}
ok8 = lambda v: isinstance(v, str) and len(v) == 8 and v.isdigit()


def get(url):
    last = None
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=900) as r:
                return r.read()
        except Exception as e:
            last = e; time.sleep(5 * (i + 1))
    raise last


def feed_counts(url):
    """per Wednesday of the feed's calendar: 07:00-09:00 bus departures, bus trips, number of active services and a digest of them"""
    try:
        z = zipfile.ZipFile(io.BytesIO(get(url)))
    except Exception as e:
        return url, {"error": repr(e)[:120]}
    names = set(z.namelist()); alias = {}
    for nm in sorted(names):
        base, dot, ext = nm.rsplit("/", 1)[-1].rpartition(".")
        if dot and base and ext.lower() in ("txt", "csv"):
            alias.setdefault(base.lower() + ".txt", nm)
    def rd(n):
        m = n if n in names else alias.get(n.lower())
        if not m:
            return []
        return ({(k or "").strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
                for row in csv.DictReader(io.TextIOWrapper(z.open(m), encoding="utf-8-sig")))
    try:
        bus = set()
        for x in rd("routes.txt"):
            rt = (x.get("route_type") or "").strip()
            if rt.isdigit() and int(rt) in BUS_TYPES and x.get("route_id"):
                bus.add(x["route_id"])
        cal = {c["service_id"]: c for c in rd("calendar.txt") if (c.get("service_id") or "").strip()}
        exc = collections.defaultdict(dict)
        for c in rd("calendar_dates.txt"):
            if ok8(c.get("date")) and (c.get("service_id") or "").strip():
                exc[c["date"]][c["service_id"]] = c.get("exception_type")
        dates = [c[k] for c in cal.values() for k in ("start_date", "end_date") if ok8(c.get(k))] + list(exc)
        if not dates or not bus:
            return url, {"error": "no bus routes" if not bus else "no service dates"}
        lo = datetime.datetime.strptime(min(dates), "%Y%m%d").date(); hi = datetime.datetime.strptime(max(dates), "%Y%m%d").date()
        weds = [lo + datetime.timedelta(days=i) for i in range((hi - lo).days + 1) if (lo + datetime.timedelta(days=i)).weekday() == 2]
        def active(d):
            ds = d.strftime("%Y%m%d")
            on = {sid for sid, c in cal.items() if c.get("wednesday") == "1" and (c.get("start_date") or "0") <= ds <= (c.get("end_date") or "99999999")}
            for sid, t in exc.get(ds, {}).items():
                if t == "1": on.add(sid)
                elif t == "2": on.discard(sid)
            return on
        T = [(t.get("trip_id"), t.get("service_id")) for t in rd("trips.txt") if t.get("route_id") in bus and t.get("trip_id")]
        bs = {sid for _, sid in T}
        last = [cal[x]["end_date"] for x in bs if x in cal and ok8(cal[x].get("end_date"))] + [d for d, m in exc.items() if any(t == "1" and x in bs for x, t in m.items())]
        hi_bus = datetime.datetime.strptime(max(last), "%Y%m%d").date().isoformat() if last else lo.isoformat()
        sid_of = {tid: sid for tid, sid in T}
        am = collections.Counter(); trips = collections.Counter(sid for _, sid in T)
        for st in rd("stop_times.txt"):
            x = sid_of.get(st.get("trip_id"))
            if x is not None and "07:00:00" <= (st.get("departure_time") or st.get("arrival_time") or "").strip().zfill(8) < "09:00:00":
                am[x] += 1
        out = {}
        for d in weds:
            a = active(d)
            out[d.isoformat()] = [sum(am.get(x, 0) for x in a), sum(trips.get(x, 0) for x in a), len(a),
                                  hashlib.sha1("\n".join(sorted(a)).encode()).hexdigest()[:12]]
        return url, {"lo": lo.isoformat(), "hi": hi.isoformat(), "hi_bus": hi_bus, "weds": out}
    except Exception as e:
        return url, {"error": "unreadable: " + repr(e)[:100]}


def choose(sel, W, today, hi_bus=None):
    """the day selection <sel> picks from a feed's Wednesday counts W {date: [am, trips, n_services, digest]} on <today>; for selection 16,
    "stale" (bus trips ended over a year ago: skipped) or "none" (a current calendar with no service near today: no buses)"""
    if sel >= 16 and hi_bus and datetime.date.fromisoformat(hi_bus) < today - datetime.timedelta(days=365):
        return "stale"
    weds = sorted(datetime.date.fromisoformat(d) for d in W)
    am = lambda d: W[d.isoformat()][0]; tr = lambda d: W[d.isoformat()][1]; ns = lambda d: W[d.isoformat()][2]
    dist = lambda d: (abs((d - today).days), d)
    if sel <= 9:
        day = min(weds, key=lambda d: abs((d - today).days))
        return day if ns(day) else max(weds, key=ns)
    f = tr if sel == 10 else am
    hol = lambda d: sel >= 12 and (d.month, d.day) in HOL
    cand = [d for d in weds if abs((d - today).days) <= 21 and not hol(d)] or [d for d in weds if not hol(d)] or weds
    if sel >= 14:
        nh = [d for d in weds if not hol(d)]
        cand = [d for d in nh if abs((d - today).days) <= 21] if nh else list(weds)
        if nh and not cand:
            a = min(([d for d in nh if f(d) > 0] if sel >= 16 else []) or nh, key=dist); cand = [d for d in nh if abs((d - a).days) <= 21]
        within = lambda x, ref: 0.9 * ref <= x <= ref / 0.9
        shared = [f(d) for d in cand if (sel < 17 or f(d) > 0) and sum(1 for e in cand if within(f(e), f(d))) >= 2]
        ref = max(shared) if shared else max(f(d) for d in cand)
        day = min([d for d in cand if within(f(d), ref)] or cand, key=dist)
    elif sel <= 12:
        top = max(f(d) for d in cand)
        day = min((d for d in cand if f(d) >= 0.9 * top), key=dist)
    elif sel == 13:
        lv = sorted((f(d) for d in cand), reverse=True)
        ref = lv[1] if len(lv) > 1 and lv[1] > 0 else lv[0]
        day = min([d for d in cand if 0.9 * ref <= f(d) <= ref / 0.9] or cand, key=dist)
    bus = (lambda d: tr(d) > 0) if sel >= 17 else ns   # selection 17: bus services (bus routes' trips), not every mode's
    if sel >= 16 and not bus(day) and any(abs((d - today).days) <= 21 for d in weds):
        return "none"
    return day if bus(day) else max(weds, key=f)


def main():
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    today = datetime.date.today()
    metas = {}
    for p in sorted(glob.glob(f"{N}/pipeline/data_*/transit_stops_7_9.meta.json")):
        F = p.split("data_")[1][:5]
        m = json.load(open(p))
        if m.get("feeds"):
            metas[F] = m
    urls = sorted({fd["url"] for m in metas.values() if m.get("selection", 0) < 17 for fd in m["feeds"] if fd.get("url")})
    print(time.strftime("%H:%M:%S"), len(metas), "counties,", len(urls), "feeds of counties built before selection 17", flush=True)
    res = {}
    with Pool(workers) as pool:
        for i, (u, r) in enumerate(pool.imap_unordered(feed_counts, urls), 1):
            res[u] = r
            if i % 25 == 0 or "error" in r:
                print(time.strftime("%H:%M:%S"), i, "/", len(urls), u.split("/")[-2] if "mobilitydata" in u else u[:60], r.get("error", ""), flush=True)
    rows, queue, stats = {}, set(), collections.Counter()
    for F, m in sorted(metas.items()):
        sel = m.get("selection", 0)
        if sel >= 17:
            continue
        built = datetime.date.fromisoformat(m.get("downloaded") or today.isoformat())
        out = []
        for fd in m["feeds"]:
            r = res.get(fd.get("url"), {"error": "no url"}); row = {"id": fd["id"], "provider": fd["provider"], "recorded": fd.get("weekday"), "selection": sel}
            if "error" in r:
                row["error"] = r["error"]; stats["feed error"] += 1; out.append(row); continue
            W = r["weds"]
            row["feed_changed"] = [r["lo"], r["hi"]] != fd.get("calendar")
            rep = choose(min(sel, 14) if sel in (14, 15) else sel, W, built); rep = rep if isinstance(rep, str) else rep.isoformat()
            row["reproduced"] = rep == fd.get("weekday")
            s16 = choose(17, W, today, r.get("hi_bus")); s16 = s16 if isinstance(s16, str) else s16.isoformat(); row["selection16"] = s16
            rec = W.get(fd.get("weekday") or "")
            row["same_services"] = bool(rec) and s16 in W and rec[3] == W[s16][3]
            near = sorted(sorted(W, key=lambda d: abs((datetime.date.fromisoformat(d) - today).days))[:8])
            row["wednesdays"] = {d: W[d][0] for d in near}
            row["am_recorded"] = rec[0] if rec else None; row["am_selection16"] = W[s16][0] if s16 in W else 0
            stats["reproduced" if row["reproduced"] else ("not reproduced, feed changed" if row["feed_changed"] else "not reproduced")] += 1
            if not row["same_services"]:
                stats["selection 17 runs other services"] += 1; queue.add(F)
            out.append(row)
        rows[F] = out
    # counties re-built with selection 16 while this ran need nothing more
    for F in list(queue):
        if json.load(open(f"{N}/pipeline/data_{F}/transit_stops_7_9.meta.json")).get("selection", 0) >= 17:
            queue.discard(F); stats["queued but rebuilt with selection 17 meanwhile"] += 1
    json.dump({"today": today.isoformat(), "stats": dict(stats), "counties": rows}, open(f"{N}/logs/transit_day_audit.json", "w"), indent=1)
    open(f"{N}/logs/transit_day_audit_queue.txt", "w").write("".join(F + "\n" for F in sorted(queue)))
    C = json.load(open(f"{N}/data/counties.json"))
    md = [f"# Representative bus weekday audit ({today.isoformat()})", "", f"{len(rows)} counties built before selection 17, {sum(len(v) for v in rows.values())} county feeds, "
          f"{len(urls)} distinct feeds.", ""] + [f"- {k}: {v}" for k, v in sorted(stats.items())] + ["", f"Counties to re-run: {len(queue)}", "",
          "| County | Feed | Recorded (selection) | Selection 17 | 07:00-09:00 departures, recorded -> selection 17 | Nearest Wednesdays |", "|---|---|---|---|---|---|"]
    for F in sorted(rows):
        for row in rows[F]:
            if row.get("error") or row.get("same_services"):
                continue
            md.append(f"| {C.get(F, {}).get('name', F)}, {C.get(F, {}).get('state', '')} ({F}) | {row['provider'][:45]} ({row['id']}) | {row['recorded']} ({row['selection']}) | "
                      f"{row['selection16']} | {row['am_recorded']} -> {row['am_selection16']} | " + ", ".join(f"{d[5:]}: {n}" for d, n in row["wednesdays"].items()) + " |")
    md += ["", "Feeds that could not be read: " + ", ".join(sorted({f"{r['provider']} ({r['id']}): {r['error']}" for v in rows.values() for r in v if r.get("error")})) or "none"]
    md += ["", "Recorded days the audit does not reproduce (feed unchanged): " + (", ".join(f"{F} {r['id']} {r['recorded']}" for F, v in rows.items() for r in v
                                                                                       if r.get("reproduced") is False and not r.get("feed_changed")) or "none")]
    open(f"{N}/logs/transit_day_audit.md", "w").write("\n".join(md) + "\n")
    print(time.strftime("%H:%M:%S"), dict(stats), "| queue:", len(queue))


if __name__ == "__main__":
    main()
