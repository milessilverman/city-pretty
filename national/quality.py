"""Quality summary for every county built by the national pipeline: block groups vs the Census ACS geography file, crime agencies
matched, Tree Equity coverage, crash geocoding, site suggestions. Writes logs/quality.json and prints flagged counties."""
import os, re, json, glob, collections
HERE = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(os.path.join(HERE, "data", "counties.json")))
acs = collections.Counter()
for line in open(os.path.join(HERE, "cache", "acs_geos.txt"), encoding="utf-8", errors="replace"):
    i = line.find("1500000US")
    if i >= 0: acs[line[i + 9:i + 14]] += 1
out = {}
# every county with a build log or a pipeline bundle (San Diego was first built by the early sd_data path and has no build_06073.log)
FIPS = sorted({re.search(r"build_(\d{5})\.log", x).group(1) for x in glob.glob(os.path.join(HERE, "logs", "build_[0-9][0-9][0-9][0-9][0-9].log"))}
              | {os.path.basename(os.path.dirname(x))[5:] for x in glob.glob(os.path.join(HERE, "pipeline", "data_[0-9][0-9][0-9][0-9][0-9]", "bundle-oc.b64"))})
for f in FIPS:
    log = os.path.join(HERE, "logs", f"build_{f}.log")
    # the build log, then any later rebuild logs for the same county (oldest first, so the newest values win)
    later = sorted(glob.glob(os.path.join(HERE, "logs", f"rebuild*_{f}.log")), key=os.path.getmtime)
    t = "\n".join(open(x, errors="replace").read() for x in ([log] if os.path.exists(log) else []) + later)
    g = lambda pat: (re.findall(pat, t) or [None])[-1]
    r = {"name": C[f]["name"], "acs_bgs": acs[f], "bgs": int(g(r"metrics for (\d+) block groups") or 0),
         "doj_agencies": int(g(r"DOJ crime \d+ agencies matched (\d+)") or 0) if C[f]["state"] == "CA" else None,
         "tes": [int(x) for x in (re.findall(r"block groups (\d+) -> 2020 block groups with values (\d+)", t) or [(0, 0)])[-1]],
         "done": "DONE " + f in t, "failed": max(t.rfind("FAILED"), t.rfind("Traceback")) > t.rfind("DONE " + f)}   # only a failure after the last success counts
    m = re.findall(r"local crashes .*? (\d+) with coordinates (\d+)", t) or re.findall(r"CCRS crashes (\d+) with coordinates (\d+)", t)
    if m: r["crashes"], r["crash_coords"] = int(m[-1][0]), int(m[-1][1])
    sp = [p for p in (f"/home/user/w5/county_sites/sites_{f}.json", f"/home/user/w5/sd_data/sites_{f}.json") if os.path.exists(p)]
    if sp: r["sites"] = json.load(open(sp[0]))["meta"]["counts"]
    flags = []
    if r["bgs"] and r["bgs"] < r["acs_bgs"]: flags.append(f"{r['acs_bgs'] - r['bgs']} ACS block groups have no map shape")
    elif r["bgs"] and r["bgs"] > r["acs_bgs"]: flags.append(f"note: {r['bgs'] - r['acs_bgs']} map block groups have no ACS data (shown as no data)")
    if r["bgs"] and r["tes"][1] < 0.9 * r["bgs"]: flags.append(f"Tree Equity covers {r['tes'][1]} of {r['bgs']}")
    if r.get("crashes") and r["crash_coords"] < 0.5 * r["crashes"]: flags.append(f"only {r['crash_coords'] / r['crashes']:.0%} of crashes geocoded")
    if C[f]["state"] == "CA" and r["bgs"] and r["doj_agencies"] == 0: flags.append("no crime agency matched")
    if r["failed"]: flags.append("build failed")
    if r["done"] and not sp: flags.append("no site suggestions")
    mp = os.path.join(HERE, "pipeline", f"data_{f}", "metrics.json")
    if os.path.exists(mp):
        cv = json.load(open(mp)).get("coverage", {}); tr = cv.get("transit") or {}
        r["transit"] = {"feeds": len(tr.get("feeds") or []), "stops": tr.get("stops"), "bt_unknown": tr.get("bt_unknown"), "skipped": len(tr.get("skipped") or [])}
        r["heat_baseline_marked"] = bool((cv.get("tree_equity") or {}).get("heat_baseline"))
        if r["bgs"] and tr.get("bt_unknown") and tr["bt_unknown"] > 0.25 * r["bgs"]:
            flags.append(f"bus frequency unknown in {tr['bt_unknown']} block groups (feed gap)")
        elif r["bgs"] and not tr.get("feeds") and (tr.get("gap_stops") or 0) > 0:
            gone = sorted({s.get("provider", "?") for s in tr.get("skipped") or [] if s.get("why", "").startswith("schedule ended")})
            flags.append("no current GTFS feed" + (f" ({', '.join(gone)}: schedule ended over a year ago)" if gone else "") + ": bus frequency unknown")
    r["flags"] = flags; out[f] = r
json.dump(out, open(os.path.join(HERE, "logs", "quality.json"), "w"), indent=1)
for f, r in out.items():
    print(f, r["name"][:22].ljust(22), "bgs", r["bgs"], "/", r["acs_bgs"], "| crime", r["doj_agencies"], "| TES", r["tes"][1], "| geocoded",
          f"{r['crash_coords'] / r['crashes']:.0%}" if r.get("crashes") else "-", "|", "; ".join(r["flags"]) or "ok")

md = ["| County | Block groups | Crime agencies | Tree Equity | Crashes geocoded | Transit feeds / stops | Bus frequency unknown | Site candidates | Flags |",
      "|---|---|---|---|---|---|---|---|---|"]
for f, r in sorted(out.items(), key=lambda kv: kv[1]["name"]):
    t = r.get("transit") or {}
    md.append(f"| {r['name']} | {r['bgs']:,} | {r['doj_agencies'] if r['doj_agencies'] is not None else '–'} | {r['tes'][1]:,} | "
              f"{(str(round(100 * r['crash_coords'] / r['crashes'])) + '%') if r.get('crashes') else '–'} | {t.get('feeds', '–')} / {t.get('stops', '–')} | "
              f"{t.get('bt_unknown') if t.get('bt_unknown') is not None else '–'} | {sum((r.get('sites') or {}).values()):,} | {'; '.join(r['flags']) or 'ok'} |")
open(os.path.join(HERE, "logs", "quality.md"), "w").write("\n".join(md) + "\n")
