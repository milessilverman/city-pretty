"""Round 8.5: what the Veterans Day re-run (rebundle85e) changed. For each re-run county: the feeds its GTFS sources row names, with the
weekday measured, in round 8.4's site (site84) and now; feeds counted now that were not before (a feed with no stop in the county on
11 Nov is in no record); and bus frequency against site84 (as transit7_effect.py). usage: python3 vet85_effect.py logs/rebundle85e.log"""
import sys, json, gzip, base64, re, os, collections
N = "/home/user/national"
C = json.load(open(f"{N}/data/counties.json"))
done = [l.split()[1] for l in open(f"{N}/{sys.argv[1]}") if len(l.split()) >= 4 and l.split()[2] == "EXIT" and l.split()[3] == "0"]
PAT = re.compile(r"\(MobilityData ([^,()]+), (\d{4}-\d\d-\d\d)\)")
def feeds(B):
    for row in (B.get("meta") or {}).get("sources") or []:
        if isinstance(row, list) and row and str(row[0]).startswith("GTFS feeds"):
            return {m.group(1): m.group(2) for m in PAT.finditer(row[1])}
    return None
tot = collections.Counter(); out = []
for F in done:
    op, np_ = f"{N}/site84/counties/bundle_{F}.json.gz", f"{N}/pipeline/data_{F}/bundle-oc.b64"
    if not (os.path.exists(op) and os.path.exists(np_)): continue
    O = json.loads(gzip.decompress(open(op, "rb").read())); B = json.loads(gzip.decompress(base64.b64decode(open(np_).read())))
    fo, fn = feeds(O), feeds(B)
    if fo is None or fn is None:
        tot["no sources row"] += 1; continue
    new = sorted(set(fn) - set(fo)); gone = sorted(set(fo) - set(fn))
    moved = sorted(k for k in set(fo) & set(fn) if fo[k] != fn[k])
    v11o = sum(1 for d in fo.values() if d == "2026-11-11"); v11n = sum(1 for d in fn.values() if d == "2026-11-11")
    ch = up = down = kn = unk = 0
    for g, d in B["details"].items():
        o = O["details"].get(g)
        if not o: continue
        a, b = o["m"].get("bt"), d["m"].get("bt")
        if a is None and b is not None: kn += 1
        elif a is not None and b is None: unk += 1
        elif a is not None and b is not None and abs(a - b) > 0.05: ch += 1; up += b > a; down += b < a
    tot["counties"] += 1; tot["feeds on 11 Nov before"] += v11o; tot["feeds on 11 Nov now"] += v11n; tot["feeds newly counted"] += len(new)
    tot["feeds no longer counted"] += len(gone); tot["bt changed"] += ch; tot["bt up"] += up; tot["bt down"] += down; tot["became known"] += kn; tot["became unknown"] += unk
    tot["counties with a bus change"] += bool(ch or kn or unk)
    out.append({"fips": F, "county": C[F]["name"], "st": C[F]["state"], "new_feeds": [(k, fn[k]) for k in new], "gone_feeds": [(k, fo[k]) for k in gone],
                "moved": [(k, fo[k], fn[k]) for k in moved], "bt_changed": ch, "bt_up": up, "bt_down": down, "became_known": kn, "became_unknown": unk})
json.dump({"totals": dict(tot), "counties": out}, open(f"{N}/logs/vet85_effect.json", "w"), indent=1)
print(dict(tot))
for r in sorted(out, key=lambda r: -(r["bt_changed"] + r["became_known"] + r["became_unknown"]))[:25]:
    if r["bt_changed"] or r["became_known"] or r["became_unknown"] or r["new_feeds"] or r["gone_feeds"]:
        print(f"{r['county']}, {r['st']}: bt changed {r['bt_changed']} (up {r['bt_up']}, down {r['bt_down']}), known {r['became_known']}, unknown {r['became_unknown']}; new feeds {r['new_feeds']}; gone {r['gone_feeds']}")
