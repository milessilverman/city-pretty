#!/bin/bash
# Round 8 finish: after the final page pass and the new-states page, wait for the transit (selection 5) re-bundle of the priority counties that sit in
# California pages, rebuild those pages (bay-area, central-coast, central-valley, sacramento-region), then write the region report and
# assemble the handoff.   log: regions_build.log
cd /home/user/w5
S=$(grep -n "round 8 final pass (patch6 sections 12-17" regions_build.log | tail -1 | cut -d: -f1)
until tail -n +$S regions_build.log | grep -q "ALL REGIONS DONE" && tail -n +$S regions_build.log | grep -q "REGION DONE us-new-states"; do sleep 60; done
sel4() { python3 -c "import json,sys;c=json.load(open('/home/user/national/pipeline/data_$1/metrics.json'))['coverage'].get('transit') or {};sys.exit(0 if (c.get('selection') or 0)>=5 else 1)" 2>/dev/null; }
for F in 06001 06013 06081 06075 06085 06067 06007 06053 06019 06029; do until sel4 $F; do sleep 60; done; done
echo "== round 8 transit-v5 pages $(date +%T)" >> regions_build.log
./build_all_regions.sh bay-area central-coast central-valley sacramento-region
python3 tools/region_report.py > regions_report.md
echo "ROUND 8 PAGES READY $(date +%T)" >> regions_build.log
