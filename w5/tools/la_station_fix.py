"""Round 8.4: LA County's own bundle (in.html: #bundle, #details-chunks) counted 16 stations that no rail line serves as rail stations:
Disneyland's park trains and monorail (7), Knott's Berry Farm's Calico Railroad and Camp Snoopy Depot (3), the Getty Center tram (2),
the Fillmore & Western heritage railway's Fillmore and Piru (2) and two unnamed points near Tustin. They are the stations of LA's layer
with no GTFS rail stop within 400 m (LA Metro Rail, Metrolink and Amtrak feeds: fetch_oc.fetch_gtfs_mdb for 06037, saved as
transit_rail_stops.json), the round-8.4 rule. This writes the edits patch5.py applies to every page (research/la_station_fix_r84.json):
  - the 16 stations leave the map's stations layer;
  - in a block group whose nearest station was clearly one of them (closer than any served station by more than 50 m, measured from the
    block group's interior point; LA's own reference point differs by tens of metres, so the change is applied as a difference):
      rm and tr[0] grow by (distance to the nearest served station - distance to the dropped one); tr[1] already measured served stations;
      the rail gap's text names the served station and the new distance; a "rail" strength (rail nearer than in similar neighbourhoods)
      is removed, since it rested on a dropped station; rows whose text quotes the rail distance get the new distance; transit upzoning
      ("single-family lots near rail or frequent bus") is removed where the new distance is over 810 m and the block group has under 12
      buses an hour (engine.py's rule: rail within 810 m).
  The precomputed top projects (bgs features' tp) are recomputed from the rows with the page's own rule (retop) and must not change for
  a policy row (upzoning is a policy, not a value project). Nothing else changes; patch5.py asserts it.
usage: python3 la_station_fix.py <in.html> <transit_rail_stops.json> <out.json>"""
import re, json, gzip, base64, math, sys
from shapely.geometry import shape
src, rail_p, out_p = sys.argv[1:4]
s = open(src, encoding="utf-8").read()
B = json.loads(gzip.decompress(base64.b64decode(re.search(r'<script type="application/octet-stream" id="bundle">(.*?)</script>', s, re.S).group(1).strip())))
DC = json.loads(re.search(r'<script type="application/json" id="details-chunks">(.*?)</script>', s, re.S).group(1))
det = {}
for k, b in DC["chunks"].items():
    det.update(json.loads(gzip.decompress(base64.b64decode(b))))
gp = json.load(open(rail_p))


def d(a, b):
    cl = math.cos(math.radians(a[1])); return math.hypot((a[0] - b[0]) * cl * 111320, (a[1] - b[1]) * 110540)


st = [(tuple(f["geometry"]["coordinates"]), f["properties"].get("n") or "") for f in B["layers"]["stations"]["features"]]
served = [(c, n) for c, n in st if min(d(c, (p[0], p[1])) for p in gp) <= 400]
dropped = [(c, n) for c, n in st if (c, n) not in served]
dropped_names = {n for c, n in dropped if n}
mi = lambda m: f"{m / 1609:.1f} mi"
edits = {}
for f in B["bgs"]["features"]:
    g = f["properties"]["id"]; m = det[g]["m"]
    p = shape(f["geometry"]).representative_point(); q = (p.x, p.y)
    do, no_ = min((d(q, c), n) for c, n in dropped)
    dn, nn = min((d(q, c), n) for c, n in served)
    gaps = (m.get("gp") or {}).get("g", []); strengths = (m.get("gp") or {}).get("s", [])
    named = next((re.search(r"The nearest rail station is (.+?), [0-9.]+ mi away", e[5]).group(1) for e in gaps
                  if e and e[0] == "rail" and len(e) > 5 and e[5] and re.search(r"The nearest rail station is (.+?), [0-9.]+ mi away", e[5])), None)
    if named is not None:
        hit = named in dropped_names and named not in {n for c, n in served}   # "Fillmore" is also Pasadena's A Line station
    else:
        hit = do < dn - 50
    if not hit or m.get("rm") is None:
        continue
    rm_old = m["rm"]; delta = dn - do; rm_new = float(round(rm_old + delta))
    e = {"rm": [rm_old, rm_new], "nearest": nn, "dropped_nearest": no_}
    tr = m.get("tr") or []
    if tr and tr[0] is not None and abs(tr[0] - rm_old) < 1:
        e["tr0"] = [tr[0], rm_new]
    for i, x in enumerate(gaps):
        if x and x[0] == "rail":
            new = list(x); new[1] = mi(rm_new)
            if len(new) > 5 and new[5]:
                new[5] = re.sub(r"The nearest rail station is .+?, [0-9.]+ mi away", f"The nearest rail station is {nn}, {mi(rm_new)} away", new[5])
            e.setdefault("gap", []).append([i, x, new])
    for i, x in enumerate(strengths):
        if x and x[0] == "rail":
            e.setdefault("strength_removed", []).append([i, x])
    rows = det[g]["r"]
    for i, r in enumerate(rows):
        t = r[10] or ""
        if r[0] == "upzone_transit" and rm_new > 810 and (m.get("bt") or 0) < 12:
            e.setdefault("row_removed", []).append([i, r[0]])
        elif re.search(r"rail", t) and mi(rm_old) in t:
            e.setdefault("row_text", []).append([i, r[0], t, t.replace(mi(rm_old), mi(rm_new))])
    edits[g] = e
