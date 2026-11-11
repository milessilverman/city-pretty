"""The queue of rebundle84k.sh: transit_day_audit.py's list, rail15_sim.py's list and the selection-14 builds with rail stops, each county
only while its transit step is older than selection 15."""
import json, os, time
os.chdir("/home/user/national")
N = "/home/user/national/pipeline"
def sel(F):
    p = f"{N}/data_{F}/transit_stops_7_9.meta.json"
    return json.load(open(p)).get("selection", 0) if os.path.exists(p) else 0
A = [l.strip() for l in open("logs/transit_day_audit_queue.txt") if l.strip()]
B = [l.strip() for l in open("logs/rail15_queue.txt") if l.strip()]
C = [d[5:] for d in os.listdir(N) if d.startswith("data_") and len(d) == 10 and sel(d[5:]) == 14 and os.path.exists(f"{N}/{d}/transit_rail_stops.json")
     and json.load(open(f"{N}/{d}/transit_rail_stops.json"))]
q = sorted(F for F in set(A) | set(B) | set(C) if sel(F) < 15)
open("logs/rebundle84k_queue.txt", "w").write("".join(F + "\n" for F in q))
print(time.strftime("%H:%M:%S"), len(q), "counties queued: audit", len(A), "| rail stations", len(B), "| selection-14 builds with rail stops", len(C),
      "| audit:", open("logs/transit_day_audit.log").read().strip().splitlines()[-1])
