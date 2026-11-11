"""Assign counties to the smallest openstreetmap.fr sub-state extract that contains them (Texas, Florida, Georgia, North Carolina,
Illinois, Michigan, New York, Virginia, Colorado), using the extract polygons openstreetmap.fr publishes (/polygons/<path>.poly) and
TIGERweb county boundaries. Writes data/osm_subregions.json {fips: "us-south/texas/north"}; registry.py reads it.
A county that no single sub-region contains keeps its state file (clipped)."""
import os, json, urllib.request, urllib.parse
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "data")
POLY = "https://download.openstreetmap.fr/polygons/north-america/"
STATE_FIPS = {"texas": "48", "florida": "12", "georgia": "13", "north-carolina": "37", "illinois": "17", "michigan": "26", "new-york": "36", "virginia": "51", "colorado": "08"}


def get(url, timeout=300):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "city-pretty-registry"}), timeout=timeout) as r:
        return r.read()


def parse_poly(text):
    """osmosis .poly: name line, then sections (ring name, coordinate lines, END); a ring name starting with '!' is a hole"""
    lines = [l.strip() for l in text.splitlines()]
    outers, holes, i = [], [], 1
    while i < len(lines):
        if lines[i] in ("END", ""):
            i += 1; continue
        name = lines[i]; i += 1; ring = []
        while i < len(lines) and lines[i] != "END":
            x, y = lines[i].split()[:2]; ring.append((float(x), float(y))); i += 1
        i += 1
        if len(ring) >= 3:
            (holes if name.startswith("!") else outers).append(Polygon(ring).buffer(0))
    g = unary_union(outers)
    return g.difference(unary_union(holes)) if holes else g


def counties(st_fips):
    q = urllib.parse.urlencode({"where": f"STATE='{st_fips}'", "outFields": "GEOID,NAME", "returnGeometry": "true", "outSR": "4326",
                                "maxAllowableOffset": "0.005", "f": "geojson"})
    return json.loads(get(f"https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query?{q}"))["features"]


def main():
    idx = json.load(open(os.path.join(DATA, "osmfr_us_index.json")))
    out = {}
    for d, files in idx.items():
        parts = d.strip("/").split("/")
        if len(parts) != 2 or parts[1] not in STATE_FIPS:
            continue
        regs = []
        for f in files:
            sub = f.replace("-latest.osm.pbf", ""); path = f"{d.strip('/')}/{sub}"
            try:
                regs.append((path, parse_poly(get(POLY + path + ".poly").decode())))
            except Exception as e:
                print("  no polygon for", path, repr(e)[:80])
        regs.sort(key=lambda t: t[1].area)
        n_in = 0
        for c in counties(STATE_FIPS[parts[1]]):
            g = shape(c["geometry"]).buffer(0); core = g.buffer(-0.005) if g.area > 0.0005 else g
            hit = next((path for path, rg in regs if rg.contains(core)), None)
            if hit:
                out[c["properties"]["GEOID"]] = hit; n_in += 1
        print(parts[1], "sub-regions", len(regs), "counties placed", n_in)
    json.dump(out, open(os.path.join(DATA, "osm_subregions.json"), "w"), indent=0, sort_keys=True)
    print("counties with a sub-state extract:", len(out))


if __name__ == "__main__":
    main()
