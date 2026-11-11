"""build_oc text, round 8.6 (from the language review of the round-8.6 bundles, each point checked against the code). Text and the
order of plan steps only: no metric, gap test, score, cost or value changes.   usage: build86_language.py <build_oc.py>"""
import sys, re
p = sys.argv[1]; s = open(p).read()


def rep(old, new, n=1):
    global s
    c = s.count(old)
    assert c == n, (c, n, old[:90])
    s = s.replace(old, new)


# ---- block-group stat cells: no '-0.0°F', halves of buses kept, no repeated 'within 1/2 mi'
rep('''    if key == "ht":
        return f"{v:+.1f}°F"''', '''    if key == "ht":
        v = 0.0 if abs(v) < 0.05 else v
        return "0.0°F" if v == 0 else f"{v:+.1f}°F"''')
rep('''        return f"{v:.1f} ac within 1/2 mi"''', '''        return f"{v:.1f} ac"''')
rep('''        return f"{int(v)} bus{'' if int(v) == 1 else 'es'}/hr"''', '''        b = round(v * 2) / 2   # 7-9 am departures / 2: halves occur
        return f"{b:g} bus/hr" if b == 1 else f"{b:g} buses/hr"''')

# ---- gap sentences
rep('''WHY = {"heat":''', '''def _mi(x, p):
    """two distances in miles, one decimal, or two where they would print alike (a gap needs a 10% difference, not 0.1 mi)"""
    a, b = f"{x / 1609:.1f}", f"{p / 1609:.1f}"
    return (a, b) if a != b else (f"{x / 1609:.2f}", f"{p / 1609:.2f}")


def _near(what, x, p):
    a, b = _mi(x, p)
    return f"{what} is {a} mi away; in similar neighborhoods it's about {b} mi."


def _fwy(x, p):
    a, b = _mi(x, p)
    return (f"Homes sit right next to the freeway (within 0.05 mi; similar neighborhoods: {b} mi)" if x < 80 else
            f"Homes sit {a} mi from the freeway (similar neighborhoods: {b} mi)") + ", so noise and exhaust are higher."


def _bus_why(x, p):
    """bt is 7-9 am departures / 2 at the busiest stop within 400 m"""
    h = f"{round(p * 2) / 2:g}"
    if not x:
        return f"No bus stop within 400 m has a 7-9 am departure (similar neighborhoods: {h} {'bus' if h == '1' else 'buses'} an hour)."
    b = round(x * 2) / 2
    return ("Under 1 bus" if b < 1 else f"{b:g} bus" if b == 1 else f"{b:g} buses") + f" an hour at the busiest stop within 400 m (similar neighborhoods: {h})."


WHY = {"heat":''')
n_near = 0
def _sub_near(m):
    global n_near
    n_near += 1
    return f'lambda x, p: _near("{m.group(1)}", x, p)'
s, k = re.subn(r'''lambda x, p: f"((?:The nearest [^"{}]*?)|Rail) is \{x / 1609:\.1f\} mi away; in similar neighborhoods it's about \{p / 1609:\.1f\} mi\."''', _sub_near, s)
assert k == 10, k
rep('''"freeway": lambda x, p: f"Homes sit {x / 1609:.2f} mi from the freeway (similar neighborhoods: {p / 1609:.1f} mi), so noise and exhaust are higher.",''',
    '''"freeway": _fwy,''')
rep('''+ f" within ½ mile (similar neighborhoods: {int(p)}).",''', '''+ f" within 400 m (similar neighborhoods: {int(p)}).",''')   # the count is within 400 m (metrics_oc: count_within 400)
rep('''"bus": lambda x, p: f"{int(x)} {'bus' if int(x) == 1 else 'buses'} an hour at the busiest stop (similar neighborhoods: {int(p)}).",''', '''"bus": _bus_why,''')

