#!/bin/bash
# Full City Pretty build for one county: pipeline bundle + site suggestions.  usage: build_county.sh <fips>
set -e
F=$1; P=/home/user/national/pipeline; W=/home/user/w5; LOG=/home/user/national/logs/build_$F.log
mkdir -p /home/user/national/logs; exec >> $LOG 2>&1
echo "== $(date +%T) start $F"
cd $P; export CP_FIPS=$F
python3 fetch_oc.py; echo "== $(date +%T) fetched"
python3 osm_extract.py; python3 metrics_oc.py; python3 layers_oc.py; python3 build_oc.py /home/user/page/dec; echo "== $(date +%T) bundle built"
cd $W; python3 tools/fetch_la.py chargers_county $F
PBF=$(ls $P/data_$F/osm/*.osm.pbf | head -1)
BOX=$(python3 -c "import json,sys;c=json.load(open(\"/home/user/national/data/counties.json\"))[sys.argv[1]];import os
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
