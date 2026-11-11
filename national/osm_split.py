"""One-time split of an openstreetmap.fr regional extract (us-south, us-midwest, us-northeast, us-west) into one file per state, for
the states openstreetmap.fr does not publish separately. A county there then reads a state-sized file instead of the 2-4.6 GB region
(osm_extract.py needs node locations for the whole input, which is too much memory for a region).

Each state's cut-out area is the union of its counties' bounding boxes (TIGERweb county shapes, one box per polygon part so the
Aleutians do not wrap round the globe) plus a 0.05 degree margin, so every county box that osm_extract.py and osm_sites.py clip to
lies fully inside. osmium extract's 'smart' strategy keeps every way complete and every multipolygon relation (parks, lakes) whole.

usage: python3 osm_split.py <region> [--per-pass N] [--states ST,ST]
  reads cache/osm_split/<region>-latest.osm.pbf (+ .state.txt), downloaded beforehand
  writes cache/osm_states/<region>__<state>-latest.osm.pbf and .state.txt (the regional file's: same data timestamp)
  and adds the states to data/osm_split.json {ST: {"split": "<region>/<state>", "source": url, "timestamp": ..., "bytes": ...}}
Runs osmium in groups of N states (default 2) and stops a group if free memory falls below 1.5 GB."""
import os, sys, json, time, shutil, subprocess, urllib.request, urllib.parse
from shapely.geometry import shape, box, mapping, Polygon, MultiPolygon
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "data")
SRC = os.path.join(HERE, "cache", "osm_split"); OUT = os.path.join(HERE, "cache", "osm_states")
OSMFR = "https://download.openstreetmap.fr/extracts/north-america/"
sys.path.insert(0, HERE)
from registry import REGION, STATE_FILE, NO_OSM   # noqa: E402

STATE_NAME = {"AK": "alaska", "AL": "alabama", "AR": "arkansas", "AZ": "arizona", "CT": "connecticut", "DC": "district-of-columbia", "DE": "delaware",
              "HI": "hawaii", "IA": "iowa", "ID": "idaho", "IN": "indiana", "KS": "kansas", "KY": "kentucky", "LA": "louisiana", "MA": "massachusetts",
              "MD": "maryland", "ME": "maine", "MN": "minnesota", "MO": "missouri", "MS": "mississippi", "MT": "montana", "ND": "north-dakota",
              "NE": "nebraska", "NH": "new-hampshire", "NJ": "new-jersey", "NM": "new-mexico", "NV": "nevada", "OH": "ohio", "OK": "oklahoma",
              "OR": "oregon", "PA": "pennsylvania", "RI": "rhode-island", "SC": "south-carolina", "SD": "south-dakota", "TN": "tennessee",
              "UT": "utah", "VT": "vermont", "WA": "washington", "WI": "wisconsin", "WV": "west-virginia", "WY": "wyoming"}
MARGIN = 0.05


def get(url, timeout=300):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "city-pretty-osm-split"}), timeout=timeout) as r:
        return r.read()


def state_area(st_fips):
    """union of the state's county boxes (per polygon part) plus the margin"""
    q = urllib.parse.urlencode({"where": f"STATE='{st_fips}'", "outFields": "GEOID", "returnGeometry": "true", "outSR": "4326",
                                "maxAllowableOffset": "0.005", "f": "geojson"})
    feats = json.loads(get(f"https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query?{q}"))["features"]
    boxes = []
    for f in feats:
        g = shape(f["geometry"])
        for part in (g.geoms if isinstance(g, MultiPolygon) else [g]):
            w, s, e, n = part.bounds
            boxes.append(box(max(-180, w - MARGIN), max(-90, s - MARGIN), min(180, e + MARGIN), min(90, n + MARGIN)))
    return unary_union(boxes), len(feats)


def mem_available():
    for l in open("/proc/meminfo"):
        if l.startswith("MemAvailable"):
            return int(l.split()[1]) * 1024
    return 0


