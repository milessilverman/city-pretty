#!/bin/bash
# full scratch build of one county with the scratch pipeline (t86b/pipeline) into a new folder t86b/l86_<fips>   usage: scratch_build.sh <fips>
T=/tmp/claude-0/-home-user/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad/t86b; F=$1; D=$T/l86_$F
mkdir -p $D && cd $T/pipeline || exit 1
export CP_FIPS=$F CP_DATA=$D
( python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $T/l86_$F.log 2>&1
echo "EXIT $?" >> $T/l86_$F.log
