#!/bin/bash
# Re-run site suggestions (shore rule v2, tunnel filter) for every built county except LA / Orange: out-of-state first, then California.
# Two workers can run side by side (locks). usage: resites_pass.sh [forward|reverse]
cd /home/user/national; ORDER=${1:-forward}; mkdir -p logs/resite_locks
LIST=$( (grep -v '^06' us_queue.txt; echo 08031; ls -d pipeline/data_06* | sed 's#pipeline/data_##' | grep -v 06059) )
[ "$ORDER" = "reverse" ] && LIST=$(echo "$LIST" | tac)
for F in $LIST; do
  S=/home/user/w5/county_sites/sites_$F.json; [ "$F" = "06073" ] && S=/home/user/w5/sd_data/sites_$F.json
  [ -f pipeline/data_$F/bundle-oc.b64 ] || continue
  [ -f logs/build_$F.log ] && ! grep -q "DONE $F" logs/build_$F.log && continue   # still being built by a batch
  [ -f $S ] && python3 -c "import json,sys;sys.exit(0 if json.load(open('$S'))['meta'].get('creek_shore_rule')==2 else 1)" && continue
  mkdir logs/resite_locks/$F 2>/dev/null || continue
  if [ "$F" = "06073" ]; then OUT=$S; else OUT=/home/user/w5/county_sites/sites_$F.json; fi
  sed "s#\$W/county_sites/sites_\$F.json#$OUT#" /home/user/w5/tools/resites.sh > /tmp/resites_$F.sh; bash /tmp/resites_$F.sh $F; echo "$(date +%T) $F exit $?" >> logs/resites_pass.log; rm -f /tmp/resites_$F.sh
done
echo "RESITES PASS DONE ($ORDER)" >> logs/resites_pass.log
