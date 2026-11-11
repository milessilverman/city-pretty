"""Round 8.6 disk janitor (10 Nov 05:20): the session disk filled (760 MB free) and every rebuild worker waits for 800 MB.
Every 5 minutes: (1) delete a state extract in cache/osm_states once no county of that state is left in rebundle86b's queue (not
started, or started without an EXIT line) or in batch 7 (no sites file yet); (2) delete clip files in cache/osm older than a day with
no other link (fetch_oc re-downloads those anyway: it reuses a cached clip file only within 86400 s). Each deletion is logged with the
state, so a later straggler re-run knows to run osm_split.py again."""
import os, glob, time, json
N = "/home/user/national"
AB = {'01': 'alabama', '04': 'arizona', '05': 'arkansas', '09': 'connecticut', '10': 'delaware', '11': 'district-of-columbia', '16': 'idaho',
      '18': 'indiana', '19': 'iowa', '20': 'kansas', '21': 'kentucky', '22': 'louisiana', '23': 'maine', '24': 'maryland', '25': 'massachusetts',
      '27': 'minnesota', '28': 'mississippi', '29': 'missouri', '30': 'montana', '31': 'nebraska', '32': 'nevada', '33': 'new-hampshire',
      '34': 'new-jersey', '35': 'new-mexico', '38': 'north-dakota', '39': 'ohio', '40': 'oklahoma', '41': 'oregon', '42': 'pennsylvania',
      '44': 'rhode-island', '45': 'south-carolina', '46': 'south-dakota', '47': 'tennessee', '49': 'utah', '50': 'vermont', '53': 'washington',
      '54': 'west-virginia', '55': 'wisconsin', '56': 'wyoming'}
LOG = f"{N}/logs/janitor86.log"


def log(m):
    open(LOG, "a").write(time.strftime("%H:%M:%S ") + m + "\n")


def remaining():
    q = open(f"{N}/logs/rebundle86b_queue.txt").read().split()
    left = []
    for F in q:
        lk = f"{N}/logs/locks86b/{F}"; lg = f"{N}/logs/rebuild86b_{F}.log"
        if not os.path.isdir(lk) or not (os.path.exists(lg) and "EXIT" in open(lg, errors="replace").read()):
            left.append(F)
    q7 = open(f"{N}/us_queue7.txt").read().split()
    left += [F for F in q7 if not os.path.exists(f"/home/user/w5/county_sites/sites_{F}.json")]
    return left


while True:
    try:
        need = {F[:2] for F in remaining()}
        for st, name in AB.items():
            if st in need:
                continue
            for p in glob.glob(f"{N}/cache/osm_states/us-*__{name}-latest.osm.pbf"):
                sz = os.path.getsize(p); os.remove(p); log(f"state {st} {name}: deleted {os.path.basename(p)} ({sz / 1e6:.0f} MB); re-split with osm_split.py if a straggler needs it")
        now = time.time()
        for p in glob.glob(f"{N}/cache/osm/*-latest.osm.pbf"):
            s = os.stat(p)
            if now - s.st_mtime > 90000 and s.st_nlink == 1:
                os.remove(p); log(f"clip file older than a day: deleted {os.path.basename(p)} ({s.st_size / 1e6:.0f} MB)")
        if not need:
            log("nothing left in either queue: janitor stops"); break
    except Exception as e:
        log(f"error: {e!r}")
    time.sleep(300)
