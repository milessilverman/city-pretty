#!/bin/bash
# Round 8.6 finish: once chain86b.sh is done (rebundle86a, the selection-21..23 pass rebundle86b, batch 7, the weekday audit):
#   1. stragglers: any county still below selection 23 or with a bundle older than build_oc.py/engine.py is re-run (rebundle86c.sh);
#   2. Orange's page bundle rebuilt with the final build_oc text (orange86.sh; numbers must not change);
#   3. effects against round 8.5's site (site85): bus frequency, stations, map layers, feed changes, transit gaps;
#   4. all regional pages (regions.json, with us-batch-7) and their tests; region_report -> regions_report86.md; LA's edited panels;
#   5. the national hosted site (site86), laid out for GitHub Pages (city-pretty + city-pretty-data), tested over plain HTTP: LA + Orange
#      regression and countytest.js on 12 counties in both repositories.
# log: regions_build.log, /home/user/national/logs/site86.log
cd /home/user/w5; N=/home/user/national; L=$N/logs/site86.log
stop() { echo "ROUND 8.6 STOPPED: $1 $(date +%T)" >> regions_build.log; exit 1; }
until grep -q "CHAIN86B DONE" $N/logs/chain86.log 2>/dev/null; do sleep 60; done
echo "== round 8.6 finish $(date +%T)" >> regions_build.log
cd $N && ./rebundle86c.sh && cd /home/user/w5
[ "$(grep -c 'EXIT' $N/logs/rebundle86c.log)" = "$(grep -c 'EXIT 0 |' $N/logs/rebundle86c.log)" ] || stop "a straggler re-run failed (logs/rebundle86c.log)"
# install86h (round 8.6 data fixes) changed Orange's numbers on purpose (logs/orange86_diff_fix86h.txt); the bundle built then is the baseline
cd $N && ORANGE_BASE=$N/backups_oc_regress_86j ./orange86.sh >> $L 2>&1 || stop "Orange rebuild failed"
head -1 $N/logs/orange86_diff.txt | grep -q "^number changes: 0$" || stop "Orange's numbers changed since install86j (logs/orange86_diff.txt)"
LOGS="logs/rebundle86a.log logs/rebundle86b.log logs/rebundle86c.log"
python3 -I transit7_effect.py site85 $LOGS > logs/transit_effect86.md 2>&1 || stop "transit effect failed"
python3 -I station_effect.py site85 $LOGS > logs/station_effect86.md 2>&1 || stop "station effect failed"
python3 -I layer_check.py site85 $LOGS > logs/layer_check86.log 2>&1 || stop "layer check failed"
python3 -I r86_feed_changes.py > logs/r86_feed_changes.out 2>&1 || stop "feed changes failed"
python3 -I r86_transit_gaps.py > logs/r86_transit_gaps.out 2>&1 || stop "transit gaps failed"
cd /home/user/w5
echo "== round 8.6 pages $(date +%T)" >> regions_build.log
./build_all_regions.sh $(python3 -c "import json;print(' '.join(json.load(open('regions.json'))))")
python3 tools/region_report.py > regions_report86.md
node tools/lacheck84.js /home/user/w5/regions/socal/city-pretty-socal.html > $N/logs/lacheck86.log 2>&1   # an absolute path: the script builds a file:// URL
rm -rf $N/site86 && python3 tools/build_site.py $N/site86 --split city-pretty:900,city-pretty-data:950 > $L 2>&1 || stop "site build failed"
cd $N/site86 && { python3 -m http.server 8772 > /dev/null 2>&1 & SRV=$!; } && sleep 2 && cd /home/user/w5
U=http://127.0.0.1:8772/city-pretty/index.html
node tools/regress.js $U site86_laoc 2>&1 | grep -E "checks passed|FAIL" >> $L
for t in "53033|King County|1545" "39061|Hamilton County|" "37067|Forsyth County|" "42101|Philadelphia County|1338" "72127|San Juan Municipio|" "12095|Orange County|" "04005|Coconino County|" "12031|Duval County|" "48113|Dallas County|" "18097|Marion County|" "18157|Tippecanoe County|" "47155|Sevier County|"; do
  IFS='|' read F NM B <<< "$t"
  [ -z "$B" ] && B=$(python3 -c "import json;print(len(json.load(open('$N/pipeline/data_$F/metrics.json'))['metrics']))")
  node tools/countytest.js $U site86_$F $F "$NM" $B 2>&1 | grep -E "checks passed|FAIL" >> $L
done
kill $SRV
echo "ROUND 8.6 READY $(date +%T)" >> regions_build.log
