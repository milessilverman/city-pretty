#!/bin/bash
# Round 8.2 finish: once every built county has the current transit selection (7) and every changed county is re-bundled, rebuild all regional pages,
# rebuild the national hosted site (site82) and test it over plain HTTP.   log: regions_build.log, /home/user/national/logs/site82.log
cd /home/user/w5; N=/home/user/national
ready() {
  [ -z "$(python3 $N/transit7_todo.py)" ] || return 1
  pgrep -f "transit[67]_check.py" > /dev/null && return 1
  grep -q "TRANSIT6 REBUNDLE DONE" $N/logs/transit6_rebundle.log 2>/dev/null || return 1   # the selection-6 queue, re-bundled first
  for F in $(cat $N/logs/transit7_rebundle.txt 2>/dev/null); do
    grep -q " $F EXIT" $N/logs/transit7_rebundle.log 2>/dev/null || return 1
  done
  return 0
}
until ready; do sleep 120; done
if ! python3 $N/layer_check.py > $N/logs/layer_check82.log 2>&1; then echo "ROUND 8.2 STOPPED: layer check failed $(date +%T)" >> regions_build.log; exit 1; fi
echo "== round 8.2 pages $(date +%T)" >> regions_build.log
./build_all_regions.sh $(python3 -c "import json;print(' '.join(json.load(open('regions.json'))))")
python3 tools/region_report.py > regions_report82.md
L=$N/logs/site82.log
rm -rf $N/site82 && python3 tools/build_site.py $N/site82 > $L 2>&1
cd $N/site82 && { python3 -m http.server 8769 > /dev/null 2>&1 & SRV=$!; } && sleep 2 && cd /home/user/w5
node tools/regress.js http://127.0.0.1:8769/index.html site82_laoc 2>&1 | grep -E "checks passed|FAIL" >> $L
for t in "53033|King County|1545" "39061|Hamilton County|" "37067|Forsyth County|" "42101|Philadelphia County|1338"; do
  IFS='|' read F NM B <<< "$t"
  [ -z "$B" ] && B=$(python3 -c "import json;print(len(json.load(open('$N/pipeline/data_$F/metrics.json'))['metrics']))")
  node tools/countytest.js http://127.0.0.1:8769/index.html site82_$F $F "$NM" $B 2>&1 | grep -E "checks passed|FAIL" >> $L
done
kill $SRV
echo "ROUND 8.2 READY $(date +%T)" >> regions_build.log
