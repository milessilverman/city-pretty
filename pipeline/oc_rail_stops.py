"""Orange County keeps OCTA's own feed (region.COUNTY_OVERRIDES["06059"]["gtfs"]), so fetch_oc.py never reads the MobilityData catalog for
it and writes no transit_rail_stops.json, and metrics_oc.confirm_rail_stations would leave Orange's stations unchecked (Disneyland's and
Knott's park trains counted as rail stations until round 8.4). This runs the catalog step for 06059 into a scratch folder and copies only
the rail-stop file (stops of every rail route in the feeds read, plus Amtrak's) into Orange's data folder; the bus data stay OCTA's.
usage: python3 oc_rail_stops.py <Orange data dir>   (e.g. /home/user/national/oc_regress), then osm_extract / metrics_oc / layers_oc /
build_oc with CP_FIPS=06059 CP_DATA=<that dir>"""
import os, sys, shutil, tempfile, json
dst = os.path.abspath(sys.argv[1])
tmp = tempfile.mkdtemp(prefix="oc_rail_")
shutil.copy(os.path.join(dst, "bg.geojson"), os.path.join(tmp, "bg.geojson"))
os.environ["CP_FIPS"] = "06059"; os.environ["CP_DATA"] = tmp
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_oc
fetch_oc.fetch_gtfs_mdb()
shutil.copy(os.path.join(tmp, "transit_rail_stops.json"), os.path.join(dst, "transit_rail_stops.json"))
n = len(json.load(open(os.path.join(dst, "transit_rail_stops.json"))))
shutil.rmtree(tmp, ignore_errors=True)
print("transit_rail_stops.json:", n, "rail stops ->", dst)
