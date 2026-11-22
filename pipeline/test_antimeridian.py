"""Tests for the pipeline's handling of a county that crosses the 180th meridian (Aleutians West, 02016), and proof that a county
that does not cross it takes the old code path. Synthetic block groups on both sides of 180 (no downloads).
Run: python3 pipeline/test_antimeridian.py"""
import json, os, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))


def square(x0, y0, x1, y1):
    return [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]


def bg_file(d, polys):
    feats = [{"type": "Feature", "properties": {"GEOID": f"02016000{i}001"}, "geometry": {"type": "Polygon", "coordinates": p}} for i, p in enumerate(polys)]
    with open(os.path.join(d, "bg.geojson"), "w") as fh:
        json.dump({"type": "FeatureCollection", "features": feats}, fh)


def run(fips, d, code):
    """run code in a fresh interpreter (region reads its county from the environment when imported)"""
    env = {**os.environ, "CP_FIPS": fips, "CP_DATA": d}
    r = subprocess.run([sys.executable, "-I", "-c", "import sys; sys.path.insert(0, %r)\n" % HERE + code], capture_output=True, text=True, env=env)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout.strip().splitlines()[-1])


# Attu-like block group east of 180 (172.4 to 173.6 E) and Unalaska-like one west of it (-168 to -166 W)
EAST, WEST = square(172.4, 52.8, 173.6, 53.1), square(-168.0, 53.5, -166.0, 54.0)


class Helpers(unittest.TestCase):
    def setUp(self):
        sys.path.insert(0, HERE)
        os.environ.setdefault("CP_FIPS", "02016")
        os.environ.setdefault("CP_DATA", tempfile.mkdtemp())
        import region
        self.r = region

    def test_crossing_detection(self):
        r = self.r
        self.assertTrue(r.crosses_antimeridian([179.5, 179.9, -179.9, -179.5]))
        self.assertTrue(r.crosses_antimeridian([172.4, 173.6, -168.0, -166.0]))
        self.assertFalse(r.crosses_antimeridian([-118.13, -117.41]))      # Orange County
        self.assertFalse(r.crosses_antimeridian([-122.5, -121.0]))
        self.assertFalse(r.crosses_antimeridian([10.0, 20.0]))
        self.assertFalse(r.crosses_antimeridian([-10.0, 10.0]))           # straddles 0, not 180
        self.assertFalse(r.crosses_antimeridian([]))

    def test_extent_and_split(self):
        r = self.r
        self.assertEqual(r.lon_extent([-118.13, -117.41]), (-118.13, -117.41))
        self.assertEqual(r.lon_extent([172.4, 173.6, -168.0, -166.0]), (172.4, -166.0))
        self.assertEqual(r.split_box((-118.0, 33.0, -117.0, 34.0)), [(-118.0, 33.0, -117.0, 34.0)])
        self.assertEqual(r.split_box((172.4, 52.0, -166.0, 54.0)), [(172.4, 52.0, 180.0, 54.0), (-180.0, 52.0, -166.0, 54.0)])

    def test_point_and_range_tests(self):
        r = self.r
        self.assertTrue(r.lon_in(172.4, -166.0, 179.9) and r.lon_in(172.4, -166.0, -179.9) and r.lon_in(172.4, -166.0, -167.0))
        self.assertFalse(r.lon_in(172.4, -166.0, 0.0) or r.lon_in(172.4, -166.0, -150.0) or r.lon_in(172.4, -166.0, 170.0))
        self.assertTrue(r.lon_in(-118.0, -117.0, -117.5))
        self.assertFalse(r.lon_in(-118.0, -117.0, -116.0))
        self.assertTrue(r.lon_overlap(-118, -117, -117.5, -116))
        self.assertFalse(r.lon_overlap(-118, -117, -116.5, -116))
        self.assertTrue(r.lon_overlap(172.4, -166.0, 178.0, 179.0))     # a feed box on the east side
        self.assertTrue(r.lon_overlap(172.4, -166.0, -175.0, -170.0))   # a feed box on the west side
        self.assertFalse(r.lon_overlap(172.4, -166.0, -120.0, -118.0))  # California is not Aleutians West
        self.assertFalse(r.lon_overlap(172.4, -166.0, 0.0, 10.0))


