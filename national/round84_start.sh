#!/bin/bash
# Round 8.4: rail stations confirmed by GTFS rail stops. Run after round 8.3 is delivered.
#  1. install fetch_oc.py selection 9 (transit_rail_stops.json: stops of rail routes in current and stale feeds, and Amtrak's, with their
#     agency) and metrics_oc.py with confirm_rail_stations (an OSM station counts where a GTFS rail stop is within 400 m, or as a named
#     subway / light-rail / monorail station, or when its operator runs rail routes in the county's feeds; GTFS subway / rail / monorail /
#     funicular stops with no kept station within 150 m are added; every decision in data_<fips>/rail_confirm.json);
#  2. queue every built county for a full re-bundle (logs/rebundle84_queue.txt) and start three workers (locks in logs/locks12r);
#  3. start batch 5 (the next 150 largest counties), built with the new code from the start.
cd /home/user/national/pipeline
cp fetch_oc.py /home/user/national/backups_fetch_oc_sel8_final.py; cp metrics_oc.py /home/user/national/backups_metrics_oc_pre84.py
cp fetch_oc_sel9.py fetch_oc.py.new && mv fetch_oc.py.new fetch_oc.py
cp metrics_oc_v2.py metrics_oc.py.new && mv metrics_oc.py.new metrics_oc.py
cd /home/user/national
# the counties on the national site (bundle + site suggestions), most rail stations first so their decisions can be reviewed early
# (station84_review.py); a county that is only partly built (San Juan, PR: its site-suggestion step failed) is left to batch 5
python3 - > logs/rebundle84_queue.txt <<'PY'
import os, json, gzip, base64
N = "/home/user/national"
fs = [d[5:] for d in os.listdir(f"{N}/pipeline") if d.startswith("data_") and os.path.exists(f"{N}/pipeline/{d}/metrics.json")
      and any(os.path.exists(f"/home/user/w5/{q}/sites_{d[5:]}.json") for q in ("county_sites", "sd_data"))]   # San Diego's are in sd_data
def n_st(f):
    try:
        B = json.loads(gzip.decompress(base64.b64decode(open(f"{N}/pipeline/data_{f}/bundle-oc.b64").read())))
        return len(((B.get("layers") or {}).get("stations") or {}).get("features") or [])
    except Exception:
        return 0
print("\n".join(sorted(fs, key=lambda f: (-n_st(f), f))))
PY
rm -rf logs/build_locks/72127   # the failed San Juan test build (sites.py had no fallback for a county without DC fast chargers): batch 5 rebuilds it
echo "$(date +%T) round 8.4 installed; $(wc -l < logs/rebundle84_queue.txt) counties queued" >> logs/rebundle84.log
mkdir -p logs/locks12r
worker() {
  cd /home/user/national/pipeline
  for F in $(cat /home/user/national/logs/rebundle84_queue.txt); do
    mkdir /home/user/national/logs/locks12r/$F 2>/dev/null || continue
    D=data_$F; LOG=/home/user/national/logs/rebuild14_$F.log
    ( export CP_FIPS=$F; python3 fetch_oc.py && python3 osm_extract.py && python3 metrics_oc.py && python3 layers_oc.py && python3 build_oc.py /home/user/page/dec ) > $LOG 2>&1
    echo "EXIT $?" >> $LOG
    if grep -q "^EXIT 0" $LOG; then
      rm -f $D/ccrs_*.json $D/tiger_*.geojson $D/osm_*.json $D/bundle-oc.json $D/fire_*.geojson $D/afdc_ev.geojson $D/layers.json $D/usa_parks.geojson $D/acs_tract.json; rm -rf $D/osm
    fi
    echo "$(date +%T) $F $(tail -1 $LOG) | fetch failures: $(grep -c '!! failed' $LOG)" >> /home/user/national/logs/rebundle84.log
  done
}
worker & W1=$!; sleep 20; worker & W2=$!; sleep 20; worker & W3=$!
python3 make_queue.py us_queue5.txt --top 150 >> logs/batch5.log 2>&1
echo "$(date +%T) batch 5 queue written: $(wc -l < us_queue5.txt) counties" >> logs/batch5.log
( setsid nohup ./queue_worker.sh batch5a us_queue5.txt > /dev/null 2>&1 & )   # detached: the wait below is for the re-bundles only
wait $W1 $W2 $W3
echo "$(date +%T) REBUNDLE84 DONE" >> logs/rebundle84.log