# ---- plans: the cheapest step first only among steps with a cost; no doubled parentheses next to the project
rep('''        if len(steps) > 1:
            cheap = min(steps, key=lambda s: s["cost"] or 9e18); steps.remove(cheap); steps.insert(0, cheap)''',
    '''        costed = [s for s in steps if s["cost"] is not None]   # round 8.6: a step with no cost is never put first as the cheapest
        if len(steps) > 1 and costed:
            cheap = min(costed, key=lambda s: s["cost"]); steps.remove(cheap); steps.insert(0, cheap)''')
rep('''"name": c.get("name", fix), "kind"''', '''"name": re.sub(r"\\s*\\([^()]*\\)$", "", c.get("name", fix)) if r else c.get("name", fix), "kind"''')
rep('''    labels = la_b.get("gap_labels", {})''', '''    labels = {**la_b.get("gap_labels", {}), "dining": "restaurants and cafés within 400 m"}   # LA's label said ½ mile; the count is within 400 m''')
rep('''"Compared with the 50 most similar block groups across LA County and " + region.NAME''',
    '''"Compared with the 50 most similar block groups across LA County and " + ("the District of Columbia" if region.NAME == "District of Columbia" else region.NAME)''')

# ---- feed labels: the weekday measured named, no nested parentheses
rep('''        cp += f" ({f['calitp'].get('name')}, snapshot of {f['calitp'].get('snapshot')})"''',
    '''        cp += f": {f['calitp'].get('name')}, snapshot of {_d(f['calitp'].get('snapshot'))}"''')
rep('''    return (f"{', '.join(f['agencies']) if f.get('agencies') else f['provider']} (MobilityData {f['id']}" + (f", read from {cp}" if cp else "")
            + f", {_d(f['weekday'], True)}" + (f"; the newest copy that could be read ends on {_d(f['schedule_ended'])}" if f.get("schedule_ended") else "") + ")")''',
    '''    return (f"{', '.join(f['agencies']) if f.get('agencies') else f['provider']} (MobilityData {f['id']}; measured on {_d(f['weekday'], True)}"
            + (f"; read from {cp}" if cp else "") + (f"; the newest copy that could be read ends on {_d(f['schedule_ended'])}" if f.get("schedule_ended") else "") + ")")''')

# ---- reasons: plain words
rep('''        what = "cannot be reached from the build machine"''', '''        what = "is not reachable from where this map is built"''')
rep('''    pre = "no copy could be downloaded ("
    if why.startswith(pre):''', '''    m = re.search(r"its Cal-ITP copy places only (\\d+) of (\\d+) stops exactly", why)
    if m:   # round 8.6: say that the copy was not used
        k, n = int(m.group(1)), int(m.group(2))
        why = why.replace(m.group(0), "its Cal-ITP copy was not used: " + (f"none of its {n:,} stops has an exact position" if k == 0 else f"only {k:,} of its {n:,} stops have an exact position"))
        if why.startswith("its Cal-ITP"):
            return why
    pre = "no copy could be downloaded ("
    if why.startswith(pre):''')
rep('''    return (f". Not located: {_and(names)}: MobilityData's catalog gives {'this feed' if one else 'these feeds'} no area, so {'it was' if one else 'each was'} "
            f"tried in every {where}, and {why}")''',
    '''    return (f". Not located: {_and(names)}. MobilityData's catalog gives {'this feed' if one else 'these feeds'} no area, so {'it was' if one else 'each was'} "
            f"tried in every {where}, and {why}")''')
rep('''    names = [f"{pv} (MobilityData {', '.join(dict.fromkeys(ids))})" for pv, ids in by.items()]''',
    '''    names = [f"{pv} (MobilityData {_and(list(dict.fromkeys(ids)))})" for pv, ids in by.items()]''')