class CrossingCounty(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        bg_file(self.d, [EAST, WEST])

    def test_download_boxes_are_two_plain_boxes(self):
        o = run("02016", self.d, "import json, fetch_oc, osm_extract\n"
                "print(json.dumps({'one': fetch_oc.county_bbox(), 'two': fetch_oc.county_bboxes(), 'osm': osm_extract.county_boxes()}))")
        self.assertEqual(o["one"], [172.39, 52.79, -165.99, 54.01])   # west > east: crosses 180
        self.assertEqual(o["two"], [[172.39, 52.79, 180.0, 54.01], [-180.0, 52.79, -165.99, 54.01]])
        e, w = o["osm"]
        self.assertEqual((round(e[0], 6), e[2], w[0]), (172.38, 180.0, -180.0))
        self.assertAlmostEqual(w[2], -165.98)
        for b in o["two"] + o["osm"]:
            self.assertLessEqual(b[0], b[2])                  # no box spans the globe
            self.assertLess(b[2] - b[0], 30)

    def test_distance_across_180_is_short(self):
        o = run("02016", self.d, "import json, geo\n"
                "a = geo.PointIndex([(179.9, 52.0, 'east side')])\n"
                "d_raw = a.nearest(-179.9, 52.0)[0]\n"                 # the raw west-hemisphere longitude: 359.8 degrees away
                "d = a.nearest(geo.wl(-179.9), 52.0)[0]\n"             # on the county's scale: 0.2 degrees away
                "print(json.dumps({'cross': geo.CROSS, 'wl': geo.wl(-179.9), 'raw': d_raw, 'd': d, 'hav': geo.haversine_m(179.9, 52.0, -179.9, 52.0)}))")
        self.assertTrue(o["cross"])
        self.assertAlmostEqual(o["wl"], 180.1)
        self.assertGreater(o["raw"], 1e6)
        self.assertAlmostEqual(o["d"], o["hav"], delta=o["hav"] * 0.01)   # about 13.7 km either way
        self.assertLess(o["d"], 15000)

    def test_shapes_and_cells(self):
        o = run("02016", self.d, "import json, geo\n"
                "g = geo.shape_ll({'type': 'Polygon', 'coordinates': %s})\n" % json.dumps(WEST) +
                "print(json.dumps({'bounds': g.bounds, 'cell_w': geo.cell_key(-170.0, 53.0), 'cell_e': geo.cell_key(190.0, 53.0), 'cell_east': geo.cell_key(172.5, 53.0)}))")
        self.assertEqual(o["bounds"], [192.0, 53.5, 194.0, 54.0])      # -168..-166 W is 192..194 on the continuous scale
        self.assertEqual(o["cell_w"], o["cell_e"])                      # a longitude above 180 lands in its -180..180 twin's column
        self.assertEqual(o["cell_east"].split(",")[0], str(int((172.5 + 180) / 0.05)))

    def test_a_box_cut_at_180_is_asked_for_in_two_halves(self):
        o = run("02016", self.d, "import json, fetch_oc\n"
                "calls = []\n"
                "fetch_oc.get = lambda url, p=None, **k: (calls.append(p['geometry']), json.dumps({'features': []}))[1]\n"
                "fetch_oc.arcgis_query('https://x/FeatureServer/0')\n"
                "print(json.dumps(calls))")
        self.assertEqual(o, ["172.39,52.79,179.999,54.01", "-180.0,52.79,-165.99,54.01"])   # ArcGIS misreads an envelope ending at exactly 180


class OtherCounties(unittest.TestCase):
    def test_a_county_that_does_not_cross_keeps_one_box_and_old_numbers(self):
        d = tempfile.mkdtemp()
        bg_file(d, [square(-118.13, 33.4, -117.5, 33.9), square(-117.9, 33.5, -117.41, 33.95)])
        o = run("06037", d, "import json, math, geo, fetch_oc, osm_extract\n"
                "print(json.dumps({'one': fetch_oc.county_bbox(), 'two': fetch_oc.county_bboxes(), 'osm': osm_extract.county_boxes(), 'cross': geo.CROSS,\n"
                "  'wl': geo.wl(-117.9), 'cell': geo.cell_key(-117.9, 33.7), 'old_cell': '%d,%d' % (math.floor((-117.9 + 180) / 0.05), math.floor((33.7 + 90) / 0.05))}))")
        self.assertFalse(o["cross"])
        self.assertEqual(o["wl"], -117.9)
        self.assertEqual(o["one"], [-118.14, 33.39, -117.4, 33.96])
        self.assertEqual(o["two"], [o["one"]])
        self.assertEqual([[round(v, 6) for v in b] for b in o["osm"]], [[-118.15, 33.38, -117.39, 33.97]])
        self.assertEqual(o["cell"], o["old_cell"])


if __name__ == "__main__":
    unittest.main()
