"""Station decisions now (data_*/rail_confirm.json) against the reviewed state (station84_review json saved at 05:05): per county, the
stations added, dropped or kept that changed, by name. usage: python3 station_diff.py <saved review json>"""
import json, os, sys, collections
old = {r["fips"]: r for r in json.load(open(sys.argv[1]))}
C = json.load(open("/home/user/national/data/counties.json")); tot = collections.Counter(); n = 0
for F in sorted(old):
    p = f"/home/user/national/pipeline/data_{F}/rail_confirm.json"
    if not os.path.exists(p): continue
    R = json.load(open(p)); r = old[F]; lines = []
    for k, ok in (("added", "added"), ("dropped", "dropped"), ("mode", "mode_kept"), ("agency", "agency_kept")):
        a = collections.Counter(e[2] for e in r[ok]); b = collections.Counter(e[2] for e in R.get(k, []))
        gone, new = a - b, b - a
        if gone or new:
            lines.append(f"  {k}: -{sorted(gone.elements())[:8]} +{sorted(new.elements())[:8]}"); tot[k + " -"] += sum(gone.values()); tot[k + " +"] += sum(new.values())
    if r["n_gtfs"] != len(R.get("gtfs", [])):
        lines.append(f"  confirmed by a stop: {r['n_gtfs']} -> {len(R.get('gtfs', []))}"); tot["gtfs delta"] += len(R.get("gtfs", [])) - r["n_gtfs"]
    if lines:
        n += 1; print(f"{C[F]['name']}, {C[F].get('state')} ({F})"); print("\n".join(lines))
print(n, "counties changed;", dict(tot))
