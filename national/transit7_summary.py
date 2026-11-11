"""Before/after of the transit inputs for every county checked with selections 6/7: 7-9 am bus departures per hour summed over the county's
stops (box + 0.02 degree), stops, stale-feed gap stops. Before = selection 5 (the first check's "old"), after = selection 7. Prints the
largest changes and totals; writes logs/transit7_summary.json."""
import json, os, glob
N = "/home/user/national"
C = json.load(open(f"{N}/data/counties.json"))
v6 = {os.path.basename(p)[:5]: json.load(open(p)) for p in glob.glob(f"{N}/logs/transit6/*.json")}
v7 = {os.path.basename(p)[:5]: json.load(open(p)) for p in glob.glob(f"{N}/logs/transit7/*.json")}
rows = []
for F, d7 in v7.items():
    d0 = v6.get(F, d7)   # selection 5 as first seen
    rows.append({"fips": F, "county": C[F]["name"], "st": C[F]["state"], "buses_before": d0["buses_old"], "buses_after": d7["buses_new"],
                 "stops_before": d0["stops_old"], "stops_after": d7["stops_new"], "gap_before": d0["gap_old"], "gap_after": d7["gap_new"]})
json.dump(rows, open(f"{N}/logs/transit7_summary.json", "w"), indent=1)
ch = [r for r in rows if abs(r["buses_after"] - r["buses_before"]) > 0.05 or r["stops_after"] != r["stops_before"]]
print(f"{len(rows)} counties checked; {len(ch)} with different bus departures or stops")
print("| County | Buses per hour, 7-9 am, all stops: before | after | change | Stops before | after |")
print("|---|---|---|---|---|---|")
for r in sorted(ch, key=lambda r: -abs(r["buses_after"] - r["buses_before"]))[:30]:
    pct = (r["buses_after"] / r["buses_before"] - 1) * 100 if r["buses_before"] else float("inf")
    print(f"| {r['county']}, {r['st']} | {r['buses_before']:,.0f} | {r['buses_after']:,.0f} | {pct:+.0f}% | {r['stops_before']:,} | {r['stops_after']:,} |")
tb, ta = sum(r["buses_before"] for r in rows), sum(r["buses_after"] for r in rows)
print(f"\nAll checked counties: {tb:,.0f} -> {ta:,.0f} bus departures per hour ({(ta / tb - 1) * 100:+.1f}%)")
