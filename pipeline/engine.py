"""City Pretty recommendation engine, reverse-engineered from the LA County build (details r rows) so that
Orange County block groups can be scored with the same math.

Conventions recovered from the LA data (see validate_la.py for the proof):
  per-home value   = own_share * hv + (1 - own_share) * rent * 12 / 0.045
  value            = homes_reached * per_home * pct/100 * 1.03**-years * scale
  cost             = capex + land + om * 8.5294   (10 years of upkeep, present value at 3%)
  vpd              = value / cost
  need (qol score) = county-wide percentile of the driving metric (higher need = worse)
Every number below (unit costs, effect sizes, lags, shares) is the one the LA build used; the sources are listed in
the catalog that ships inside the page (D.catalog[id].sources).
"""
import math

CAP = 0.045          # cap rate used to value renter-occupied homes from rent
PV10 = (1 - 1.03 ** -10) / 0.03   # 8.5302; the LA rows round to 8.53
PV10 = 8.5294117647

# county medians of the LA build (used for "x county median" wording and thresholds)
LA_MED = {"ht": 0.0, "vc": 6.9, "pcr": 22.0, "pa": 4.8, "pn": 458.5, "bt": 2.0, "gro": 789.5, "din": 0, "ten": 1443.0,
          "dog": 3161.0, "pool": 1972.0, "ev": 1514.0, "fw": 1300.0, "tg": 24.0, "nocar": 5.0, "inc": 93239.5, "yb": 1960.0}


def per_home(m):
    hv = m.get("hv")
    if not hv:
        return None
    own = (m.get("own") if m.get("own") is not None else 50) / 100.0
    rent = m.get("rent")
    if rent:
        return own * hv + (1 - own) * rent * 12 / CAP
    return hv * 0.957   # no rent on record: the LA build used ~96% of hv


def r1(x, nd=0):
    return round(x, nd) if nd else int(round(x))


def sig(x, digits=3):
    """round to 3 significant figures like the LA rows (98000, 1460000, 4300000)"""
    if x == 0:
        return 0
    e = math.floor(math.log10(abs(x)))
    return int(round(x, digits - 1 - e)) if e >= digits - 1 else round(x, digits - 1 - e)


class Pools:
    """percentile pools for need scores: values of each metric across all block groups (LA + OC)"""
    def __init__(self, metric_lists):
        self.p = {k: sorted(v) for k, v in metric_lists.items()}

    def pct(self, key, v, higher_is_worse=True):
        arr = self.p.get(key)
        if arr is None or v is None:
            return 0.5
        import bisect
        if higher_is_worse:
            return round(bisect.bisect_left(arr, v) / len(arr), 2)
        return round((len(arr) - bisect.bisect_right(arr, v)) / len(arr), 2)


def dens(m):
    return (m["homes"] / m["acres"]) if m.get("acres") and m.get("homes") else 0.0


def fmtn(x):
    return f"{int(round(x)):,}"


def _buses(bt):
    """display text only: buses an hour (7-9 am departures / 2, so halves occur): '12 buses', '10.5 buses', '1 bus', 'under 1 bus'"""
    b = round(float(bt or 0) * 2) / 2
    return "under 1 bus" if b < 1 else (f"{b:g} bus" if b == 1 else f"{b:g} buses")


def _warmer(ht):
    """display text only: '+2.9°F hotter than average', or 'average summer heat' where it rounds to 0.0"""
    return f"+{ht:.1f}°F hotter than average" if round(ht, 1) > 0 else "average summer heat"


def _away(d):
    """display text only: '350 m away', or '4.6 mi away' from 1,000 m up"""
    return "in this block group" if d < 1 else f"{int(d)} m away" if d < 1000 else f"{d / 1609:.1f} mi away"


def _dining(n):
    """display text only: the dining count is restaurants plus cafés within 400 m"""
    return "1 restaurant or café" if int(n) == 1 else f"{int(n)} restaurants and cafés"