# underused sites (bundle under.sites, shapes in layers.underused as encoded polylines by site index): the nearest station's name and
# distance ("0.12 mi from Lower Tram Station"); a site counts when the nearest station to its shape was a dropped one (by position, so
# Pasadena's "Fillmore" stays). No affected site is within the 805 m that would change its SB 79 home count; that is asserted.
def poly(sx):
    pts, i, lat, lon = [], 0, 0, 0
    while i < len(sx):
        for k in range(2):
            r = sh = 0
            while True:
                b = ord(sx[i]) - 63; i += 1; r |= (b & 0x1f) << sh; sh += 5
                if b < 0x20: break
            v = ~(r >> 1) if r & 1 else r >> 1
            if k == 0: lat += v
            else: lon += v
        pts.append((lon / 1e5, lat / 1e5))
    return pts
shp = {}
for cell in B["layers"]["underused"]["cells"].values():
    for i, rings in cell:
        shp.setdefault(i, []).extend(pt for r in rings for pt in poly(r))
site_edits = []
for x in B["under"]["sites"]:
    if x.get("st") not in dropped_names or x["i"] not in shp:
        continue
    pts = shp[x["i"]]; q = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
    do, no_ = min((d(q, c), n) for c, n in st)
    if no_ not in dropped_names or no_ != x["st"] or (do, no_) not in [(d(q, c), n) for c, n in dropped]:
        continue
    dn, nn = min((d(q, c), n) for c, n in served)
    new_rail = int(round(x["rail"] + dn - do))
    assert x["rail"] > 805 or new_rail <= 805 or x["homes"] == 0 or "SB 79" not in (x.get("idea") or ""), x   # SB 79 homes would change
    site_edits.append([x["i"], x["st"], x["rail"], nn, new_rail])
# neighbourhood plans (bundle plans, "Name|City"): a rail step quotes its block group's gap text; a context sentence names the station
# that puts the area within 1/2 mile of rail (SB 79): it goes when the station was dropped; a "rail" strength goes when every block group
# of the neighbourhood that had one lost it here.
hood = {}
for f in B["bgs"]["features"]:
    hood.setdefault(f["properties"]["n"] + "|" + f["properties"]["c"], []).append(f["properties"]["id"])
plan_edits = []
for hk, P in B["plans"].items():
    for si, stp in enumerate(P.get("steps", [])):
        if stp.get("gap") == "rail" and stp.get("bg") in edits and "gap" in edits[stp["bg"]]:
            old_t, new_t = edits[stp["bg"]]["gap"][0][1][5], edits[stp["bg"]]["gap"][0][2][5]
            if stp["why"] == old_t:
                plan_edits.append([hk, "steps", si, "why", old_t, new_t])
        elif stp.get("gap") == "rail" and any(nm in (stp.get("why") or "") for nm in dropped_names - {n for c, n in served}):
            raise SystemExit(f"plan {hk}: a rail step names a dropped station but its block group has no matching edit")
    for ci, t in enumerate(P.get("ctx", [])):
        mm = re.match(r"The (.+?) station puts parts of the area within ½ mile of rail", t or "")
        if mm and mm.group(1) in dropped_names - {n for c, n in served}:
            assert all(edits.get(g, {}).get("rm", [0, 1e9])[1] > 805 for g in hood.get(hk, []) if g in edits), hk
            assert all(g in edits or (det[g]["m"].get("rm") or 1e9) > 805 for g in hood.get(hk, [])), hk   # no other station within 1/2 mile
            plan_edits.append([hk, "ctx", ci, None, t, None])
    if any(sx[0] == "rail" for sx in P.get("strong", [])):
        had = [g for g in hood.get(hk, []) if any(e and e[0] == "rail" for e in (det[g]["m"].get("gp") or {}).get("s", []))]
        if had and all("strength_removed" in edits.get(g, {}) for g in had):
            si = next(i for i, sx in enumerate(P["strong"]) if sx[0] == "rail")
            plan_edits.append([hk, "strong", si, None, P["strong"][si], None])
out = {"source": "LA County bundle stations checked against GTFS rail stops (round 8.4): LA Metro Rail, Metrolink and Amtrak feeds via MobilityData",
       "dropped_stations": [[c[0], c[1], n] for c, n in dropped], "block_groups": edits, "sites": site_edits, "plans": plan_edits}
print(len(site_edits), "underused sites renamed to their served station;", sum(1 for e in plan_edits if e[1] == "steps"), "plan rail steps,",
      sum(1 for e in plan_edits if e[1] == "ctx"), "SB 79 context sentences removed,", sum(1 for e in plan_edits if e[1] == "strong"), "plan rail strengths removed")
json.dump(out, open(out_p, "w"), indent=1, ensure_ascii=False)
print(len(dropped), "stations dropped:", sorted(n or "(unnamed)" for c, n in dropped))
print(len(edits), "block groups:", sum("gap" in e for e in edits.values()), "rail gaps rewritten,", sum("strength_removed" in e for e in edits.values()), "rail strengths removed,",
      sum(len(e.get("row_removed", [])) for e in edits.values()), "upzoning rows removed,", sum(len(e.get("row_text", [])) for e in edits.values()), "row texts updated")
