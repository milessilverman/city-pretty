#!/bin/bash
# Re-run the site suggestions for one county whose raw files were cleaned after its build: chargers, OSM extract (cached or
# re-downloaded) -> osm_sites.json (clipped), CCRS for California, then sites.py; raw files are removed again afterwards.
# usage: resites.sh <fips>      (log: /home/user/national/logs/resites_<fips>.log)
set -e
F=$1; P=/home/user/national/pipeline; W=/home/user/w5; D=$P/data_$F; LOG=/home/user/national/logs/resites_$F.log
exec >> $LOG 2>&1
echo "== $(date +%T) resites $F"
cd $W; [ -f $D/afdc_ev.geojson ] || python3 tools/fetch_la.py chargers_county $F
cd $P; export CP_FIPS=$F
[ -f $D/osm_sites.json ] && python3 -c "import json,sys;sys.exit(0 if 'water_areas' in json.load(open('$D/osm_sites.json')) else 1)" || {
  python3 fetch_oc.py osm_extract
  PBF=$(ls $D/osm/*.osm.pbf | head -1)
  BOX=$(python3 -c "
import json
c=json.load(open('/home/user/national/data/counties.json'))['$F']
if c['osm']['clip']:
    xs=[];ys=[]
    def w(q):
        if isinstance(q[0],(int,float)): xs.append(q[0]); ys.append(q[1])
        else: [w(t) for t in q]
    [w(f['geometry']['coordinates']) for f in json.load(open('$D/bg.geojson'))['features']]
    print('%.4f,%.4f,%.4f,%.4f'%(min(xs)-.02,min(ys)-.02,max(xs)+.02,max(ys)+.02))")
  cd $W; python3 tools/osm_sites.py $PBF $D/osm_sites.json $BOX; cd $P
}
[ -f $D/tiger_hydro_area.geojson ] || python3 fetch_oc.py tiger_lines
[ "${F:0:2}" = "06" ] && [ "$F" != "06075" ] && python3 fetch_oc.py ccrs
cd $W; python3 tools/sites.py $F $W/county_sites/sites_$F.json
rm -f $D/ccrs_*.json $D/osm_*.json $D/afdc_ev.geojson $D/tiger_*.geojson; rm -rf $D/osm
echo "== $(date +%T) DONE resites $F"
