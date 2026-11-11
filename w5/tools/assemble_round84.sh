#!/bin/bash
# Collect the round-8.4 deliverables into /home/user/handoff/round8.4 (pages, report, docs, test results, quality table)
set -e
H=/home/user/handoff/round8.4; W=/home/user/w5; N=/home/user/national
mkdir -p $H/tests
cp $W/REPORT-round8.4.md $H/
cp $N/README.md $H/national-README.md; cp $N/NEXT_ROUND.md $H/NEXT_ROUND.md
cp $N/STATE_CRASH_SOURCES.md $H/
mkdir -p $H/research; cp $N/crash_research_A.md $N/crash_research_B.md $H/research/ 2>/dev/null || true
cp $N/logs/quality.md $H/county-quality.md
[ -f /home/user/handoff/round7/la_crash_count_check.md ] && cp /home/user/handoff/round7/la_crash_count_check.md $H/
for n in $(python3 -c "import json;print(' '.join(json.load(open('/home/user/w5/regions.json'))))"); do   # the pages in regions.json only (no test pages)
  d=$W/regions/$n
  [ -f $d/city-pretty-$n.html ] && cp $d/city-pretty-$n.html $H/
  [ -f $d/tests.json ] && cp $d/tests.json $H/tests/tests-$n.json
done
cp $W/regions_report84.md $H/regional-pages.md
python3 $N/national_status.py > $H/national-status.txt
cp $N/site84/counties/manifest.json $H/national-site-manifest.json 2>/dev/null || true
mkdir -p $H/stations
for f in rebundle84.log rebundle84b.log rebundle84c.log rebundle84d.log rebundle84e.log rebundle84f.log rebundle84g.log rebundle84h.log rebundle84i.log rebundle84j.log rebundle84k.log rebundle84l.log rebundle84j_queue.txt rebundle84k_queue.txt rebundle84l_queue.txt transit_day_audit_sel14.json transit_day_audit_sel14.md transit_day_audit_sel14_queue.txt transit_day_audit.json transit_day_audit.md transit_day_audit_queue.txt transit_day_audit.log transit_day_audit_sel13.json transit_day_audit_sel13.md transit_day_audit_sel13_queue.txt transit_day_audit_sel13.log rail15_sim.json rail15_queue.txt rebundle84.notes station84_reviewed station84_reviewed2 station84_diff_after_review.txt station84_review_0505.json round84_effects.out station84_review.md station84_review.json station_effect_site83.json station_effect84_table.md transit_effect_site83.json transit84_effect_table.md transit84_effect_table_pre_sel10.md transit_effect_site83_pre_sel10.json sites_drop_stations.log layer_check84.log site84.log; do
  [ -f $N/logs/$f ] && cp $N/logs/$f $H/stations/
done
cp $N/station84_review.py $N/station_diff.py $N/station_effect.py $N/transit7_effect.py $N/layer_check.py $N/round84_start.sh $N/round84_effects.sh $N/rebundle84g.sh $N/rebundle84i.sh $N/rebundle84j.sh $N/rebundle84k.sh $N/rebundle84k_w4.sh $N/rebundle84l.sh $N/rebundle84k_queue.py $N/transit_day_audit.py $N/rail15_sim.py $W/tools/sites_drop_stations.py $W/tools/lacheck84.js $H/stations/
cp $N/pipeline/fetch_oc.py $H/stations/fetch_oc_selection16.py
cp $N/pipeline/metrics_oc.py $H/stations/metrics_oc_round84.py
cp $W/tools/la_station_fix.py $W/research/la_station_fix_r84.json $W/research/la_transit_rail_stops_r84.json $N/pipeline/oc_rail_stops.py $H/stations/
cp $N/backups_oc_regress_pre84/regress_new_oc.log $H/stations/oc_regress_rebuild_test.log 2>/dev/null || true
grep -E "^site |checks passed|FAIL" $N/logs/site84.log > $H/tests/site84-tests.txt 2>/dev/null || true
ls -la $H
