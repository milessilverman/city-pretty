#!/bin/bash
# Collect the round-8.3 deliverables into /home/user/handoff/round8.3 (pages, report, docs, test results, quality table)
set -e
H=/home/user/handoff/round8.3; W=/home/user/w5; N=/home/user/national
mkdir -p $H/tests
cp $W/REPORT-round8.3.md $H/
cp $N/README.md $H/national-README.md
cp $N/STATE_CRASH_SOURCES.md $H/
mkdir -p $H/research; cp $N/crash_research_A.md $N/crash_research_B.md $H/research/ 2>/dev/null || true
cp $N/logs/quality.md $H/county-quality.md
[ -f /home/user/handoff/round7/la_crash_count_check.md ] && cp /home/user/handoff/round7/la_crash_count_check.md $H/
for d in $W/regions/*/; do
  n=$(basename $d); [ "$n" = "test-ri" ] && continue
  [ -f $d/city-pretty-$n.html ] && cp $d/city-pretty-$n.html $H/
  [ -f $d/tests.json ] && cp $d/tests.json $H/tests/tests-$n.json
done
cp $W/regions_report83.md $H/regional-pages.md
python3 $N/national_status.py > $H/national-status.txt
cp $N/site83/counties/manifest.json $H/national-site-manifest.json 2>/dev/null || true
mkdir -p $H/transit
for f in transit8_check.log transit8b_check.log transit8_rebundle.log transit8b_rebundle.log station_rebundle.log station2_rebundle.log transit7_rebundle.notes station_scan.json station_scan2.json transit8_effect_table.md station_effect_table.md transit_effect_site82.json station_effect.json layer_check83.log; do
  [ -f $N/logs/$f ] && cp $N/logs/$f $H/transit/
done
cp $N/transit8_check.py $N/transit7_effect.py $N/station_scan.py $N/station_scan2.py $N/station_effect.py $N/build_station_queue.py $N/layer_check.py $H/transit/
ls -la $H
