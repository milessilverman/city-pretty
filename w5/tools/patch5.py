"""Round 5 page patch: specific places (creek paths, parking-lot parks, EV charger sites, traffic calming, crossings) + new OC bundle.
usage: python3 patch5.py <in.html> <sites.b64> <bundle-oc.b64 or -> <sites_ui.js> <out.html>
Exact-string replacements, each must match once; data blocks are inserted/replaced whole and re-decoded to check."""
import sys, re, json, gzip, base64
src, sites_b64, oc_b64, ui_js, out = sys.argv[1:6]
s = open(src, encoding="utf-8").read()
CH = []

def rep(old, new, why, count=1):
    global s
    n = s.count(old)
    assert n == count, f"{why}: expected {count}, found {n}\n{old[:160]}"
    s = s.replace(old, new); CH.append(why)

# 1. sites data block (before the details chunks)
b = open(sites_b64).read().strip()
d = json.loads(gzip.decompress(base64.b64decode(b)))
assert "sites" in d and "meta" in d
anchor = '<script type="application/json" id="details-chunks">'
assert s.count(anchor) == 1
s = s.replace(anchor, f'<script type="application/octet-stream" id="sites-data">{b}</script>\n' + anchor)
CH.append(f"new data block #sites-data: {len(d['sites'])} block groups with specific-place candidates ({len(b) / 1e6:.2f} MB base64)")

# 2. Orange County bundle (rebuilt with the official AFDC DC fast-charger list)
if oc_b64 != "-":
    m = re.search(r'(<script type="application/octet-stream" id="bundle-oc">)(.*?)(</script>)', s, re.S)
    nb = open(oc_b64).read().strip(); json.loads(gzip.decompress(base64.b64decode(nb)))
    s = s[:m.start(2)] + nb + s[m.end(2):]
    CH.append("bundle-oc replaced (nearest DC fast charger from the official AFDC list via USDOT/BTS instead of OpenStreetMap)")

# 2b. LA bundle catalog corrections (round 5), field-level, with a check that nothing else changed
import copy
CORR = json.load(open("/home/user/w5/research/corrections_r5.json"))
m = re.search(r'(<script type="application/octet-stream" id="bundle">)(.*?)(</script>)', s, re.S)
BUN = json.loads(gzip.decompress(base64.b64decode(m.group(2).strip()))); B0 = copy.deepcopy(BUN)
for c in CORR:
    e = BUN["catalog"][c["key"]]; hits = [i for i, t in enumerate(e["sources"]) if c["find"] in t]
    assert len(hits) == 1, c["key"]
    e["sources"][hits[0]] = e["sources"][hits[0]].replace(c["find"], c["replace"]); CH.append(f"catalog {c['key']}.sources: correction {c['item']} ({c['source']})")
def strip(b):
    b = copy.deepcopy(b)
    for c in CORR: b["catalog"][c["key"]]["sources"] = None
    return b
assert strip(BUN) == strip(B0), "LA bundle changed outside the corrected fields"

# 2c. LA stations that no rail line serves (round 8.4; research/la_station_fix_r84.json from tools/la_station_fix.py): Disneyland's and
#     Knott's park trains, the Getty Center tram, the Fillmore & Western heritage railway, two unnamed points. They leave the stations
#     layer; the block groups whose nearest station was one of them get the served station's distance and name (rm, tr[0], rail gap text,
#     rail-distance row texts), lose a "rail nearby" strength and a transit-upzoning row that rested on them. Every edit checks the old value.
FIX = json.load(open("/home/user/w5/research/la_station_fix_r84.json"))
_key = lambda c, n: (round(c[0], 7), round(c[1], 7), n or "")
_drop = {_key((x, y), n) for x, y, n in FIX["dropped_stations"]}
_feats = BUN["layers"]["stations"]["features"]
_keep = [f for f in _feats if _key(f["geometry"]["coordinates"], f["properties"].get("n")) not in _drop]
assert len(_feats) - len(_keep) == len(FIX["dropped_stations"]) == 16, (len(_feats), len(_keep))
B1 = copy.deepcopy(BUN); BUN["layers"]["stations"]["features"] = _keep
_sites = {x["i"]: x for x in BUN["under"]["sites"]}
for _i, _so, _ro, _sn, _rn in FIX["sites"]:   # underused sites: nearest station's name and distance
    _x = _sites[_i]; assert _x["st"] == _so and _x["rail"] == _ro, _i; _x["st"], _x["rail"] = _sn, _rn
