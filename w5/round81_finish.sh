#!/bin/bash
# Round 8.1 finish: after the land / pedestrian-cyclist / transit re-bundle and the California site pass, rebuild all regional pages,
# rebuild the national hosted site, and test the site over plain HTTP.   log: regions_build.log, /home/user/national/logs/site81.log
cd /home/user/w5
until [ $(grep -c "RESITES2 PASS DONE" /home/user/national/logs/resites_pass2.log 2>/dev/null || echo 0) -ge 2 ]; do sleep 60; done
echo "== round 8.1 pages $(date +%T)" >> regions_build.log
./build_all_regions.sh $(python3 -c "import json;print(' '.join(json.load(open('regions.json'))))")
python3 tools/region_report.py > regions_report81.md
L=/home/user/national/logs/site81.log
rm -rf /home/user/national/site81 && python3 tools/build_site.py /home/user/national/site81 > $L 2>&1
cd /home/user/national/site81 && (python3 -m http.server 8768 > /dev/null 2>&1 &) && sleep 2 && cd /home/user/w5
node tools/regress.js http://127.0.0.1:8768/index.html site81_laoc 2>&1 | grep -E "checks passed|FAIL" >> $L
for t in "06001|Alameda County|1134" "48029|Bexar County|1139" "04013|Maricopa County|2806" "42101|Philadelphia County|1338"; do
  IFS='|' read F N B <<< "$t"; node tools/countytest.js http://127.0.0.1:8768/index.html site81_$F $F "$N" $B 2>&1 | grep -E "checks passed|FAIL" >> $L
done
pkill -f "http.server 8768"
echo "ROUND 8.1 READY $(date +%T)" >> regions_build.log
