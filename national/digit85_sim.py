import ast, json, glob, math, collections, re, unicodedata
src = open("/home/user/national/pipeline/metrics_oc.py").read(); T = ast.parse(src)
ns = {"re": re, "unicodedata": unicodedata}
for n in T.body:
    if isinstance(n, ast.FunctionDef) and n.name in ("_merge_tokens", "_same_station"):
        exec(compile(ast.Module([n], []), "m", "exec"), ns)
    if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id in ("_MERGE_ABBR", "_MERGE_GENERIC") for t in n.targets):
        exec(compile(ast.Module([n], []), "m", "exec"), ns)
same = ns["_same_station"]; tok = ns["_merge_tokens"]
def same_digit(d, name, fid, other, R_SAME, other_fid=None):
    r = same(d, name, fid, other, R_SAME, other_fid=other_fid)
    if not r or d <= R_SAME or str(fid) == "11": return r
    a, b = tok(name), tok(other)
    return {w for w in a if w.isdigit()} == {w for w in b if w.isdigit()}
C = json.load(open("/home/user/national/data/counties.json"))
def additions(F, fn):
    R = json.load(open(f"/home/user/national/pipeline/data_{F}/rail_confirm.json")); gp = json.load(open(f"/home/user/national/pipeline/data_{F}/transit_rail_stops.json"))
    LAT0 = round(C[F]["lat"], 2); KX = 111320.0 * math.cos(math.radians(LAT0)); KY = 110540.0
    pts = [(x[0] * KX, x[1] * KY) for k in ("gtfs", "mode", "agency") for x in R.get(k, [])]; pnm = [x[2] for k in ("gtfs", "mode", "agency") for x in R.get(k, [])]; pfid = [None] * len(pts)
    tram = lambda q: q == 0 or 900 <= q <= 906
    grp, cand = collections.OrderedDict(), []
    for p in gp:
        if len(p) > 6 and p[6]: grp.setdefault((str(p[3]), p[6]), []).append(p)
        else: cand.append(p)
    for (fid, pid), ps in grp.items():
        b = min([p for p in ps if not tram(p[4])] or ps, key=lambda p: p[4])
        cand.append([sum(p[0] for p in ps) / len(ps), sum(p[1] for p in ps) / len(ps), ps[0][2], ps[0][3], b[4], b[5], pid])
    out = []
    for lon, lat, name, fid, ty, *ag in sorted(cand, key=lambda p: (p[4], str(p[3]), p[2], p[0], p[1])):
        if ty in (0, 5, 7, 1400) or 900 <= ty <= 906: continue
        if re.search(r"\byard\b", name or "", re.I) and not re.search(r"navy yard|potomac yard", name or "", re.I): continue
        x, y = lon * KX, lat * KY
        if any(fn(((x - px) ** 2 + (y - py) ** 2) ** 0.5, name, fid, pn, 150.0, other_fid=pf) for (px, py), pn, pf in zip(pts, pnm, pfid) if abs(x - px) <= 300.0 and abs(y - py) <= 300.0):
            continue
        pts.append((x, y)); pnm.append(name); pfid.append(fid); out.append((round(lon, 6), round(lat, 6), name))
    return out, R
diff = 0; mism = 0; n = 0
for p in sorted(glob.glob("/home/user/national/pipeline/data_*/rail_confirm.json")):
    F = p.split("data_")[1][:5]
    if not glob.glob(f"/home/user/national/pipeline/data_{F}/transit_rail_stops.json"): continue
    a, R = additions(F, same); b, _ = additions(F, same_digit); n += 1
    cur = sorted((round(x[0], 6), round(x[1], 6), x[2]) for x in R.get("added", []))
    if sorted(a) != cur: mism += 1
    if sorted(a) != sorted(b):
        diff += 1; print(F, C[F]["name"], "digit rule adds", sorted(set(b) - set(a))[:6], "removes", sorted(set(a) - set(b))[:6])
print(n, "counties;", mism, "replays differ from the file;", diff, "counties where the digit test changes additions")
