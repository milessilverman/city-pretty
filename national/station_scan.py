"""Round 8.4 scan: which built counties gain rail stations when stations mapped as areas (and, failing those, rail stop positions) are read,
as osm_extract.py now does. Before, only station NODES were read, so e.g. Collin County, TX (DART's Plano stations, mapped as areas) had
none. For every OpenStreetMap source a built county uses, the stations are filtered once with osmium (railway=station/halt/stop,
public_transport=station); then, per county box (+0.02 degree, as osm_extract clips), the station points are rebuilt with the new rule and
compared with the old one (nodes only). Per-county California extracts are downloaded to a scratch folder one at a time.
Writes logs/station_scan.json and logs/station_rebundle.txt (counties whose station set changes).   usage: nice -n 19 python3 station_scan.py"""
import json, os, subprocess, math, collections, shutil, urllib.request, re
N = "/home/user/national"; P = f"{N}/pipeline"
SCR = "/tmp/claude-0/-home-user/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad/station_scan"
os.makedirs(SCR, exist_ok=True)
C = json.load(open(f"{N}/data/counties.json"))
built = sorted(f for f in C if os.path.exists(f"{P}/data_{f}/metrics.json") and f != "06059")


# rail stations that are not transit: miniature, heritage and tourist railways, zoo and park trains (e.g. Balboa Park Miniature Railroad,
# Grapevine Vintage Railroad, San Antonio Zoo's train). Not "historic" alone: Salt Lake's "Historic Gardner" is a TRAX station.
NONTRANSIT = re.compile(r"miniature|mini[ -]?train|vintage railroad|heritage rail|excursion|scenic rail|railroad museum|railway museum|tea garden|steam(er)?s? train", re.I)
ZOO = re.compile(r"\b(zoo|safari)\b", re.I)   # zoo and safari trains, unless the station belongs to a transit network: METRORail's
#                                             "Memorial Hermann Hospital/Houston Zoo" has network=Metro


def is_transit_station(t):
    if (t.get("usage") == "tourism" or t.get("railway:historic") or t.get("historic") == "railway_station" or t.get("station") == "miniature"
            or t.get("tourism") in ("attraction", "museum") or t.get("access") in ("private", "no")):
        return False
    txt = " ".join(str(t.get(k) or "") for k in ("name", "operator", "network", "description"))
    return not NONTRANSIT.search(txt) and not (ZOO.search(txt) and not t.get("network"))


def src_file(f):
    o = C[f]["osm"]
    if o.get("split"):
        return f"{N}/cache/osm_states/{o['split'].replace('/', '__')}-latest.osm.pbf"
    if o.get("clip"):
        return f"{N}/cache/osm/{o['url'].split('north-america/')[-1].replace('/', '__')}"   # as fetch_oc.fetch_osm_extract names its shared copy
    return None   # a per-county extract (California): downloaded below


def box(f):
    xs, ys = [], []
    def walk(c):
        if isinstance(c[0], (int, float)): xs.append(c[0]); ys.append(c[1])
        else:
            for q in c: walk(q)
    for ft in json.load(open(f"{P}/data_{f}/bg.geojson"))["features"]:
        walk(ft["geometry"]["coordinates"])
    return min(xs) - .02, min(ys) - .02, max(xs) + .02, max(ys) + .02


