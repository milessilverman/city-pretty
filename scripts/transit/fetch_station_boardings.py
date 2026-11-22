#!/usr/bin/env python3
"""Fetch station-level boardings for existing US rail systems from the operators' own open-data services and write
data/transit/station_boardings.csv (one row per station and measure) and data/transit/station_boardings_sources.json.

Systems fetched (each adapter states its measure, period and licence text; nothing is estimated here):
  NYCT subway    data.ny.gov 5wq4-mkjj hourly estimates, summed over weekdays of 2025, divided by the number of weekdays seen
  CTA 'L'        data.cityofchicago.org t2rn-p8d7 (avg weekday entries by month), mean of the 2025 months; coordinates from 8pix-ypme
  BART           bart.gov monthly workbooks Ridership_2026MM.xlsx (Average Weekday trip OD); entries = row totals; coordinates from BART GTFS
  MBTA           MBTA Hub 'Fall 2024 MBTA Rail Ridership by SDP Time Period, Route/Line, and Stop' (weekday average ons summed); coordinates from MBTA GTFS
  UTA            maps.rideuta.com RAIL_STOP_RIDERSHIP_TABLE_SINCE_2017 (WKD average boardings, mean of the 2025 months); coordinates by name join to UTA station layers
  Maryland MTA   opendata.maryland.gov cqt2-ypem (weekday ridership by station; the year of the counts is not stated in the source)
  Valley Metro   services2.arcgis.com/2t1927381mhTgWNC RidershipDataPortal layer 0 (average daily boardings per station, July-Sept 2018)

Needs: python3, xlrd (only for BART's station-names.xls: pip install xlrd), openpyxl (BART workbooks).
Usage: python3 scripts/transit/fetch_station_boardings.py [--cache DIR]
"""
import argparse, collections, csv, datetime, io, json, os, re, statistics, sys, urllib.parse, zipfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _socrata as s

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(ROOT, "data", "transit", "station_boardings.csv")
OUT_SRC = os.path.join(ROOT, "data", "transit", "station_boardings_sources.json")
COLS = ["system", "agency_ntd_id", "mode", "station_id", "station_name", "lat", "lon", "avg_boardings_per_day", "day_basis", "measure", "period", "year",
        "n_periods", "coord_source", "source_url", "licence_note"]
rows, sources = [], []
CACHE = None


def jget(url):
    return json.loads(s.get(url))


def arcgis_all(base, where="1=1", fields="*", geometry=False):
    out, off = [], 0
    while True:
        q = {"where": where, "outFields": fields, "returnGeometry": "true" if geometry else "false", "f": "json", "resultOffset": off, "resultRecordCount": 1000}
        d = jget(base + "/query?" + urllib.parse.urlencode(q))
        fs = d.get("features", [])
        out.extend(fs)
        if not fs or not d.get("exceededTransferLimit"):
            return out
        off += len(fs)


def add(**k):
    r = {c: "" for c in COLS}
    r["day_basis"] = "weekday"
    r.update(k)
    rows.append(r)


