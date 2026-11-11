#!/bin/bash
# Build and test every regional page in regions.json (or the ones named): log regions_build.log
cd /home/user/w5
for R in ${@:-$(python3 -c "import json;print(' '.join(json.load(open('regions.json'))))")}; do
  echo "== $(date +%T) $R" >> regions_build.log
  python3 tools/build_region.py $R $(python3 -c "import json;print(' '.join(json.load(open('regions.json'))['$R']))") >> regions_build.log 2>&1
done
echo "ALL REGIONS DONE $(date +%T)" >> regions_build.log