_dels = {}
for _hk, _part, _idx, _fld, _old, _new in FIX["plans"]:   # neighbourhood plans: rail steps' text; SB 79 context and rail strengths that rested on a dropped station
    _P = BUN["plans"][_hk]
    if _part == "steps":
        assert _P["steps"][_idx][_fld] == _old, _hk; _P["steps"][_idx][_fld] = _new
    else:
        assert _P[_part][_idx] == _old, _hk; _dels.setdefault((_hk, _part), []).append(_idx)
for (_hk, _part), _ix in _dels.items():
    for _i in sorted(_ix, reverse=True): del BUN["plans"][_hk][_part][_i]
_b = copy.deepcopy(BUN); _b["layers"]["stations"]["features"] = B1["layers"]["stations"]["features"]
for _x in _b["under"]["sites"]:
    if any(_x["i"] == e[0] for e in FIX["sites"]): _x.update({"st": next(e[1] for e in FIX["sites"] if e[0] == _x["i"]), "rail": next(e[2] for e in FIX["sites"] if e[0] == _x["i"])})
for _hk in {e[0] for e in FIX["plans"]}: _b["plans"][_hk] = copy.deepcopy(B1["plans"][_hk])
assert _b == B1, "LA bundle changed outside the stations layer, the listed sites and the listed plans"
CH.append(f"LA stations layer: {len(_drop)} stations no rail line serves removed (Disneyland, Knott's, Getty Center tram, Fillmore & Western, 2 unnamed); "
          f"{len(FIX['sites'])} underused sites name their nearest served station; {len(FIX['plans'])} neighbourhood-plan texts corrected or removed")
_m2 = re.search(r'(<script type="application/json" id="details-chunks">)(.*?)(</script>)', s, re.S)
_DCJ = json.loads(_m2.group(2)); _klen = _DCJ["key"]
_by = {}
for _g in FIX["block_groups"]:
    _by.setdefault(_g[:_klen], []).append(_g)
_n = {"gap": 0, "strength": 0, "row": 0, "text": 0}
_rows_after = {}
for _ck, _gs in _by.items():
    _C = json.loads(gzip.decompress(base64.b64decode(_DCJ["chunks"][_ck]))); _C0 = copy.deepcopy(_C)
    for _g in _gs:
        _e = FIX["block_groups"][_g]; _mm = _C[_g]["m"]; _rows = _C[_g]["r"]
        assert _mm["rm"] == _e["rm"][0], _g; _mm["rm"] = _e["rm"][1]
        if "tr0" in _e:
            assert _mm["tr"][0] == _e["tr0"][0], _g; _mm["tr"][0] = _e["tr0"][1]
        for _i, _old, _new in _e.get("gap", []):
            assert _mm["gp"]["g"][_i] == _old, _g; _mm["gp"]["g"][_i] = _new; _n["gap"] += 1
        for _i, _old in sorted(_e.get("strength_removed", []), key=lambda t: -t[0]):
            assert _mm["gp"]["s"][_i] == _old, _g; del _mm["gp"]["s"][_i]; _n["strength"] += 1
        for _i, _pid, _old, _new in _e.get("row_text", []):
            assert _rows[_i][0] == _pid and _rows[_i][10] == _old, _g; _rows[_i][10] = _new; _n["text"] += 1
        for _i, _pid in sorted(_e.get("row_removed", []), key=lambda t: -t[0]):
            assert _rows[_i][0] == _pid, _g; del _rows[_i]; _n["row"] += 1
        _rows_after[_g] = _rows
    assert all(_C[_x] == _C0[_x] for _x in _C if _x not in _gs), "details changed outside the listed block groups"
    _DCJ["chunks"][_ck] = base64.b64encode(gzip.compress(json.dumps(_C, separators=(",", ":"), ensure_ascii=False).encode(), 9, mtime=0)).decode()