def _inc_cut(inc):
    """display text only: the income test compares with Los Angeles County's median household income (LA_MED['inc'])"""
    cut = f"${LA_MED['inc']:,.0f}"
    if inc is None:
        return f"household income not published here (treated as at or above {cut}, Los Angeles County's median)"
    return (f"household income below {cut} (Los Angeles County's median, the cut-off used here)" if inc < LA_MED["inc"]
            else f"household income of {cut} or more (Los Angeles County's median, the cut-off used here)")


def _money(v):
    """display text only: '$2M or more' at the ACS top code (2,000,001), '$1.25M' from $1M, '$450,000' below"""
    return "$2M or more (the Census top code)" if v >= 2000000 else f"${v / 1e6:.2f}M" if v >= 1e6 else f"${round(v, -3):,.0f}"


def run(m, pools, county="Orange County", state="CA"):
    """m: metrics dict for one block group (same keys as D.details[id].m). Returns list of r rows:
    [id, project, homes, cost, capex, land, om, value, vpd, pct, why, qol]"""
    rows = []
    ph = per_home(m)
    H = m.get("homes") or 0
    d = dens(m)
    hv = m.get("hv") or 0
    inc = m.get("inc")
    below_med_inc = inc is not None and inc < LA_MED["inc"]
    fire = (m.get("fire") or 0)
    vc, pcr = m.get("vc"), m.get("pcr")
    ht, tg = m.get("ht"), m.get("tg")
    bt, rm = m.get("bt") or 0, m.get("rm")
    fw, gro, din = m.get("fw"), m.get("gro"), m.get("din") or 0
    pa, pn = m.get("pa") or 0, m.get("pn")
    ten, dog, pool, ev = m.get("ten"), m.get("dog"), m.get("pool"), m.get("ev")
    nocar = m.get("nocar") or 0
    yb, sf, own = m.get("yb"), m.get("sf") or 0, m.get("own")
    crashes = m.get("pbcr") or 0           # pedestrian/bike crashes recorded (CCRS/SWITRS)
    ksi = m.get("ksi") or 0
    x = m.get("x") or {}                   # extra geometry-derived inputs (see metrics_oc.py)
    H15 = int(round(1.5 * H))

    def add(pid, project, homes, capex, land, om, pct, why, qol, years, scale=1.0, kind="value", value=None):
        cost = capex + land + om * PV10
        if value is None:
            value = (homes * (ph or 0) * pct / 100 * (1.03 ** -years) * scale) if (kind in ("value", "regional", "policy") and ph) else 0
        value = sig(value) if value else 0
        cost = sig(cost) if cost else 0
        vpd = round(value / cost, 3) if cost and value else 0
        rows.append([pid, project, int(homes), int(cost), int(capex), int(land), int(om), int(value), vpd, pct, why, qol])

    # ---------------- Greening ----------------
    ts = m.get("ts")
    survey = ts is not None and m.get("st") is not None
    if not survey:
        ts = max(0, 0.1128 * (m.get("acres") or 0) + 68)      # open sites estimated from street length / canopy gap (LA fallback fit)
        if tg is not None and tg < 10:
            ts *= 0.5
        ts = int(round(ts))
    if ts and ts >= 4 and H:
        hpt = max(1, int(round(0.2839 * d + 2.342)))          # homes within 50 m of a tree, from density
        homes = min(ts * hpt, H15)
        why = (f"{ts:,} open planting sites in the city's tree survey" if survey else
               f"~{ts:,} open sites estimated from block-group size (about 68 plus 0.11 per acre, the fit used for Los Angeles County; no city tree survey here"
               + (f"; this block group covers {int(m.get('acres') or 0):,} acres, far more than the fit was made on, so the estimate means little here" if ts >= 3000 else "") + ")")
        add("street_trees", f"{ts:,} street trees", homes, ts * 1945, 0, ts * 65, 0.24,
            why + f"; each tree raises the value of ~{hpt} homes within 50 m by 0.24% (local sales estimate, low end)",
            pools.pct("ht", ht) if ht is not None else 0.5, 6)
    if ht is not None and ht >= 2.1 and x.get("pubbldg_m", 9e9) <= 1550:
        add("cooling_center", "retrofit 1 library or rec center as a cooling center", min(H15, int(round(1.13 * H))), 450000, 0, 18000, 0.4,
            f"+{ht:.1f}°F hotter than average with a public building nearby", pools.pct("ht", ht), 2)
    if ht is not None and ht >= 0.06 and (m.get("acres") or 0) >= 49:
        add("green_street", "4 pairs of bioswale curb extensions", int(round(0.09 * H)), 740000, 0, 18000, 1.2,
            f"+{ht:.1f}°F hotter than average; streets that drain to the storm system", pools.pct("ht", ht), 3)
    if ht is not None and ht >= 1.6 and d >= 8.3:
        add("green_alley", "~0.25 mile of alleys", int(round(0.75 * H)), 2400000, 0, 10000, 0, f"+{ht:.1f}°F hotter than average", pools.pct("ht", ht), 2, kind="qol")
        add("cool_pavement", "~1 lane-mile coated", int(round(0.75 * H)), 250000, 0, 0, 0, f"+{ht:.1f}°F hotter than average; cools surfaces, not always people", pools.pct("ht", ht), 0, kind="qol")
    if ht is not None and ht >= 1.1 and pa <= 2.8:
        add("tiny_forest", "2 sites of 0.1 acre", min(H15, int(round(1.08 * H))), 130000, 0, 17000, 0, f"+{ht:.1f}°F hotter than average and few parks nearby", pools.pct("ht", ht), 0, kind="qol")
    if ht is not None and ht > 0 and x.get("school_m", 9e9) <= 400 and (tg or 0) > 15:
        add("schoolyard_green", "1 campus exterior and greening package", H15, 11200000, 0, 15000, 1.0,
            "public school within 400 m in a hot, low-canopy area; open after hours as a park. Cost is the Los Angeles Unified School District's bundled package, so it overstates greening alone",
            pools.pct("ht", ht), 3, scale=0.8)
    if d >= 6.0 and x.get("garden_m", 9e9) > 800 and hv:
        pct = 1.5 if below_med_inc else 0.5
        add("community_garden", "6,000 sq ft garden", min(H15, int(round(1.36 * H))), 400000, int(max(100000, 0.934 * hv + 54466 * d - 302375)), 10000, pct,
            f"no community garden within 800 m; {_inc_cut(inc)} (the effect is larger in poorer areas)",
            pools.pct("pn", pn) if pn is not None else 0.5, 5)
    if pa >= 4.9 and d >= 8.2 and H:
        share = H / 25.0   # percent share of a ~$16.5M project
        add("stormwater_park", ("this area's share (under 1%) of a ~$16.5M park stormwater project" if share < 0.5 else f"this area's {share:.0f}% share of a ~$16.5M park stormwater project" if share < 99.5 else f"a park stormwater basin scaled to this area (~${165000 * share / 1e6:.1f}M; the reference project cost ~$16.5M)"), H15, int(165000 * share), 0, int(1200 * share), 2.8,
            f"{pa:.0f} acres of park within ½ mile that could hold a buried basin", pools.pct("pa", pa, False), 4)

    # ---------------- Parks & recreation ----------------
    if pn is not None and pn <= 400:
        add("park_upgrade", "new playground and paths at the nearest park", H15, 760000, 0, 0, 0.5,
            (f"park {int(pn)} m away" if pn >= 1 else "a park lies in this block group") + "; renovations raise home values within ~400 m (+0.5% assumed)", 0.5, 1, scale=0.8)
    if pn is not None and pn >= 594 and d >= 4.9 and hv:
        hi_crime = vc is not None and vc >= 2 * LA_MED["vc"]
        share = 0.22 if d < 8 else 0.33 if d < 15 else 0.45 if d < 30 else 0.85   # homes within ~100 m of a new quarter-acre lot
        add("pocket_park", "0.25-acre pocket park", int(round(share * H)), 850000, int(1.872 * hv + 325000), 25000, 2.1 if hi_crime else 3.0,
            f"nearest park {int(pn)} m away; dense" + ("; reduced for high violent crime" if hi_crime else ""), pools.pct("pn", pn), 2)
    if pn is not None and pn <= 498 and x.get("restroom_m") is not None and x["restroom_m"] > 400:
        add("restroom", "restroom building + fountains", H15, 990000, 0, 60000, 0, "park nearby has no mapped public restroom", pools.pct("pa", pa, False), 0, kind="qol")
    if ten is not None and ten <= 1210 and x.get("pickle_m") is not None and x["pickle_m"] > 2000:
        add("pickleball", "1 tennis court → 4 pickleball courts", H15, 110000, 0, 2000, 0, f"no pickleball within 2 km; tennis courts {_away(ten)}", pools.pct("ten", ten), 0, kind="qol")
    if ten is not None and ten >= 2500 and pa >= 0.1:
        add("tennis", "2 tennis courts in the nearest park", H15, 260000, 0, 4000, 0, f"nearest public tennis court {_away(ten)}", pools.pct("ten", ten), 0, kind="qol")
    if x.get("bask_m") is not None and x["bask_m"] >= 1200 and pn is not None and pn <= 796:
        add("basketball", "1 full court", H15, 580000, 0, 3000, 0, f"nearest public basketball court {_away(x['bask_m'])}", pools.pct("ten", ten) if ten else 0.5, 0, kind="qol")
    if dog is not None and dog >= 2000 and d >= 10.1:
        add("dog_park", "0.5-acre dog park in an existing park", H15, 580000, 0, 15000, 0.25, f"nearest dog park {dog / 1609:.1f} mi away; dense area", pools.pct("ten", ten) if ten else 0.5, 1)
    if pool is not None and pool >= 3000 and d >= 8.15:
        add("pool", "1 public aquatic center", H15, 36560000, 0, 1000000, 0, f"nearest public pool {pool / 1609:.1f} mi away", pools.pct("ht", ht) if ht is not None else 0.5, 0, kind="qol")
    if ht is not None and ht >= 1.1 and pn is not None and pn <= 658 and x.get("playground_m", 9e9) <= 700:
        add("splash_pad", "1 splash pad at the nearest playground", H15, 850000, 0, 40000, 0, f"+{ht:.1f}°F hotter than average; playground nearby", pools.pct("ht", ht), 0, kind="qol")
    if x.get("field_m") is not None and x["field_m"] >= 1609 and x.get("center_m", 9e9) >= 1800:
        add("sports_field", "1 natural-grass field", H15, 550000, 0, 25000, 0, f"nearest public field {x['field_m'] / 1609:.1f} mi away", pools.pct("ten", ten) if ten else 0.5, 0, kind="qol")
    if x.get("center_m") is not None and x["center_m"] >= 2000 and below_med_inc:
        add("rec_center", "1 recreation center", H15, 18500000, 0, 400000, 0, f"no community or rec center within {x['center_m'] / 1609:.1f} mi", 0.5, 0, kind="qol")
    if x.get("power_m") is not None and x["power_m"] <= 400:
        add("corridor_trail", "0.5 mile of trail under the power lines", H15, 1200000, 0, 19000, 0,
            (f"high-voltage line corridor {_away(x['power_m'])}" if x['power_m'] >= 1 else "a high-voltage line corridor crosses this block group") + " (rail and creek corridors need right-of-way data not loaded yet)", pools.pct("ten", ten) if ten else 0.5, 0, kind="qol")
    if d >= 12.4 and pa >= 10.5:
        add("park_cafe", "1 park kiosk café", int(round(min(H, 180 + 0.2 * H))), 185000, 0, 8500, 0.6, f"{pa:.0f} park acres within ½ mile", pools.pct("gro", gro) if gro else 0.5, 1)

    # ---------------- Transit ----------------
    if bt >= 10:
        add("transit_priority", "signal priority at 4 lights + 2 bus bulbs", H15, 398000, 0, 12000, 0, f"{_buses(bt)} an hour at the busiest nearby stop", pools.pct("nocar", nocar), 0, kind="qol")
    if bt >= 8 and ht is not None and ht >= 0.6:
        add("bus_shelters", "4 shelters with shade", H15, 723000, 0, 10000, 0, f"{_buses(bt)} an hour; hot", pools.pct("nocar", nocar), 0, kind="qol")
    if bt >= 12 and ht is not None and ht >= 0:
        add("transit_shade", "4 solar shade canopies", int(round(0.21 * H)), 168000, 0, 9600, 0.5, f"{_buses(bt)} an hour and {_warmer(ht)}", pools.pct("nocar", nocar), 1)
    if bt >= 12 and (rm is None or rm >= 796):
        add("bus_lane", "0.5 mile of red bus lanes (both directions)", H15, 220000, 0, 18000, 0.5, f"{_buses(bt)} an hour at the busiest nearby stop (7-9am); no rail within 800 m", pools.pct("nocar", nocar), 1)
    if bt >= 20 and (rm is None or rm > 1609):
        add("brt", "0.5 mile of BRT corridor (local share)", H15, 11300000, 0, 100000, 5.0, f"{_buses(bt)} an hour; nearest rail {rm / 1609:.1f} mi away" if rm else f"{_buses(bt)} an hour; no rail nearby", pools.pct("nocar", nocar), 2)
    if bt >= 15 and d >= 20 and (rm is None or rm >= 2400):
        add("rail_station", "this area's share of a new light rail line (~0.3 mi) and station", H15, 76000000, 0, 300000, 4.2,
            f"dense area {rm / 1609:.1f} mi from rail with busy bus service; a station costs ~$300M+ shared across ~8 block groups" if rm else "dense area with busy bus service but no rail; a station costs ~$300M+ shared across ~8 block groups",
            pools.pct("nocar", nocar), 5, kind="regional")
    if crashes >= 2 and bt >= 1:
        add("protected_bike", "0.5 mile of curb-protected bike lanes", H15, 925000, 0, 17000, 0, f"{int(ksi)} fatal/severe and {int(crashes)} pedestrian/bike {'crash' if int(crashes) == 1 else 'crashes'} recorded on a bus street", 0.5, 0, kind="qol")
    if d >= 27.4 and rm is not None and rm <= 813:
        add("bike_share", "1 fifteen-dock e-bike share station", int(round(0.78 * H)), 65000, 0, 14000, 0.4, "dense and close to rail or frequent buses", pools.pct("nocar", nocar), 1)
    if nocar >= 16 and below_med_inc:
        add("ebike_library", "30 e-bikes at a community hub", min(H15, int(round(0.65 * H))), 220000, 0, 35000, 0.2, f"{int(nocar)}% of households have no car", pools.pct("nocar", nocar), 1)
    if nocar >= 13 and bt <= 4 and inc is not None and inc <= 60000:
        add("microtransit", "4 electric vans, on demand (1 year)", H15, 950000, 0, 320000, 0.9, f"{int(nocar)}% without a car and " + ("no bus stop with 7-9 am departures within 400 m" if not bt else f"only {_buses(bt)} an hour at the busiest stop nearby"), pools.pct("nocar", nocar), 2)

    # ---------------- Streets & safety ----------------
    if crashes >= 1:
        humps = max(4, min(20, int(round((m.get("acres") or 0) / 15))))
        hph = 11.5 - 6.5 * math.exp(-d / 8)          # homes per hump rises with density
        homes_t = int(round(min(0.15 * H, humps * hph)))
        add("traffic_calming", f"{humps} speed humps on cut-through streets", homes_t, humps * 5958, 0, 0, 1.0,
            f"{int(ksi)} fatal/severe and {int(crashes)} pedestrian/bike {'crash' if int(crashes) == 1 else 'crashes'} recorded; calming that cuts through-traffic ~16% adds ~1% for homes on those streets (assumes ~15% of homes sit on cut-through streets)",
            0.5, 0, scale=0.5)
        nint = 4 if crashes < 10 else 8
        add("crosswalks", f"{nint} intersections upgraded", min(H15, nint * 48), nint * 58000, 0, 0, 0, f"{int(crashes)} pedestrian or bike {'crash' if int(crashes) == 1 else 'crashes'} recorded here", 0.5, 0, kind="qol")
        add("ped_signals", "4 signals retimed + 10 corners daylit", int(round(0.82 * H)), 52000, 0, 4800, 0, f"{int(crashes)} pedestrian or bike {'crash' if int(crashes) == 1 else 'crashes'} recorded; very low cost", 0.5, 0, kind="qol")
        if (m.get("acres") or 0) >= 80:
            local_km = x.get("local_km") or 0.017 * m["acres"] * 1.609
            miles = min(3.0, max(0.5, round(m["acres"] / 320, 1)))
            add("slow_streets", f"{miles} miles of slow streets", int(round(0.13 * H)), int(120000 * miles), 0, int(6500 * miles), 1.1,
                f"{local_km:.1f} km of local streets; {int(crashes)} pedestrian/bike {'crash' if int(crashes) == 1 else 'crashes'}", 0.5, 2)
    if H:
        sqft = int(round(21 * H))
        add("sidewalks", f"~{sqft:,} sq ft of broken sidewalk (10% of walks)", H, sqft * 59, 0, 0, 0, ("LA's sidewalks are ~40% damaged citywide; local survey not loaded" if county == "la" else "assumes 10% of sidewalks need repair (the rule used for Los Angeles, where about 40% are damaged citywide); no sidewalk survey is available for " + county), pools.pct("yb", yb, False) if yb else 0.5, 0, kind="qol")
    if vc is not None and vc >= 10.4 and crashes >= 3 and m.get("acres"):
        km = round(0.01697 * m["acres"], 1)
        add("street_lighting", f"~{km} km of streets relit", int(round(0.3 * H)), int(655600 * km), 0, int(12000 * km), 1.358,
            f"violent crime {vc / LA_MED['vc']:.1f}x LA County's median; lighting cut nighttime outdoor crime 36% in a New York trial (no LA trial found)", pools.pct("vc", vc), 0)
    if vc is not None and vc >= 14:
        add("cameras", "10 cameras at hot spots", int(round(0.25 * H)), 81500, 0, 87000, 0, f"violent crime {vc / LA_MED['vc']:.1f}x LA County's median; CCTV cuts crime ~13% in view", pools.pct("vc", vc), 0, kind="qol")
    if vc is not None and vc >= 17.1:
        add("foot_patrol", "2 officers on foot, 10 years", H, 0, 0, 400000, 2.668, f"violent crime {vc / LA_MED['vc']:.1f}x LA County's median; foot patrols cut violent crime 23% while they run", pools.pct("vc", vc), 0)
        add("violence_interruption", "street outreach team (local share), 10 years", H, 0, 0, 70000, 0.406, f"violent crime {vc / LA_MED['vc']:.1f}x LA County's median", pools.pct("vc", vc), 1)
    if din >= 11:
        add("bid", "BID cleaning + ambassadors (local share)", H15, 0, 0, 250000, 0.418, f"{_dining(din)} within 400 m; LA BIDs cut robbery 12%", pools.pct("din", din), 1)

    # ---------------- Housing ----------------
    if sf >= 40 and hv:
        add("adu", "1 ADU on a typical lot", 1, 130000, 0, 0, 9.2, f"single-family area; typical home {_money(hv)}", 0, 1, kind="owner", value=sig(hv * 0.092))
        add("solar", "6 kW system", 1, 17700, 0, 0, round(24000 / hv * 100, 3), "owned solar sells for ~$4/W more", 0, 0, kind="owner", value=24000)
    vac = x.get("other_vacant") or 0
    if vac >= 20 and hv:
        n = max(2, int(round(vac * 0.18)))
        add("blight_rehab", f"{n} homes rehabbed", int(round(0.64 * H)), n * 110000, 0, 0, 2.3, f"{int(vac)} long-term vacant homes (Census 'other vacant'); rehab lifts neighbors' values (land-value gains of $2-6 per $1 in Richmond)", pools.pct("pop", m.get("pop"), False) if m.get("pop") else 0.5, 2, scale=0.4)
    if below_med_inc and hv and hv <= 790000:
        add("affordable_housing", "50 affordable homes", int(round(0.3 * H)), 39100000, 0, 0, 6.5, _inc_cut(inc) + ": new affordable housing raised nearby prices 6.5% within 0.1 mi", pools.pct("inc", inc, False), 3)
    if d >= 28.5 and below_med_inc and (own is None or own < 50):
        add("clt", "1 eight-unit building into a land trust", H15, 3500000, 0, 45000, 1.4, "dense, lower-income area of mostly rentals", pools.pct("inc", inc, False), 3)
    if sf >= 50 and rm is not None and rm <= 810:
        add("upzone_transit", "rezone single-family lots near transit", int(round(sf / 100 * H)), 300000, 0, 0, 3.0, "single-family lots near rail or frequent bus; land value rises 3-5% (owners gain; some neighbors object)", pools.pct("inc", inc, False) if inc else 0.5, 3, kind="policy")

    # ---------------- Energy ----------------
    if sf >= 31 and yb and yb <= 1975 and x.get("street_km"):
        miles = round(x["street_km"] * 0.95 / 1.609, 1)
        add("undergrounding", f"{miles} miles of overhead lines undergrounded", H, int(3440000 * miles), 0, 0, 2.9,
            f"homes built ~{int(yb)}, so overhead lines are likely " + ("(no utility line map outside LADWP's area)" if county == "la" else "(no utility line map is loaded for this county)") + "; $3.4M per circuit-mile in 2024 dollars", pools.pct("yb", yb, False), 2, scale=0.7)
    if d >= 8.18 and ev is not None and ev >= 801:
        add("ev_hub", "8-port fast-charging hub", H15, 800000, 0, 20000, 1.0, ("no public DC fast charger within 800 m (federal AFDC data)" if county == "la" else "no public charging station mapped within 800 m (OpenStreetMap; the federal AFDC list needs an API key and was not loaded)") + "; 1% assumed (the study's +3.3% is likely partly where chargers get built)", pools.pct("ev", ev), 1)
    if ht is not None and ht >= 1.1 and inc is not None and inc <= 93400:
        add("microgrid", "1 resilience hub (solar + battery)", H15, 3940000, 0, 30000, 0, f"{_warmer(ht)}; cooling center during outages", pools.pct("ht", ht), 0, kind="qol")
    if d >= 15.9 and H:
        add("fiber_5g", "fiber to every home here", H, 3200 * H, 0, int(88.5 * H), 0, "dense area (broadband coverage data not loaded yet; check the FCC map)", pools.pct("din", din), 0, kind="qol")

    # ---------------- Environment ----------------
    if fw is not None and fw <= 493 and x.get("fwy_unwalled_m"):
        L = int(round(x["fwy_unwalled_m"]))
        add("noise_wall", f"{L:,} m of sound wall", int(round(x.get("homes_100m_fwy", 0.22 * H))), L * 2485, 0, 5000, 6.8,
            f"~{L:,} m of freeway within 150 m with no wall in OpenStreetMap; walls add ~6.8% within 100 m. OpenStreetMap misses many walls (it maps only a few dozen in Los Angeles), so check " + ("Caltrans" if state == "CA" else "the state DOT") + " before acting (counted at half weight)", pools.pct("fw", fw, False), 0, scale=0.5)
    if fw is not None and fw <= 500 and x.get("school_m", 9e9) <= 500:
        add("school_filters", "30 classrooms", H15, 30000, 0, 6000, 0, "school within 500 m of a freeway", pools.pct("fw", fw, False), 0, kind="qol")
    if fw is not None and fw <= 150 and d >= 37.3 and hv >= 1000000:
        add("freeway_cap", "this area's share of a cap park", H15, 50000000, 0, 200000, 5.0, "dense, valuable area along a freeway; caps cost $110M-250M+", pools.pct("fw", fw, False), 5, kind="regional")

    # ---------------- Schools & services ----------------
    if yb and yb <= 1970 and x.get("school_m", 9e9) <= 872 and H:
        share = H / 4000 * 100
        add("school_bond", (f"modernize the nearby school (this area's {share:.0f}% share of ~$40M)" if share >= 0.5 else "modernize the nearby school (this area's share of ~$40M is under 1%)"), H, 10000 * H, 0, 0, 3.0,
            "older area served by a nearby public school; California bond passage raised prices ~6% (half used here, for one campus)", 0.5, 3)
    if x.get("library_m") is not None and x["library_m"] >= 1960 and d >= 8.2:
        add("library", "branch renovation + Sunday hours, 10 years", H15, 5500000, 0, 250000, 0, "no library within 2 km", 0.5, 0, kind="qol")
    if x.get("clinic_m") is not None and x["clinic_m"] >= 2570 and below_med_inc:
        add("clinic", "1 community clinic (~25,000 sq ft)", H15, 38800000, 0, 0, 0, "no clinic mapped within 2.5 km; " + _inc_cut(inc), pools.pct("inc", inc, False), 0, kind="qol")

    # ---------------- Amenities & economy ----------------
    if gro is not None and gro >= 1620 and d >= 7.9:
        add("grocery", "1 supermarket (incentive package)", H15, 2000000, 0, 0, 4.0, f"nearest supermarket {gro / 1609:.1f} mi away", pools.pct("gro", gro), 1)
    if x.get("market_m") is not None and x["market_m"] > 2000:
        add("farmers_market", "weekly market, 10 years", H15, 0, 0, 40000, 0.25, "no market mapped within 2 km; +0.25% assumed within 500 m (studies find an inverted-U: too close can hurt)", pools.pct("gro", gro), 1)
    if din >= 2:
        add("main_street", "10 facade grants + small-business help", int(round(0.48 * H)), 750000, 0, 150000, 1.0, f"{_dining(din)} within 400 m: a corridor that could grow (single-family homes gain; condos can lose)", pools.pct("din", din), 2)
    if gro is not None and gro >= 801 and sf >= 50:
        add("corner_store", "2 corner-store / café conversion grants + zoning change", int(round(0.45 * H)), 90000, 0, 3000, 1.9, f"{_dining(din)} within 400 m and the nearest supermarket {gro / 1609:.1f} mi away", pools.pct("gro", gro), 2)
    if din >= 5:
        add("wayfinding", "12 signs + 4 kiosks", int(round(0.34 * H)), 35000, 0, 1800, 0.2, f"walkable strip with {int(din)} restaurants and cafés", pools.pct("din", din), 1)
    if din >= 9:
        add("outdoor_dining", "5 parklets", H15, 125000, 0, 5000, 0, f"{_dining(din)} within 400 m", pools.pct("din", din), 0, kind="qol")
    if din >= 6 and d >= 12:
        add("night_market", "1 market kit (weekend nights)", min(H15, int(round(1.38 * H))), 120000, 0, 24000, 0.6, f"{int(din)} restaurants and cafés within 400 m", pools.pct("din", din), 1)
    if din >= 9 and d >= 16.1:
        add("plaza", "1 block closed to cars as a plaza", H15, 650000, 0, 22000, 2.9, f"{int(din)} restaurants and cafés within 400 m", pools.pct("din", din), 2)
    if d >= 27.4 and din >= 5 and below_med_inc:
        add("vending_zone", "2 blocks, 10 vending stalls", int(round(0.76 * H)), 185000, 0, 16000, 0.3, "busy, lower-income commercial street", pools.pct("din", din), 1)
    if bt >= 10 and din >= 3 and below_med_inc:
        add("food_hall", "1 six-stall food hall in a vacant storefront", H15, 2800000, 0, 85000, 1.6, f"busy bus corridor ({_buses(bt)} an hour) and {_inc_cut(inc)}", pools.pct("din", din), 3)
    return rows
