#!/bin/bash
# Re-run site suggestions for California counties whose crossing / calming candidates predate the CCRS injured-person pedestrian and
# cyclist flags (sites meta pedbike_injured_person_years). Not LA / Orange (their own builds) or San Francisco (DataSF crashes).
# Two workers can run side by side (locks in logs/resite2_locks).   usage: resites_pass2.sh [forward|reverse]   log: logs/resites_pass2.log
cd /home/user/national; ORDER=${1:-forward}; mkdir -p logs/resite2_locks
LIST=$(ls -d pipeline/data_06* | sed 's#pipeline/data_##' | grep -v -e 06059 -e 06075)
[ "$ORDER" = "reverse" ] && LIST=$(echo "$LIST" | tac)
for F in $LIST; do
  S=/home/user/w5/county_sites/sites_$F.json; [ "$F" = "06073" ] && S=/home/user/w5/sd_data/sites_$F.json
  [ -f pipeline/data_$F/bundle-oc.b64 ] || continue
  [ -f $S ] && python3 -c "import json,sys;sys.exit(0 if json.load(open('$S'))['meta'].get('pedbike_injured_person_years') else 1)" && continue
  mkdir logs/resite2_locks/$F 2>/dev/null || continue
  if [ "$F" = "06073" ]; then OUT=$S; else OUT=/home/user/w5/county_sites/sites_$F.json; fi
  sed "s#\$W/county_sites/sites_\$F.json#$OUT#" /home/user/w5/tools/resites.sh > /tmp/resites2_$F.sh; bash /tmp/resites2_$F.sh $F; echo "$(date +%T) $F exit $?" >> logs/resites_pass2.log; rm -f /tmp/resites2_$F.sh
done
echo "RESITES2 PASS DONE ($ORDER)" >> logs/resites_pass2.log