def stations_of(pbf, tag):
    """station nodes, station areas (centre of the outer ring) and rail stop positions in one OSM file"""
    flt, gj = f"{SCR}/{tag}.st.osm.pbf", f"{SCR}/{tag}.st.geojsonseq"
    subprocess.run(["osmium", "tags-filter", "-O", "-o", flt, pbf, "nwr/railway=station,halt,stop", "nwr/public_transport=station"], check=True, capture_output=True)
    subprocess.run(["osmium", "export", "-O", "-f", "geojsonseq", "-o", gj, flt], check=True, capture_output=True)
    nodes, areas, stops, dropped = [], [], [], []
    for l in open(gj):
        l = l.strip().lstrip("\x1e")
        if not l:
            continue
        ft = json.loads(l); t = ft["properties"]; g = ft["geometry"]
        transit = is_transit_station(t)
        if not transit:
            if g["type"] == "Point" and (t.get("railway") in ("station", "halt") or (t.get("public_transport") == "station" and t.get("train") == "yes")):
                dropped.append((g["coordinates"][0], g["coordinates"][1], t.get("name")))   # a station node the old rule counted
            continue
        is_st = t.get("railway") in ("station", "halt") or (t.get("public_transport") == "station" and t.get("train") == "yes")
        is_area_st = t.get("railway") in ("station", "halt") or (t.get("public_transport") == "station" and any(t.get(k) == "yes" for k in ("train", "light_rail", "subway")))
        if g["type"] == "Point":
            x, y = g["coordinates"]
            if is_st:
                nodes.append((x, y, t.get("name")))
            elif t.get("railway") == "stop" and any(t.get(k) == "yes" for k in ("train", "light_rail", "subway")):
                stops.append((x, y, t.get("name")))
        elif g["type"] in ("Polygon", "MultiPolygon") and is_area_st:
            ring = g["coordinates"][0] if g["type"] == "Polygon" else g["coordinates"][0][0]
            areas.append((sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring), t.get("name")))
    for q in (flt, gj):
        os.remove(q)
    return nodes, areas, stops, dropped


def close(a, b, R):
    return ((a[0] - b[0]) * math.cos(math.radians(a[1])) * 111320) ** 2 + ((a[1] - b[1]) * 110540) ** 2 <= R * R


def county_counts(st, bx):
    inb = lambda p: bx[0] <= p[0] <= bx[2] and bx[1] <= p[1] <= bx[3]
    nodes, areas, stops, dropped = ([p for p in L if inb(p)] for L in st)
    kept = list(nodes)
    for a in areas:
        if not any(close(a, k, 150) for k in kept):
            kept.append(a)
    n_area = len(kept) - len(nodes)
    for s in stops:
        if not any(close(s, k, 300) for k in kept):
            kept.append(s)
    return {"nodes": len(nodes), "areas_added": n_area, "stops_added": len(kept) - len(nodes) - n_area,
            "added_names": sorted({(p[2] or "?") for p in kept[len(nodes):]})[:40],
            "nodes_dropped": len(dropped), "dropped_names": sorted({(p[2] or "?") for p in dropped})[:20]}


by_src = collections.defaultdict(list)
for f in built:
    by_src[src_file(f)].append(f)
res = {}
for src, fs in sorted(by_src.items(), key=lambda kv: str(kv[0])):
    if src is None:
        continue
    if not os.path.exists(src):
        for f in fs: res[f] = {"error": "OSM source not cached: " + os.path.basename(src)}
        continue
    st = stations_of(src, os.path.basename(src)[:60])
    for f in fs:
        res[f] = county_counts(st, box(f))
    print(os.path.basename(src), len(fs), "counties", flush=True)
for f in by_src.get(None, []):   # per-county extracts (California)
    url = C[f]["osm"]["url"]; dst = f"{SCR}/county.osm.pbf"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "CityPretty-OC-build/1.0 (civic data map)"}), timeout=1800) as r, open(dst, "wb") as fh:
            shutil.copyfileobj(r, fh)
        res[f] = county_counts(stations_of(dst, f), box(f))
    except Exception as e:
        res[f] = {"error": repr(e)[:120]}
    finally:
        if os.path.exists(dst): os.remove(dst)
    print(f, res[f].get("areas_added"), res[f].get("stops_added"), flush=True)
json.dump(res, open(f"{N}/logs/station_scan.json", "w"), indent=1)   # (stations are filtered with is_transit_station, as in osm_extract.py)
chg = [f for f, r in res.items() if r.get("areas_added") or r.get("stops_added") or r.get("nodes_dropped")]
open(f"{N}/logs/station_rebundle.txt", "w").write("".join(f + "\n" for f in chg))
print(len(res), "counties scanned;", len(chg), "with a different station set;", sum(1 for r in res.values() if "error" in r), "errors")
