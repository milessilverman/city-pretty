"""Round 8.6: what selection 20 changed in each county's transit feeds, from the round-8.5 snapshot (logs/r85_snapshot/<fips>_transit_stops_7_9.meta.json)
against the re-run's metas: feeds whose copy, weekday or stop count changed, feeds newly counted or no longer counted, feeds read from
Cal-ITP's tables, feeds still measured on an ended schedule, and the 'Not included' entries that were copies of counted feeds.
Writes logs/r86_feed_changes.json and logs/r86_feed_changes.md.  usage: python3 -I r86_feed_changes.py"""
import json, glob, os, collections
N = "/home/user/national"
rows, tot = [], collections.Counter()
ended_old, ended_new = collections.defaultdict(set), collections.defaultdict(set)
calitp = collections.defaultdict(set)
for op in sorted(glob.glob(f"{N}/logs/r85_snapshot/*_transit_stops_7_9.meta.json")):
    F = os.path.basename(op)[:5]; np_ = f"{N}/pipeline/data_{F}/transit_stops_7_9.meta.json"
    if not os.path.exists(np_): continue
    o, n = json.load(open(op)), json.load(open(np_))
    if (n.get("selection") or 0) < 20: tot["not at selection 20 or 21"] += 1; continue   # 21 is 20 with text-only additions
    tot["counties"] += 1
    fo = {f["id"]: f for f in o.get("feeds", [])}; fn = {f["id"]: f for f in n.get("feeds", [])}
    for f in o.get("feeds", []):
        if f.get("weekday") and f.get("calendar") and f["calendar"][1] < o.get("downloaded", "") and (__import__("datetime").date.fromisoformat(o["downloaded"]) - __import__("datetime").date.fromisoformat(f["weekday"])).days > 21:
            ended_old[(f["id"], f["provider"])].add(F)
    for f in n.get("feeds", []):
        if f.get("schedule_ended"): ended_new[(f["id"], f["provider"])].add(F)
        if f.get("calitp"): calitp[(f["id"], f["provider"], f["calitp"]["name"])].add(F)
    ch = []
    for k in sorted(set(fo) | set(fn)):
        a, b = fo.get(k), fn.get(k)
        if a is None: ch.append({"id": k, "provider": b["provider"], "change": "newly counted", "copy": b.get("copy"), "weekday": b["weekday"], "stops": b["stops"]}); tot["feeds newly counted"] += 1
        elif b is None: ch.append({"id": k, "provider": a["provider"], "change": "no longer counted", "old_stops": a["stops"]}); tot["feeds no longer counted"] += 1
        elif (a.get("copy"), a["weekday"], a["stops"]) != (b.get("copy"), b["weekday"], b["stops"]):
            ch.append({"id": k, "provider": b["provider"], "change": "changed", "old": [a.get("copy"), a["weekday"], a["stops"]], "new": [b.get("copy"), b["weekday"], b["stops"]]}); tot["feeds changed"] += 1
    used_o = set(fo) | {f["id"] for f in o.get("read_no_stops_here", [])}
    contra = sum(1 for s in o.get("skipped", []) if s["id"] in used_o)
    tot["contradictory 'Not included' entries in 8.5"] += contra
    rows.append({"fips": F, "stops": [o.get("stops"), n.get("stops")], "changes": ch, "contradictory_entries_85": contra})
out = {"totals": dict(tot), "ended_85": {f"{k[0]} {k[1]}": sorted(v) for k, v in ended_old.items()}, "ended_86": {f"{k[0]} {k[1]}": sorted(v) for k, v in ended_new.items()},
       "calitp_86": {f"{k[0]} {k[1]} <- {k[2]}": sorted(v) for k, v in calitp.items()}, "counties": rows}
json.dump(out, open(f"{N}/logs/r86_feed_changes.json", "w"), indent=1)
L = ["# Round 8.6: transit feed changes by county (selection 20 vs the round-8.5 snapshot)", "", "Totals: " + ", ".join(f"{k} {v:,}" for k, v in tot.items()), "",
     f"Feeds measured on an ended copy: round 8.5 {len(ended_old)} feeds in {len({F for v in ended_old.values() for F in v})} counties; round 8.6 {len(ended_new)} feeds in {len({F for v in ended_new.values() for F in v})} counties.", "",
     "## Feeds read from Cal-ITP's tables", ""] + [f"- {k}: {len(v)} counties ({', '.join(v[:8])}{'...' if len(v) > 8 else ''})" for k, v in sorted(out["calitp_86"].items())] + ["", "## Counties", ""]
for r in rows:
    if r["changes"]:
        L.append(f"- {r['fips']} (stops {r['stops'][0]} -> {r['stops'][1]}): " + "; ".join(f"{c['id']} {c['provider'][:30]} {c['change']}" + (f" {c['old']} -> {c['new']}" if c['change'] == 'changed' else "") for c in r["changes"][:8]))
open(f"{N}/logs/r86_feed_changes.md", "w").write("\n".join(L) + "\n"); print("\n".join(L[:12]))
