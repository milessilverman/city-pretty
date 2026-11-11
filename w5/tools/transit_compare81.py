"""Round 8.1: block groups with unknown bus frequency per county, round 8 (handoff/round8/county-quality.md) vs now (metrics.json)."""
import json, re, os
W5 = "/home/user/w5"; P = "/home/user/national/pipeline"
C = json.load(open("/home/user/national/data/counties.json"))
name2f = {}
for f, c in C.items():
    name2f.setdefault(c["name"], []).append(f)
before = {}
for l in open("/home/user/handoff/round8/county-quality.md"):
    cells = [x.strip() for x in l.strip().strip("|").split("|")]
    if len(cells) < 9 or not cells[1].replace(",", "").isdigit():
        continue
    fl = [f for f in name2f.get(cells[0], []) if os.path.exists(f"{P}/data_{f}/metrics.json")]
    if len(fl) == 1 and cells[6].replace(",", "").isdigit():
        before[fl[0]] = int(cells[6].replace(",", ""))
rows, tb, ta, n5 = [], 0, 0, 0
for f in sorted(before):
    m = json.load(open(f"{P}/data_{f}/metrics.json")); t = m["coverage"].get("transit") or {}
    if (t.get("selection") or 0) >= 5:
        n5 += 1
    a = t.get("bt_unknown")
    if a is None:
        continue
    tb += before[f]; ta += a
    if before[f] - a >= 25:
        rows.append((before[f] - a, f, before[f], a, len(m["metrics"])))
print(f"counties compared: {len(before)} (selection 5 now: {n5}); unknown bus frequency, all of them: {tb:,} -> {ta:,} block groups")
for d, f, b, a, n in sorted(rows, reverse=True)[:15]:
    print(f"- {C[f]['name']}, {C[f]['state']}: {b:,} -> {a:,} of {n:,}")
