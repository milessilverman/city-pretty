#!/bin/bash
# full build of one county with the scratch pipeline t86c into t86c/l2_<fips>   usage: newbuild.sh <fips>
S=/tmp/claude-0/-home-user-city-pretty/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad; T=$S/t86c; F=$1; D=$T/l2_$F; mkdir -p $D
cd $T/pipeline || exit 1
export CP_FIPS=$F CP_DATA=$D
( python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $T/l2_$F.log 2>&1
echo "EXIT $?" >> $T/l2_$F.log
rm -rf "${D:?}/osm"; rm -f "${D:?}"/tiger_*.geojson "${D:?}"/ccrs_*.json "${D:?}"/osm_*.json