def run_group(region, group, areas, pbf):
    cfg = {"directory": OUT, "extracts": []}
    for st in group:
        gj = os.path.join(SRC, f"{region}__{STATE_NAME[st]}.geojson")
        json.dump({"type": "Feature", "properties": {"state": st}, "geometry": mapping(areas[st])}, open(gj, "w"))
        cfg["extracts"].append({"output": f"{region}__{STATE_NAME[st]}-latest.osm.pbf.part", "output_format": "pbf",
                                "description": f"{STATE_NAME[st]} (county boxes + {MARGIN} deg) from {region}", "multipolygon": {"file_name": gj, "file_type": "geojson"}})
    cp = os.path.join(SRC, f"{region}__{'-'.join(group)}.json"); json.dump(cfg, open(cp, "w"), indent=1)
    t0 = time.time(); peak = 0
    p = subprocess.Popen(["osmium", "extract", "-c", cp, "-s", "smart", "--overwrite", "--no-progress", pbf], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    while p.poll() is None:
        try:
            rss = int([l for l in open(f"/proc/{p.pid}/status") if l.startswith("VmRSS")][0].split()[1]) * 1024
            peak = max(peak, rss)
        except (IndexError, FileNotFoundError):
            pass
        if mem_available() < 1.5e9:
            p.kill(); p.wait()
            print("  !! stopped: free memory below 1.5 GB (peak osmium RSS %.1f GB)" % (peak / 1e9), flush=True)
            for st in group:
                q = os.path.join(OUT, f"{region}__{STATE_NAME[st]}-latest.osm.pbf.part")
                if os.path.exists(q): os.remove(q)
            return False
        time.sleep(2)
    out = p.stdout.read()
    if p.returncode != 0:
        print("  !! osmium failed", p.returncode, out[-800:], flush=True); return False
    print(f"  group {group}: {time.time() - t0:.0f} s, peak osmium RSS {peak / 1e9:.2f} GB", flush=True)
    return True


def main():
    region = sys.argv[1]; per = int(sys.argv[sys.argv.index("--per-pass") + 1]) if "--per-pass" in sys.argv else 2
    only = sys.argv[sys.argv.index("--states") + 1].split(",") if "--states" in sys.argv else None
    pbf = os.path.join(SRC, f"{region}-latest.osm.pbf"); stxt = os.path.join(SRC, f"{region}.state.txt")
    assert os.path.exists(pbf) and os.path.exists(stxt), "download the regional file and its .state.txt into cache/osm_split first"
    ts = [l.split("=", 1)[1].replace("\\", "") for l in open(stxt).read().splitlines() if l.startswith("timestamp")][0]
    os.makedirs(OUT, exist_ok=True)
    C = json.load(open(os.path.join(DATA, "counties.json")))
    st_fips = {}
    for f, c in C.items():
        st_fips.setdefault(c["state"], f[:2])
    states = sorted(st for st, r in REGION.items() if r == region and st not in STATE_FILE and st not in NO_OSM and st in STATE_NAME and (not only or st in only))
    reg = json.load(open(os.path.join(DATA, "osm_split.json"))) if os.path.exists(os.path.join(DATA, "osm_split.json")) else {}
    todo = [st for st in states if not (reg.get(st, {}).get("timestamp") == ts and os.path.exists(os.path.join(OUT, f"{region}__{STATE_NAME[st]}-latest.osm.pbf")))]
    print(region, "timestamp", ts, "states", states, "to do", todo, flush=True)
    areas = {}
    for st in todo:
        areas[st], n = state_area(st_fips[st])
        print(f"  {st}: {n} counties, area {areas[st].area:.1f} sq deg, bounds {tuple(round(x, 2) for x in areas[st].bounds)}", flush=True)
    for i in range(0, len(todo), per):
        group = todo[i:i + per]
        if not run_group(region, group, areas, pbf):
            continue
        for st in group:
            name = f"{region}__{STATE_NAME[st]}"; part = os.path.join(OUT, name + "-latest.osm.pbf.part"); final = os.path.join(OUT, name + "-latest.osm.pbf")
            os.replace(part, final); shutil.copyfile(stxt, os.path.join(OUT, name + ".state.txt"))
            reg[st] = {"split": f"{region}/{STATE_NAME[st]}", "source": f"{OSMFR}{region}-latest.osm.pbf", "timestamp": ts, "bytes": os.path.getsize(final),
                       "method": f"osmium extract -s smart, union of county boxes + {MARGIN} deg (osm_split.py)", "made": time.strftime("%Y-%m-%d")}
            print(f"  wrote {final} {os.path.getsize(final) / 1e6:.0f} MB", flush=True)
        json.dump(reg, open(os.path.join(DATA, "osm_split.json"), "w"), indent=1, sort_keys=True)
    print("done", region, flush=True)


if __name__ == "__main__":
    main()
