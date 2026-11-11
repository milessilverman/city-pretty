#!/bin/bash
# Round 8.4: transit selection 12 (05:44:45; a Wednesday on a fixed-date holiday is never the representative day). After the selection-11
# pass ends, re-run every county still measured on 11 Nov for some feed that either differs from round 8.3 (bus frequency or stop layer)
# or has no round-8.3 bundle (batch 5), plus the county batch 5 is building. Three workers.  log: logs/rebundle84j.log
cd /home/user/national
until grep -q "REBUNDLE84I DONE" logs/rebundle84i.log 2>/dev/null; do sleep 30; done
python3 - <<'PY'
import json, gzip, base64, glob, os
N = "/home/user/national"
q = []
for p in sorted(glob.glob(f"{N}/pipeline/data_*/transit_stops_7_9.meta.json")):
    F = p.split("data_")[1][:5]
    m = json.load(open(p))
    if not any(fd.get("weekday") == "2026-11-11" for fd in m.get("feeds", [])): continue
    o = f"{N}/site83/counties/bundle_{F}.json.gz"
    if not os.path.exists(o): q.append(F); continue
    O = json.loads(gzip.decompress(open(o, "rb").read())); B = json.loads(gzip.decompress(base64.b64decode(open(f"{N}/pipeline/data_{F}/bundle-oc.b64").read())))
    if any(x["m"].get("bt") != B["details"].get(g, {}).get("m", {}).get("bt") for g, x in O["details"].items()):
        q.append(F); continue
    fo = ((O.get("layers") or {}).get("stops") or {}).get("features", []); fn = ((B.get("layers") or {}).get("stops") or {}).get("features", [])
    to = sum((f["properties"].get("t") or 0) for f in fo); tn = sum((f["properties"].get("t") or 0) for f in fn)
    if len(fo) != len(fn) or abs(to - tn) > 0.02 * max(to, 1): q.append(F)
open(f"{N}/logs/rebundle84j_queue.txt", "w").write("\n".join(q) + "\n")
print(len(q), "counties queued")
PY
F=$(ls -t logs/build_locks | head -1); grep -q " $F " logs/batch5a.log || echo $F >> logs/rebundle84j_queue.txt
sort -u logs/rebundle84j_queue.txt -o logs/rebundle84j_queue.txt
echo "$(date +%T) $(wc -l < logs/rebundle84j_queue.txt) counties queued" >> logs/rebundle84j.log
cd pipeline; mkdir -p /home/user/national/logs/locks12j
worker() {
for F in $(cat /home/user/national/logs/rebundle84j_queue.txt); do
  mkdir /home/user/national/logs/locks12j/$F 2>/dev/null || continue
  until grep -q " $F EXIT" /home/user/national/logs/rebundle84.log || grep -q " $F " /home/user/national/logs/batch5a.log; do sleep 30; done
  D=data_$F; LOG=/home/user/national/logs/rebuild14j_$F.log
  ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
  echo "EXIT $?" >> $LOG
  if grep -q "^EXIT 0" $LOG; then
    rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
  fi
  echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle84j.log
done
}
worker & A=$!; sleep 10; worker & B=$!; sleep 10; worker & C=$!
wait $A $B $C
echo "$(date +%T) REBUNDLE84J DONE" >> /home/user/national/logs/rebundle84j.log
