#!/bin/bash
# Re-run the site-suggestion steps of build_county2.sh for a county whose bundle is built (chargers, OSM sites, sites.py), then clean up
# as queue_worker.sh does.  usage: sites_only.sh <fips>   (log: appended to logs/build_<fips>.log)
set -e
F=$1; P=/home/user/national/pipeline; W=/home/user/w5; LOG=/home/user/national/logs/build_$F.log
exec >> $LOG 2>&1
echo "== $(date +%T) sites only $F"
cd $W; python3 tools/fetch_la.py chargers_county $F
PBF=$(ls $P/data_$F/osm/*.osm.pbf | head -1)
BOX=$(python3 -c "import json,sys;c=json.load(open(\"/home/user/national/data/counties.json\"))[sys.argv[1]]
if not c[\"osm\"][\"clip\"]: print(\"\")
else:
  xs=[];ys=[]
  def w(q):
    if isinstance(q[0],(int,float)): xs.append(q[0]); ys.append(q[1])
    else: [w(x) for x in q]
  [w(f[\"geometry\"][\"coordinates\"]) for f in json.load(open(\"/home/user/national/pipeline/data_\"+sys.argv[1]+\"/bg.geojson\"))[\"features\"]]
  print(\"%.4f,%.4f,%.4f,%.4f\" % (min(xs)-.02,min(ys)-.02,max(xs)+.02,max(ys)+.02))" $F)
python3 tools/osm_sites.py $PBF $P/data_$F/osm_sites.json $BOX
mkdir -p $W/county_sites; python3 tools/sites.py $F $W/county_sites/sites_$F.json
echo "== $(date +%T) DONE $F"
D=$P/data_$F
if [ -f $W/county_sites/sites_$F.json ]; then
  rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json
  rm -rf $D/osm
fi
