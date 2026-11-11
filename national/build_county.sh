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
python3 tools/osm_sites.py $PBF $P/data_$F/osm_sites.json
mkdir -p $W/county_sites; python3 tools/sites.py $F $W/county_sites/sites_$F.json
echo "== $(date +%T) DONE $F"
