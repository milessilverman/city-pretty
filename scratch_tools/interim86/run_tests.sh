#!/bin/bash
S=/tmp/claude-0/-home-user-city-pretty/763724d0-bb10-5922-8d31-bd70781887d0/scratchpad; D=$S/interim86; W5=/home/user/w5; U=http://127.0.0.1:8790/index.html; O=$D/tests.out
cd /tmp
node $W5/tools/regress.js $U interim_laoc 2>&1 | grep -E "checks passed|FAIL" > $O
for t in "37183|Wake County" "53033|King County" "12095|Orange County" "72127|San Juan Municipio"; do
  IFS='|' read F NM <<< "$t"
  B=$(python3 -I -c "import json,gzip;print(len(json.load(gzip.open('/home/user/city-pretty/counties/bundle_$F.json.gz'))['details']))")
  node $W5/tools/countytest.js $U interim_$F $F "$NM" $B 2>&1 | grep -E "checks passed|FAIL" >> $O
done
node $S/addrtest/addr_test.js $U 2>&1 | grep -E "^T[0-9]|TEST ERROR" >> $O
node $S/addrtest/lots_test.js $U 2>&1 | grep -E "^L[0-9]|errors|TEST ERROR" | cut -c1-300 >> $O
echo "TESTS DONE" >> $O
