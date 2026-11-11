#!/bin/bash
# Round 8.5 finish: once the selection-17 re-runs are done and reviewed, rebuild all regional pages (regions.json, with us-batch-6),
# rebuild the national hosted site (site85) and test it over plain HTTP.   log: regions_build.log, /home/user/national/logs/site85.log
cd /home/user/w5; N=/home/user/national
ready() {
  grep -q "REBUNDLE85B DONE" $N/logs/rebundle85b.log 2>/dev/null || return 1   # transit selection 17 (untimed stops interpolated) + metrics v5/v6
  [ -f $N/logs/station85_reviewed ] || return 1   # written by hand once the round-8.5 effects, station diff and audit fixes are read
  return 0
}
until ready; do sleep 120; done
if ! python3 $N/layer_check.py site84 logs/rebundle85_all.log > $N/logs/layer_check85.log 2>&1; then echo "ROUND 8.5 STOPPED: layer check failed $(date +%T)" >> regions_build.log; exit 1; fi
echo "== round 8.5 pages $(date +%T)" >> regions_build.log
./build_all_regions.sh $(python3 -c "import json;print(' '.join(json.load(open('regions.json'))))")
python3 tools/region_report.py > regions_report85.md
L=$N/logs/site85.log
rm -rf $N/site85 && python3 tools/build_site.py $N/site85 > $L 2>&1
cd $N/site85 && { python3 -m http.server 8772 > /dev/null 2>&1 & SRV=$!; } && sleep 2 && cd /home/user/w5
node tools/regress.js http://127.0.0.1:8772/index.html site85_laoc 2>&1 | grep -E "checks passed|FAIL" >> $L
for t in "53033|King County|1545" "39061|Hamilton County|" "37067|Forsyth County|" "42101|Philadelphia County|1338" "72127|San Juan Municipio|" "12095|Orange County|" "04005|Coconino County|"; do
  IFS='|' read F NM B <<< "$t"
  [ -z "$B" ] && B=$(python3 -c "import json;print(len(json.load(open('$N/pipeline/data_$F/metrics.json'))['metrics']))")
  node tools/countytest.js http://127.0.0.1:8772/index.html site85_$F $F "$NM" $B 2>&1 | grep -E "checks passed|FAIL" >> $L
done
kill $SRV
echo "ROUND 8.5 READY $(date +%T)" >> regions_build.log
