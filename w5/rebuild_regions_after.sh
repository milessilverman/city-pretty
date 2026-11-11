#!/bin/bash
# After the round-8 region runner finishes: rebuild the pages made before patch6 sections 12-14 (county-aware credits, no parcel layer
# outside LA / Orange County), so every round-8 page carries the same patch set.
cd /home/user/w5
S=$(grep -n "round 8 rebuild" regions_build.log | tail -1 | cut -d: -f1)
until tail -n +$S regions_build.log | grep -q "ALL REGIONS DONE"; do sleep 60; done
echo "== round 8 second pass (patch6 section 12) $(date +%T)" >> regions_build.log
./build_all_regions.sh central-coast bay-area socal central-valley sacramento-region north-coast-and-mountains us-sample
