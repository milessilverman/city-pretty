"""Round 8.3: the queue of counties to re-bundle for the rail-station fix (logs/station_rebundle_queue.txt).
= counties whose station set changes under the new osm_extract.py rule (logs/station_scan.json)
  minus those whose newest build already ran the new extractor (its log has the "rail stations:" line osm_extract.py now prints)
  plus every county with a zoo or safari station: the first version of the rule (installed 18:02:41) dropped every station with "zoo" in
  its name, including METRORail's "Memorial Hermann Hospital/Houston Zoo"; the final rule (18:20:54) keeps stations of a transit network."""
import json, os, re
N = "/home/user/national"
scan = json.load(open(f"{N}/logs/station_scan.json"))
changed = sorted(f for f, r in scan.items() if r.get("areas_added") or r.get("stops_added") or r.get("nodes_dropped"))
queue, skipped = [], []
for f in changed:
    logs = [p for p in (f"{N}/logs/rebuild10_{f}.log", f"{N}/logs/build_{f}.log", f"{N}/logs/rebuild9_{f}.log", f"{N}/logs/rebuild9_{f}_redo.log",
                        f"{N}/logs/rebuild8_{f}.log", f"{N}/logs/rebuild7_{f}.log") if os.path.exists(p)]
    newest = max(logs, key=os.path.getmtime) if logs else None
    zoo = any(re.search(r"\b(zoo|safari)\b", n, re.I) for n in scan[f].get("dropped_names", []))
    if newest and "rail stations:" in open(newest, errors="replace").read() and not zoo:
        skipped.append(f)
    else:
        queue.append(f)
open(f"{N}/logs/station_rebundle_queue.txt", "w").write("".join(f + "\n" for f in queue))
print(len(changed), "counties change;", len(skipped), "already built with the new extractor;", len(queue), "queued")
print("zoo / safari counties queued:", [f for f in queue if any(re.search(r"\b(zoo|safari)\b", n, re.I) for n in scan[f].get("dropped_names", []))])
