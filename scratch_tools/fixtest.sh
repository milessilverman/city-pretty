#!/bin/bash
# Round 8.6 data-fix test for one county: full build with the patched scratch pipeline (t86c), then the same data through the old
# (text-only) metrics_oc, with the old acs_place.json, and both through the new build_oc.   usage: fixtest.sh <fips>
S=/tmp/claude-0/-home-user-city-pretty/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad; T=$S/t86c; OLD=/tmp/claude-0/-home-user/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad/t86b/pipeline
F=$1; D=$T/l_$F; LOG=$T/l_$F.log; mkdir -p "$D"
export CP_FIPS=$F CP_DATA=$D
cd $T/pipeline || exit 1
{ echo "$(date +%T) new pipeline"; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec; echo "NEW EXIT $?"; } > $LOG 2>&1
grep -q "^NEW EXIT 0" $LOG || { echo "$F new build failed"; exit 1; }
cp -p $D/metrics.json $D/metrics_new.json; cp -p $D/bundle-oc.json $D/bundle_new.json; cp -p $D/acs_place.json $D/acs_place_new.json
[ -f /home/user/national/pipeline/data_$F/acs_place.json ] && cp -p /home/user/national/pipeline/data_$F/acs_place.json $D/acs_place.json
{ echo "$(date +%T) old metrics (text only), old place file"; python3 $OLD/metrics_oc.py; echo "OLDM EXIT $?"; } >> $LOG 2>&1
cp -p $D/metrics.json $D/metrics_old.json
{ echo "$(date +%T) new build_oc on old metrics"; python3 build_oc.py /home/user/page/dec; echo "OLDB EXIT $?"; } >> $LOG 2>&1
cp -p $D/bundle-oc.json $D/bundle_oldmetrics.json
cp -p $D/acs_place_new.json $D/acs_place.json; cp -p $D/metrics_new.json $D/metrics.json; cp -p $D/bundle_new.json $D/bundle-oc.json
rm -rf "${D:?}/osm"; rm -f "${D:?}"/tiger_*.geojson "${D:?}"/ccrs_*.json "${D:?}"/osm_*.json
echo "$(date +%T) $F done: $(grep -c 'EXIT 0' $LOG) of 3 steps exit 0" | tee -a $LOG
