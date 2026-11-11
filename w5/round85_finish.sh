#!/bin/bash
# Round 8.5 finish (v2): once the Veterans Day re-run (rebundle85e) and CamTran's counties at selection 19 (rebundle85h) are done:
#   1. sources_text85.py: every bundle gets the final wording of the transit and rail-stop sources rows (text only);
#   2. the layer check of every round-8.5 re-run (85a-85e, 85g) against round 8.4's site (site84);
#   3. all regional pages (regions.json, with us-batch-6) and their tests; region_report -> regions_report85.md;
#   4. the national hosted site (site85), tested over plain HTTP: LA + Orange regression, countytest.js on 9 counties, LA's edited panels.
# log: regions_build.log, /home/user/national/logs/site85.log
cd /home/user/w5; N=/home/user/national
until grep -q "REBUNDLE85H DONE" $N/logs/rebundle85h.log 2>/dev/null; do sleep 60; done   # 85e, then selection 19 and CamTran's counties (chain85h.sh)
if ! python3 $N/sources_text85.py > $N/logs/sources_text85.log 2>&1; then echo "ROUND 8.5 STOPPED: sources text patch failed $(date +%T)" >> regions_build.log; exit 1; fi
cat $N/logs/rebundle85_all.log $N/logs/rebundle85d.log $N/logs/rebundle85e.log $N/logs/rebundle85g.log $N/logs/rebundle85h.log > $N/logs/rebundle85_all2.log
if ! python3 $N/layer_check.py site84 logs/rebundle85_all2.log > $N/logs/layer_check85.log 2>&1; then echo "ROUND 8.5 STOPPED: layer check failed $(date +%T)" >> regions_build.log; exit 1; fi
echo "== round 8.5 pages $(date +%T)" >> regions_build.log
./build_all_regions.sh $(python3 -c "import json;print(' '.join(json.load(open('regions.json'))))")
python3 tools/region_report.py > regions_report85.md
node tools/lacheck84.js /home/user/w5/regions/socal/city-pretty-socal.html > $N/logs/lacheck85.log 2>&1   # an absolute path: the script builds a file:// URL
L=$N/logs/site85.log
rm -rf $N/site85 && python3 tools/build_site.py $N/site85 > $L 2>&1
cd $N/site85 && { python3 -m http.server 8772 > /dev/null 2>&1 & SRV=$!; } && sleep 2 && cd /home/user/w5
node tools/regress.js http://127.0.0.1:8772/index.html site85_laoc 2>&1 | grep -E "checks passed|FAIL" >> $L
for t in "53033|King County|1545" "39061|Hamilton County|" "37067|Forsyth County|" "42101|Philadelphia County|1338" "72127|San Juan Municipio|" "12095|Orange County|" "04005|Coconino County|" "12031|Duval County|" "48113|Dallas County|"; do
  IFS='|' read F NM B <<< "$t"
  [ -z "$B" ] && B=$(python3 -c "import json;print(len(json.load(open('$N/pipeline/data_$F/metrics.json'))['metrics']))")
  node tools/countytest.js http://127.0.0.1:8772/index.html site85_$F $F "$NM" $B 2>&1 | grep -E "checks passed|FAIL" >> $L
done
kill $SRV
echo "ROUND 8.5 READY $(date +%T)" >> regions_build.log
