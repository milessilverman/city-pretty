#!/bin/bash
# Collect the round-8.1 deliverables into /home/user/handoff/round8.1 (pages, report, docs, test results, quality table)
set -e
H=/home/user/handoff/round8.1; W=/home/user/w5; N=/home/user/national
mkdir -p $H/tests
cp $W/REPORT-round8.1.md $H/
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
cp $W/regions_report81.md $H/regional-pages.md
python3 $N/national_status.py > $H/national-status.txt
cp $N/site81/counties/manifest.json $H/national-site-manifest.json 2>/dev/null || true
ls -la $H
