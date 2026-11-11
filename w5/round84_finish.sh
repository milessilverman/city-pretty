#!/bin/bash
# Round 8.4 finish: once every built county is re-bundled with GTFS-confirmed rail stations (round84_start.sh), rebuild all regional pages,
# rebuild the national hosted site (site84) and test it over plain HTTP.   log: regions_build.log, /home/user/national/logs/site84.log
cd /home/user/w5; N=/home/user/national
ready() {
  grep -q "REBUNDLE84 DONE" $N/logs/rebundle84.log 2>/dev/null || return 1
  grep -q "REBUNDLE84B DONE" $N/logs/rebundle84b.log 2>/dev/null || return 1   # the counties re-run after the rule's refinements
  grep -q "REBUNDLE84C DONE" $N/logs/rebundle84c.log 2>/dev/null || return 1
  grep -q "REBUNDLE84D DONE" $N/logs/rebundle84d.log 2>/dev/null || return 1
  grep -q "REBUNDLE84E DONE" $N/logs/rebundle84e.log 2>/dev/null || return 1
  grep -q "REBUNDLE84F DONE" $N/logs/rebundle84f.log 2>/dev/null || return 1
  grep -q "REBUNDLE84G DONE" $N/logs/rebundle84g.log 2>/dev/null || return 1   # transit selection 10 (Veterans Day)
  grep -q "REBUNDLE84H DONE" $N/logs/rebundle84h.log 2>/dev/null || return 1   # its second pass (bus-stop layers)
  grep -q "REBUNDLE84I DONE" $N/logs/rebundle84i.log 2>/dev/null || return 1   # transit selection 11 (morning departures)
  grep -q "REBUNDLE84J DONE" $N/logs/rebundle84j.log 2>/dev/null || return 1   # transit selection 12 (no fixed-date holiday)
  grep -q "REBUNDLE84K DONE" $N/logs/rebundle84k.log 2>/dev/null || return 1   # transit selections 14 and 15 (the audit's and the rail list)
  grep -q "REBUNDLE84L DONE" $N/logs/rebundle84l.log 2>/dev/null || return 1   # transit selection 16 (the audit's list)
  grep -q "ALL DONE us_queue5.txt" $N/logs/batch5a.log 2>/dev/null || return 1   # batch 5 complete, so site84 has all of it
  [ -f $N/logs/station84_reviewed ] || return 1   # written by hand once station84_review.py's lists of dropped / kept / added stations are read
  [ -f $N/logs/station84_reviewed2 ] || return 1   # written by hand after round84_effects.sh has run on the final re-runs (selection 15's
  #                                                 station names and non-passenger stops) and its station lists and effect tables are read
  return 0
}
until ready; do sleep 120; done
if ! python3 $N/layer_check.py site83 logs/rebundle84.log > $N/logs/layer_check84.log 2>&1; then echo "ROUND 8.4 STOPPED: layer check failed $(date +%T)" >> regions_build.log; exit 1; fi
echo "== round 8.4 pages $(date +%T)" >> regions_build.log
./build_all_regions.sh $(python3 -c "import json;print(' '.join(json.load(open('regions.json'))))")
python3 tools/region_report.py > regions_report84.md
L=$N/logs/site84.log
rm -rf $N/site84 && python3 tools/build_site.py $N/site84 > $L 2>&1
cd $N/site84 && { python3 -m http.server 8771 > /dev/null 2>&1 & SRV=$!; } && sleep 2 && cd /home/user/w5
node tools/regress.js http://127.0.0.1:8771/index.html site84_laoc 2>&1 | grep -E "checks passed|FAIL" >> $L
for t in "53033|King County|1545" "39061|Hamilton County|" "37067|Forsyth County|" "42101|Philadelphia County|1338" "72127|San Juan Municipio|"; do
  IFS='|' read F NM B <<< "$t"
  [ -z "$B" ] && B=$(python3 -c "import json;print(len(json.load(open('$N/pipeline/data_$F/metrics.json'))['metrics']))")
  node tools/countytest.js http://127.0.0.1:8771/index.html site84_$F $F "$NM" $B 2>&1 | grep -E "checks passed|FAIL" >> $L
done
kill $SRV
echo "ROUND 8.4 READY $(date +%T)" >> regions_build.log
