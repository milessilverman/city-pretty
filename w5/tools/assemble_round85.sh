#!/bin/bash
# Collect the round-8.5 deliverables into /home/user/handoff/round8.5 (pages, report, errata, docs, test results, quality table, evidence)
set -e
H=/home/user/handoff/round8.5; W=/home/user/w5; N=/home/user/national
mkdir -p $H/tests $H/evidence/logs $H/evidence/code $H/research
cp $W/REPORT-round8.5.md $W/round85/ERRATA-round8.4.md $H/
cp $N/README.md $H/national-README.md; cp $N/NEXT_ROUND.md $H/NEXT_ROUND.md
cp $N/STATE_CRASH_SOURCES.md $H/
cp $N/crash_research_A.md $N/crash_research_B.md $H/research/ 2>/dev/null || true
cp $N/logs/quality.md $H/county-quality.md
[ -f /home/user/handoff/round7/la_crash_count_check.md ] && cp /home/user/handoff/round7/la_crash_count_check.md $H/
for n in $(python3 -c "import json;print(' '.join(json.load(open('/home/user/w5/regions.json'))))"); do   # the pages in regions.json only (no test pages)
  d=$W/regions/$n
  [ -f $d/city-pretty-$n.html ] && cp $d/city-pretty-$n.html $H/
  [ -f $d/tests.json ] && cp $d/tests.json $H/tests/tests-$n.json
done
cp $W/regions_report85.md $H/regional-pages.md
python3 $N/national_status.py > $H/national-status.txt
cp $N/site85/counties/manifest.json $H/national-site-manifest.json 2>/dev/null || true
grep -E "^site |checks passed|FAIL" $N/logs/site85.log > $H/tests/site85-tests.txt 2>/dev/null || true
cp $N/logs/lacheck85.log $H/tests/la-edited-panels.txt 2>/dev/null || true
for f in rebundle84.notes rebundle85a.log rebundle85b.log rebundle85c.log rebundle85d.log rebundle85e.log rebundle85g.log rebundle85_all2.log merge85_queue.txt rebundle85b_queue.txt rebundle85d_queue.txt rebundle85e_queue.txt rebundle85f_queue.txt rebundle85g_queue.txt \
         untimed_scan.json station85_reviewed station85_diff.txt station_effect_site84.json station85_effect_table.md transit85_effect_table.md transit85b_effect_table.md transit85e_effect_table.md transit_effect85b_site84.json transit_effect85e_site84.json vet85_effect.json station85_batch6_review.md rebundle85h.log rebundle85h_queue.txt \
         layer_check85.log transit_day_audit.json transit_day_audit.md transit_day_audit_queue.txt transit_day_audit.log transit_day_audit_sel17.json transit_day_audit_sel17.md \
         sources_text85.json sources_text85.log station_status85.json audit85_result.json site85.log rebuild85d_06059.log rebuild85g_12031.log; do
  [ -f $N/logs/$f ] && cp $N/logs/$f $H/evidence/logs/
done
cp $N/pipeline/fetch_oc.py $H/evidence/code/fetch_oc_selection18.py
cp $N/pipeline/metrics_oc.py $H/evidence/code/metrics_oc_v8.py
cp $N/pipeline/build_oc.py $N/pipeline/stations_not_served.json $H/evidence/code/
cp $N/sources_text85.py $N/transit_day_audit.py $N/station_effect.py $N/transit7_effect.py $N/layer_check.py $N/merge85_rule_sim.py $N/untimed_scan.py $N/rail15_sim.py \
   $N/rebundle85a.sh $N/rebundle85b.sh $N/rebundle85d.sh $N/rebundle85e.sh $N/rebundle85g.sh $N/rebundle85h.sh $N/chain85h.sh $N/vet85_effect.py $W/round85_finish.sh $W/round85/make_errata.py $W/tools/assemble_round85.sh $H/evidence/code/ 2>/dev/null || true
cp $W/tools/fetch_la.py $H/evidence/code/fetch_la.py
ls -la $H; du -sh $H