def fnum(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def norm(n):
    n = n.lower().replace("&", "and")
    n = re.sub(r"\b(station|trax|frontrunner|fr|stn|platform)\b", " ", n)
    n = re.sub(r"[^a-z0-9]+", " ", n)
    return re.sub(r"\s+", " ", n).strip()


# ---------------------------------------------------------------- NYC
def nyc():
    ds, host = "5wq4-mkjj", "https://data.ny.gov"
    meta = s.view_meta(host, ds)
    where = "date_extract_y(transit_timestamp)=2025 AND date_extract_dow(transit_timestamp) between 1 and 5"
    q = {"$select": "date_trunc_ymd(transit_timestamp) as d", "$where": where, "$group": "d", "$limit": 400}
    n_days = len(jget(f"{host}/resource/{ds}.json?" + urllib.parse.urlencode(q)))
    q = {"$select": "station_complex_id,station_complex,borough,transit_mode,latitude,longitude,sum(ridership) as r", "$where": where,
         "$group": "station_complex_id,station_complex,borough,transit_mode,latitude,longitude", "$limit": 2000}
    data = jget(f"{host}/resource/{ds}.json?" + urllib.parse.urlencode(q))
    for r in data:
        add(system="MTA New York City Transit", agency_ntd_id="20008", mode=("HR" if r.get("transit_mode", "").lower() == "subway" else r.get("transit_mode", "")),
            station_id=r["station_complex_id"], station_name=r["station_complex"], lat=r.get("latitude", ""), lon=r.get("longitude", ""),
            avg_boardings_per_day=round(float(r["r"]) / n_days, 1), measure="entries (fare taps), estimated by MTA; mean over weekdays",
            period=f"2025, {n_days} weekdays with data", year=2025, n_periods=n_days, coord_source=f"{host}/d/{ds} (same file)",
            source_url=f"{host}/d/{ds}", licence_note=f"portal metadata licence field: {meta['licence']}; attribution: {meta['attribution']}")
    sources.append(dict(system="NYCT", dataset=meta, note=f"weekdays with data in 2025: {n_days}; stations: {len(data)}"))


# ---------------------------------------------------------------- CTA
def cta():
    host = "https://data.cityofchicago.org"
    m1, m2 = s.view_meta(host, "t2rn-p8d7"), s.view_meta(host, "8pix-ypme")
    d = jget(f"{host}/resource/t2rn-p8d7.json?" + urllib.parse.urlencode({"$where": "month_beginning>='2025-01-01' AND month_beginning<'2026-01-01'", "$limit": 5000}))
    by = collections.defaultdict(list)
    names = {}
    for r in d:
        by[r["station_id"]].append(float(r["avg_weekday_rides"]))
        names[r["station_id"]] = r["stationame"]
    stops = jget(f"{host}/resource/8pix-ypme.json?$limit=1000")
    loc = collections.defaultdict(list)
    for r in stops:
        l = r.get("location") or {}
        if l.get("latitude"):
            loc[r["map_id"]].append((float(l["latitude"]), float(l["longitude"])))
    for sid, v in by.items():
        ll = loc.get(sid)
        lat = round(statistics.mean(x[0] for x in ll), 6) if ll else ""
        lon = round(statistics.mean(x[1] for x in ll), 6) if ll else ""
        add(system="Chicago Transit Authority", agency_ntd_id="50066", mode="HR", station_id=sid, station_name=names[sid], lat=lat, lon=lon,
            avg_boardings_per_day=round(statistics.mean(v), 1), measure="station entries, mean of monthly average-weekday values",
            period="calendar 2025", year=2025, n_periods=len(v), coord_source=f"{host}/d/8pix-ypme (mean of stop rows with map_id = station_id)",
            source_url=f"{host}/d/t2rn-p8d7", licence_note=f"portal metadata licence field: {m1['licence']}; attribution: {m1['attribution']}")
    sources.append(dict(system="CTA", dataset=m1, coordinates_dataset=m2, note=f"stations: {len(by)}; months per station: {sorted(set(len(v) for v in by.values()))}"))


# ---------------------------------------------------------------- BART
BART_CODES = {  # two-letter code in the workbooks -> GTFS parent station id; the name check below compares both sources' names
    "RM": "RICH", "EN": "DELN", "EP": "PLZA", "NB": "NBRK", "BK": "DBRK", "AS": "ASHB", "MA": "MCAR", "19": "19TH", "12": "12TH", "LM": "LAKE", "FV": "FTVL",
    "CL": "COLS", "SL": "SANL", "BF": "BAYF", "HY": "HAYW", "SH": "SHAY", "UC": "UCTY", "FM": "FRMT", "CN": "CONC", "PH": "PHIL", "WC": "WCRK", "LF": "LAFY",
    "OR": "ORIN", "RR": "ROCK", "OW": "WOAK", "EM": "EMBR", "MT": "MONT", "PL": "POWL", "CC": "CIVC", "16": "16TH", "24": "24TH", "GP": "GLEN", "BP": "BALB",
    "DC": "DALY", "CM": "COLM", "CV": "CAST", "ED": "DUBL", "NC": "NCON", "WP": "PITT", "SS": "SSAN", "SB": "SBRN", "SO": "SFIA", "MB": "MLBR", "WD": "WDUB",
    "OA": "OAKL", "WS": "WARM", "PC": "PCTR", "AN": "ANTC", "ML": "MLPT", "BE": "BERY"}


def bart():
    import openpyxl, xlrd, difflib
    page = s.get("https://www.bart.gov/about/reports/ridership").decode("utf8", "replace")
    files = sorted(set(re.findall(r'href="(https://www\.bart\.gov/sites/default/files/[^"]*/Ridership_2026\d\d\.xlsx)"', page)))
    wbn = xlrd.open_workbook(file_contents=s.get("https://www.bart.gov/sites/default/files/docs/station-names.xls"))
    sh = wbn.sheet_by_index(0)
    code_name = {}
    for i in range(1, sh.nrows):
        c = sh.cell_value(i, 1)
        c = str(int(c)) if isinstance(c, float) else str(c)
        code_name[c] = str(sh.cell_value(i, 2))
    gtfs_url = "https://www.bart.gov/dev/schedules/google_transit.zip"
    z = zipfile.ZipFile(io.BytesIO(s.get(gtfs_url)))
    gstops = {}
    for r in csv.DictReader(io.TextIOWrapper(z.open("stops.txt"), "utf-8-sig")):
        if r["location_type"] == "1":
            gstops[r["stop_id"]] = r
    acc = collections.defaultdict(list)
    months = []
    for u in files:
        wb = openpyxl.load_workbook(io.BytesIO(s.get(u)), read_only=True, data_only=True)
        ws = wb["Average Weekday"]
        allrows = list(ws.iter_rows(values_only=True))
        months.append(re.search(r"2026\d\d", u).group(0))
        hdr = allrows[4]
        assert str(hdr[0]).startswith("Exit Station"), hdr[0]
        for r in allrows[5:]:
            code = str(r[0])
            if code == "Grand Total" or code is None:
                continue
            code = str(int(r[0])) if isinstance(r[0], float) else code
            acc[code].append(float(r[-1]))
    bad = []
    for code, v in acc.items():
        g = gstops[BART_CODES[code]]
        ratio = difflib.SequenceMatcher(None, norm(code_name[code]), norm(g["stop_name"])).ratio()
        if ratio < 0.6:
            bad.append((code, code_name[code], g["stop_name"], round(ratio, 2)))
        add(system="San Francisco Bay Area Rapid Transit District", agency_ntd_id="90003", mode="HR", station_id=code, station_name=code_name[code],
            lat=g["stop_lat"], lon=g["stop_lon"], avg_boardings_per_day=round(statistics.mean(v), 1),
            measure="entries (origin-station trips from the OD workbook, row totals); mean of monthly average-weekday values",
            period=f"2026 months {months[0]}-{months[-1]}", year=2026, n_periods=len(v),
            coord_source=f"{gtfs_url} parent station {BART_CODES[code]}", source_url="https://www.bart.gov/about/reports/ridership",
            licence_note="no licence statement found on the BART ridership page; terms not obtained")
    sources.append(dict(system="BART", files=files, station_names_file="https://www.bart.gov/sites/default/files/docs/station-names.xls", gtfs=gtfs_url,
                        note=f"stations: {len(acc)}; months: {months}; low-similarity name pairs to review: {bad}"))


# ---------------------------------------------------------------- MBTA
def mbta():
    base = "https://services1.arcgis.com/ceiitspzDAHrdGO1/arcgis/rest/services/Fall_2024_MBTA_Rail_Ridership_by_SDP_Time_Period_Route_Line_and_Stop/FeatureServer/0"
    fs = arcgis_all(base, where="day_type_name='Weekday'")
    gtfs_url = "https://cdn.mbta.com/MBTA_GTFS.zip"
    z = zipfile.ZipFile(io.BytesIO(s.get(gtfs_url)))
    park = {}
    for r in csv.DictReader(io.TextIOWrapper(z.open("stops.txt"), "utf-8-sig")):
        if r["location_type"] == "1":
            park[r["stop_id"]] = r
    tot, nm, mode, days = collections.defaultdict(float), {}, {}, set()
    for f in fs:
        a = f["attributes"]
        tot[a["parent_station"]] += a["average_ons"] or 0
        nm[a["parent_station"]] = a["stop_name"]
        mode.setdefault(a["parent_station"], set()).add(a["mode"])
        days.add(a["number_service_days"])
    mcode = {"Heavy Rail": "HR", "Light Rail": "LR", "Commuter Rail": "CR", "Bus Rapid Transit": "RB"}
    for p, v in tot.items():
        g = park.get(p, {})
        ms = sorted(mode[p])
        add(system="Massachusetts Bay Transportation Authority", agency_ntd_id="10003", mode="/".join(mcode.get(x, x) for x in ms), station_id=p, station_name=nm[p],
            lat=g.get("stop_lat", ""), lon=g.get("stop_lon", ""), avg_boardings_per_day=round(v, 1),
            measure="boardings (ons, all routes and directions, summed over time periods); average weekday",
            period="Fall 2024 season", year=2024, n_periods=1, coord_source=f"{gtfs_url} parent station {p}" if g else "",
            source_url="https://hub.arcgis.com/datasets/d4610a65064a4d3c8536c75d520e0012_0", licence_note="no licence text in the service metadata; terms not obtained")
    sources.append(dict(system="MBTA", service=base, gtfs=gtfs_url, note=f"stations: {len(tot)}; modes {sorted(set(m for v in mode.values() for m in v))}; service-day counts seen {sorted(days)}"))


# ---------------------------------------------------------------- UTA
def uta():
    root = "https://maps.rideuta.com/server/rest/services/Hosted"
    tbl = f"{root}/RAIL_STOP_RIDERSHIP_TABLE_SINCE_2017/FeatureServer/0"
    fs = arcgis_all(tbl, where="year_=2025 AND servicetype='WKD'")
    layers = {"TRAX": f"{root}/TRAX_Light_Rail_Stations/FeatureServer/0", "FR": f"{root}/FrontRunnerStations/FeatureServer/0"}
    pts = {}
    for k, u in layers.items():
        for f in arcgis_all(u):
            a = f["attributes"]
            nm = norm(a.get("stationnam") or a.get("name") or "")
            pts.setdefault(nm, (a["y"], a["x"], u))
    acc = collections.defaultdict(list)
    meta = {}
    for f in fs:
        a = f["attributes"]
        k = (a["mode"], a["route"], a["stopabbrone"])
        acc[k].append(a["avgboardings"])
        meta[k] = a["stopname"]
    mcode = {"Light Rail": "LR", "Commuter Rail": "CR", "Streetcar": "SR"}
    # a stop appears once per route, so the same station can appear under several routes: sum routes per station
    st = collections.defaultdict(lambda: [0.0, set(), 0, None, ""])
    for k, v in acc.items():
        rec = st[(k[0], k[2])]
        rec[0] += statistics.mean(v); rec[1].add(k[1]); rec[2] = max(rec[2], len(v)); rec[3] = meta[k]
    unmatched = []
    for (mode, ab), rec in st.items():
        if re.search(r"relief|service center", rec[3], re.I):  # operator relief points, not passenger stations
            continue
        nm = norm(rec[3])
        p = pts.get(nm)
        if not p:
            unmatched.append(rec[3])
        add(system="Utah Transit Authority", agency_ntd_id="80001", mode=mcode.get(mode, mode), station_id=ab, station_name=rec[3], lat=p[0] if p else "", lon=p[1] if p else "",
            avg_boardings_per_day=round(rec[0], 1), measure="boardings, weekday average per month, mean of the 2025 months; routes summed: " + "/".join(sorted(rec[1])),
            period="calendar 2025", year=2025, n_periods=rec[2], coord_source=(p[2] + " (name join)") if p else "",
            source_url=tbl, licence_note="no licence text in the service metadata; terms not obtained")
    sources.append(dict(system="UTA", service=tbl, coordinate_layers=layers, note=f"stations: {len(st)}; no coordinates after name join: {sorted(set(unmatched))}"))


# ---------------------------------------------------------------- Maryland MTA
def maryland():
    host, ds = "https://opendata.maryland.gov", "cqt2-ypem"
    meta = s.view_meta(host, ds)
    d = jget(f"{host}/resource/{ds}.json?$limit=500")
    cols = {"weekday_ridership_metro": ("HR", "Metro SubwayLink: gate exit counts"), "weekday_ridership_light_rail": ("LR", "Light RailLink: statistical sampling estimate"),
            "weekday_ridership_marc_penn": ("CR", "MARC Penn Line: person counts by third-party vendor"), "weekday_ridership_marc_camden": ("CR", "MARC Camden Line: person counts"),
            "weekday_ridership_marc_brunswick": ("CR", "MARC Brunswick Line: person counts")}
    n = 0
    for r in d:
        loc = r.get("location") or {}
        for c, (mo, how) in cols.items():
            v = fnum(r.get(c))
            if v is None:
                continue
            n += 1
            add(system="Maryland Transit Administration", agency_ntd_id="30034", mode=mo, station_id=r.get("station_id", ""), station_name=r.get("station_name", ""),
                lat=loc.get("latitude", ""), lon=loc.get("longitude", ""), avg_boardings_per_day=v, measure=f"weekday ridership as published ({how}); entry or exit basis differs by line",
                period="year not stated in the source", year="", n_periods="", coord_source=f"{host}/d/{ds} (same file)", source_url=f"{host}/d/{ds}",
                licence_note=f"portal metadata licence field: {meta['licence']}")
    sources.append(dict(system="Maryland MTA", dataset=meta, note=f"station-measure rows: {n}; the dataset gives no reference year for the counts"))


# ---------------------------------------------------------------- Valley Metro (light rail, own service)
def valley_metro():
    base = "https://services2.arcgis.com/2t1927381mhTgWNC/arcgis/rest/services/RidershipDataPortal/FeatureServer/0"
    q = {"where": "Type='Boardings'", "outFields": "*", "returnGeometry": "true", "outSR": 4326, "f": "json"}
    d = jget(base + "/query?" + urllib.parse.urlencode(q))
    n = 0
    for f in d["features"]:
        a, g = f["attributes"], f.get("geometry") or {}
        v = fnum(a.get("July_Sept_2018"))
        if v is None:
            continue
        n += 1
        add(system="Valley Metro Rail", agency_ntd_id="90209", mode="LR", station_id=a["StationId"], station_name=a["StationName"], lat=g.get("y", ""), lon=g.get("x", ""),
            avg_boardings_per_day=v, day_basis="all days", measure="average daily boardings per station, July-September 2018 quarter, as published by Valley Metro",
            period="July-September 2018", year=2018, n_periods=1, coord_source=base + " (geometry, outSR=4326)",
            source_url=base, licence_note="Valley Metro item text: ridership statistics are for information purposes only and not for official ridership totals; licensee attribution statement required (see audit file)")
    sources.append(dict(system="Valley Metro", service=base, note=f"layer description: 'Average daily ridership by quarter for bus and light rail on the Valley Metro transit system.'; stations with a July-Sept 2018 boardings value: {n}"))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--cache"); ap.parse_args()
    for fn in (nyc, cta, bart, mbta, uta, maryland, valley_metro):
        try:
            fn()
            sys.stderr.write(f"{fn.__name__}: ok, total rows {len(rows)}\n")
        except Exception as e:  # keep going; a failed system is recorded, not hidden
            sources.append(dict(system=fn.__name__, error=str(e)))
            sys.stderr.write(f"{fn.__name__}: FAILED {e}\n")
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS); w.writeheader(); w.writerows(rows)
    json.dump({"generated_by": "scripts/transit/fetch_station_boardings.py", "generated": datetime.date.today().isoformat(), "sources": sources}, open(OUT_SRC, "w"), indent=1)
    print("rows", len(rows), "systems", len({r['system'] for r in rows}))


if __name__ == "__main__":
    main()