s = s[:_m2.start(2)] + json.dumps(_DCJ, separators=(",", ":")) + s[_m2.end(2):]
def _tp(rows):   # the page's retop(): per evidence level A, B, C, D, U the best value project and the cost of those returning >= $1 per $1
    out = []
    for _t in "ABCDU":
        best, pc = None, 0
        for a in rows:
            c = BUN["catalog"].get(a[0])
            if not c or c.get("kind") != "value" or not (c.get("grade") == "none" or (c.get("grade") or "Z") <= _t):
                continue
            if best is None or a[8] > best[8]: best = a
            if a[8] >= 1: pc += a[3]
        out.append([best[0] if best and best[8] >= 1 else None, best[8] if best else None, pc or None])
    return out
for _f in BUN["bgs"]["features"]:
    _g = _f["properties"]["id"]
    if _g in _rows_after:
        assert _tp(_rows_after[_g]) == _f["properties"].get("tp"), f"top projects would change in {_g}"   # only policy rows were removed
CH.append(f"LA block groups whose nearest station was one of them: {len(FIX['block_groups'])} get the served station's distance; {_n['gap']} rail gaps rewritten, "
          f"{_n['strength']} 'rail nearby' strengths and {_n['row']} transit-upzoning rows removed, {_n['text']} row texts updated; top projects unchanged")
nb = base64.b64encode(gzip.compress(json.dumps(BUN, separators=(",", ":"), ensure_ascii=False).encode(), 9, mtime=0)).decode()
assert json.loads(gzip.decompress(base64.b64decode(nb))) == BUN
m = re.search(r'(<script type="application/octet-stream" id="bundle">)(.*?)(</script>)', s, re.S)   # again: step 2c edited the page after it
s = s[:m.start(2)] + nb + s[m.end(2):]

# 3. UI code
ui = open(ui_js).read()
rep("function whereLine(id) {", ui + "\nfunction whereLine(id) {", "specific-places UI (loadSites, sitesHtml, fillSites, drawSites)")
# 4. panel section + fill
rep("""  h += `<details class="panel-sec"><summary><b>Underused Land &amp; Infill Sites</b></summary><div class="sec-content">${underSection(p)}</div></details>`;""",
    """  h += `<details class="panel-sec" open><summary><b>Specific Places for These Projects</b></summary><div class="sec-content" id="sites-sec"><p class="small muted">Loading the site candidates…</p></div></details>`;
  h += `<details class="panel-sec"><summary><b>Underused Land &amp; Infill Sites</b></summary><div class="sec-content">${underSection(p)}</div></details>`;""",
    "panel: new 'Specific Places for These Projects' section")
rep("""  $("#panel").innerHTML = h; $("#panel").scrollTop = 0;
  eifdWire(p);""",
    """  $("#panel").innerHTML = h; $("#panel").scrollTop = 0;
  eifdWire(p); fillSites(p);""",
    "panel: fill the specific places after render")
# 5. per-card candidate line
rep("""    ${whereLine(r.id)}
    ${agencyHtml}""",
    """    ${whereLine(r.id)}
    ${Object.values(SITE_P).includes(r.id) ? `<p class="small where-site" data-where="${r.id}" hidden></p>` : ""}
    ${agencyHtml}""",
    "project cards: placeholder for the crash/map-based specific candidate")
# 6. preload after the page is up
rep("""  drawContext(); performance.mark("init:context");""",
    """  drawContext(); performance.mark("init:context");
  setTimeout(() => loadSites().then(() => { if (selected) { const f = byId.get(selected); if (f) fillSites(f.properties); } }), 1200);""",
    "init: preload the site candidates in the background")
open(out, "w", encoding="utf-8").write(s)
open(out + ".changes.txt", "w").write("\n".join(f"{i + 1}. {c}" for i, c in enumerate(CH)) + "\n")
print(len(CH), "changes ->", out)