rep('''def _unlocated(x):''', '''def _counted_text(x):
    """a feed whose routes are all counted from other feeds, for the 'Counted through other feeds' sentence"""
    items = x["why"].split(": ", 1)[1].split("; ") if ": " in x["why"] else []
    out = []
    for it in items:
        m = re.match(r"^(.*?): (\\d+) (routes?) counted from (?:feed|MobilityData) (\\S+)$", it)
        m2 = re.match(r"^(.*?): schedule superseded by the current one in (?:feed|MobilityData) (\\S+)$", it)
        own = lambda a: "its" if a.strip().lower() == x["provider"].strip().lower() else f"{a}'s"
        if m:
            out.append(f"{own(m.group(1))} {m.group(2)} {m.group(3)} {'is' if m.group(2) == '1' else 'are'} counted from MobilityData {m.group(4)}")
        elif m2:
            out.append(f"{own(m2.group(1))} schedule is superseded by the current one in MobilityData {m2.group(2)}")
        else:
            out.append(it)
    if len(out) > 6:
        out = out[:6] + [f"and {len(out) - 6} more"]
    return f"{x['provider'].strip()} (MobilityData {x['id']}; " + "; ".join(out) + ")"


def _unlocated(x):''')

# ---- the GTFS row: method in parentheses, then the feeds counted, not included, counted through others, not located
rep('''        ["GTFS feeds (MobilityData's copies of each operator's feed, or the operator's own download" + ("; in California also the State's Cal-ITP tables" if CA else "") + ")",
         "weekday 7-9 am bus departures per stop on one weekday per feed, each bus route counted once, stops listed without a time interpolated between the trip's timed stops, a trip's last stop and drop-off-only stop times not counted as departures: "
         + ("; ".join(_feed_label(f) for f in feeds) or "none") + (". Not included: " + "; ".join(dict.fromkeys(f"{x['provider'].strip()} (MobilityData {x['id']}: {not_inc(x)})" for x in _not_counted(tr))) if _not_counted(tr) else "") + _not_located(tr),''',
    '''        ["GTFS feeds (MobilityData's copies of each operator's feed, or the operator's own download" + ("; in California also the State's Cal-ITP tables" if CA else "") + ")",
         "weekday 7-9 am bus departures per stop (one weekday per feed; each bus route counted once; stops listed without a time interpolated between the trip's timed stops; a trip's last stop and drop-off-only stop times not counted). Feeds counted: "
         + ("; ".join(_feed_label(f) for f in feeds) or "none")
         + (". Not included: " + "; ".join(dict.fromkeys(f"{x['provider'].strip()} (MobilityData {x['id']}: {not_inc(x)})" for x in nc_other)) if nc_other else "")
         + (". Counted through other feeds: " + "; ".join(dict.fromkeys(_counted_text(x) for x in nc_through)) if nc_through else "") + _not_located(tr),''')
rep('''    not_inc = lambda x: _why_text(x["why"]).replace("within three weeks of today", f"within three weeks of the build date ({built})")''',
    '''    not_inc = lambda x: _why_text(x["why"]).replace("within three weeks of today", f"within three weeks of the build date ({built})")
    nc_through = [x for x in _not_counted(tr) if x["why"].startswith("its routes are counted from other feeds")]
    nc_other = [x for x in _not_counted(tr) if not x["why"].startswith("its routes are counted from other feeds")]''')

# ---- running text: 'the District of Columbia'; CCRS and 311 rows
rep('''    NM = region.NAME; STN = STATE_NAMES.get(region.STATE, region.STATE); PR = region.STATE == "PR"''',
    '''    NM = "the District of Columbia" if region.NAME == "District of Columbia" else region.NAME; STN = STATE_NAMES.get(region.STATE, region.STATE); PR = region.STATE == "PR"''')
rep('''pedestrian/bicycle crashes are those whose first object struck was a pedestrian or bicycle, or with an injured or killed pedestrian or cyclist in CCRS's injured-persons table; killed-or-seriously-injured from the same table''',
    '''pedestrian/bicycle crashes are those whose first object struck was a pedestrian or bicycle or that list an injured or killed pedestrian or cyclist in CCRS's injured-persons table; killed-or-seriously-injured counts come from the same table''')
rep('''["City 311 requests", "dumping, graffiti, litter, encampment projects",''', '''["City 311 requests", "requests about dumping, graffiti, litter and encampments (used for cleanup projects)",''')
open(p, "w").write(s)
print("build_oc language patch applied:", p, "| 'nearest' sentences:", n_near)
