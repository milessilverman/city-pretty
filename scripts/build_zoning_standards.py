#!/usr/bin/env python3
"""Build app/data/zoning_standards.json and app/data/parcel_use_codes.json from the codes themselves.

Pull, don't type: every number below is parsed from the official text fetched at build time, and every rule carries
the verbatim sentence or table row it came from plus the section URL. Nothing is filled in by hand; a parse that
doesn't find what it expects stops the build (assertions), so a changed code can't silently produce wrong rules.

Covered so far:
  - New York City: Zoning Resolution (zr.planning.nyc.gov), R1-R5 districts (the districts that hold one- and
    two-family homes). Districts R6-R12, commercial and manufacturing districts are not encoded.
  - NYC parcel use: PLUTO data dictionary, LAND USE CATEGORY (LandUse) codes.
  - Washington, DC: see build_dc() (11 DCMR Subtitle D, residential house zones).

Usage: python3 scripts/build_zoning_standards.py [--cache DIR]
"""
import datetime, html, json, os, re, subprocess, sys, tempfile, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = datetime.date.today().isoformat()
UA = {"User-Agent": "Mozilla/5.0 (city-pretty public-data build)"}
CACHE = None
if "--cache" in sys.argv:
    CACHE = sys.argv[sys.argv.index("--cache") + 1]
    os.makedirs(CACHE, exist_ok=True)


def fetch(url, binary=False):
    name = re.sub(r"[^A-Za-z0-9]+", "_", url)[-120:]
    if CACHE and os.path.exists(os.path.join(CACHE, name)):
        data = open(os.path.join(CACHE, name), "rb").read()
    else:
        data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
        if CACHE:
            open(os.path.join(CACHE, name), "wb").write(data)
    return data if binary else data.decode("utf-8", "replace")


def text_of(fragment):
    fragment = re.sub(r"<script.*?</script>|<style.*?</style>", " ", fragment, flags=re.S)
    t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()
    return re.sub(r" ([,.;:)])", r"\1", t)   # tags around defined terms leave a space before punctuation


def tables_after(page_html, marker):
    """Rows (lists of cell texts) of the first <table> that follows `marker` in the page."""
    i = page_html.find(marker)
    assert i >= 0, f"marker not found: {marker}"
    j = page_html.find("<table", i)
    k = page_html.find("</table>", j)
    rows = []
    for tr in re.findall(r"<tr.*?</tr>", page_html[j:k], flags=re.S):
        rows.append([text_of(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, flags=re.S)])
    return rows


def section_text(page_text, sec, title):
    """Text of ZR section `sec` (from its heading to the next section heading) in a chapter page's flattened text."""
    head = f"{sec} {title}"
    starts = [m.start() for m in re.finditer(re.escape(head) + r" (?:■ )?Last Amended", page_text)]
    assert starts, f"section heading not found: {head}"
    i = starts[-1]
    m = re.search(r" \d{2}-\d{2,3} [A-Z][^.]{2,120}? (?:■ )?Last Amended", page_text[i + len(head):])
    return page_text[i: i + len(head) + (m.start() if m else 6000)]


# ---------------------------------------------------------------- New York City
NYC_DISTRICTS = ["R1-1", "R1-2", "R1-2A", "R2", "R2A", "R2X", "R3-1", "R3-2", "R3A", "R3X",
                 "R4", "R4-1", "R4A", "R4B", "R5", "R5A", "R5B", "R5D"]
DIST_RE = r"R\d+(?:-\d+)?[A-Z]?"


def nyc_expand(tokens, section):
    """ZR 11-25: "If a section lists an R4 District, therefore, the provisions of that section shall also apply to R4-1,
    R4A and R4B Districts, unless separate provisions for the districts with suffixes are listed within such section."
    So a listed district covers its suffixed variants that the same section does not mention on their own."""
    listed = [t for t in re.findall(DIST_RE, tokens)]
    mentioned = set(re.findall(r"\b" + DIST_RE + r"\b", section))
    out = []
    for t in listed:
        if t in NYC_DISTRICTS:
            out.append(t)
        for v in NYC_DISTRICTS:
            if v != t and v.startswith(t) and not v[len(t)].isdigit() and v not in mentioned and v not in out:
                out.append(v)
    return out


def build_nyc():
    base = "https://zr.planning.nyc.gov"
    ch12, ch22, ch23 = (fetch(f"{base}/article-i/chapter-2"), fetch(f"{base}/article-ii/chapter-2"), fetch(f"{base}/article-ii/chapter-3"))
    t12, t22, t23 = text_of(ch12), text_of(ch22), text_of(ch23)
    url = lambda art, ch, sec: f"{base}/article-{art}/chapter-{ch}/{sec}"
    d = {k: {} for k in NYC_DISTRICTS}

    # 22-00: special rules can modify the use provisions.
    s2200 = section_text(t22, "22-00", "GENERAL PROVISIONS")
    q = re.search(r"The use provisions of this Chapter may be modified or superseded by special rules for certain areas in Article I \(General Provisions\), Article VI \(Special Regulations Applicable to Certain Areas\), and through Special Purpose Districts\.", s2200)
    assert q
    caveat = {"text": q.group(0), "section": "22-00", "url": url("ii", 2, "22-00")}

    # 22-122: housing types on lots that are not qualifying residential sites.
    s = section_text(t22, "22-122", "Use Group II – uses subject to additional conditions")
    assert "In R1 through R5 Districts, on qualifying residential sites, any type of residence shall be permitted" in s
    lim = re.findall(r"in ((?:R[0-9A-Z\-]+(?:, | and )?)+) Districts, residential uses shall be limited to (.*?)(?:;|\.)(?= |$)", s)
    assert len(lim) >= 6, lim
    limited = {}
    for dists, what in lim:
        for dd in nyc_expand(dists, s):
            limited[dd] = (dists, what.replace(" ,", ",").replace(" and", " and").strip())
    for dd in NYC_DISTRICTS:
        if dd in limited:
            dists, what = limited[dd]
            d[dd]["housing_types"] = {"limited_to": what, "quote": f"in {dists} Districts, residential uses shall be limited to {what}",
                                      "applies": "zoning lots that are not qualifying residential sites", "section": "22-122", "url": url("ii", 2, "22-122")}
        else:
            d[dd]["housing_types"] = {"limited_to": None, "quote": "No limitation for this district is listed in ZR 22-122; Use Group II residences of any type are permitted (ZR 22-121 table)",
                                      "section": "22-121, 22-122", "url": url("ii", 2, "22-122")}

    # 23-11: minimum lot area and width.
    s2311 = section_text(t23, "23-11", "Lot Area and Lot Width Regulations in R1 Through R5 Districts")
    rows = tables_after(ch23, "REQUIRED MINIMUM LOT AREA AND LOT WIDTH")
    assert rows[0][:2] == ["Type of Residence", "District"], rows[0]
    for r in rows[1:]:
        r = r[-3:]   # first row carries the type-of-residence cell (rowspan)
        if r[0].startswith("R1 –"):
            other = {"area_sqft": int(r[1].replace(",", "")), "width_ft": int(r[2]), "row": " | ".join(r)}
            continue
        for dd in nyc_expand(r[0], s2311):
            d[dd]["min_lot"] = {"applies_to": "single- or two-family detached, or zero lot line, where permitted", "area_sqft": int(r[1].replace(",", "")),
                                "width_ft": int(r[2]), "row": " | ".join(r), "section": "23-11", "url": url("ii", 3, "23-11")}
    assert all("min_lot" in d[dd] for dd in NYC_DISTRICTS), [dd for dd in NYC_DISTRICTS if "min_lot" not in d[dd]]
    for dd in NYC_DISTRICTS:
        d[dd]["min_lot_other_residences"] = dict(other, applies_to="other residences, where permitted", section="23-11", url=url("ii", 3, "23-11"))

    # 23-21: floor area ratio.
    rows = tables_after(ch23, "MAXIMUM FLOOR AREA RATIO FOR R1-R5 DISTRICTS")
    assert rows[0] == ["District", "Standard zoning lots", "Qualifying residential sites"], rows[0]
    s2321 = section_text(t23, "23-21", "Floor Area Regulations for R1 Through R5 Districts")
    fn = re.search(r"1 (For standard zoning lots with a lot area of 4,000 square feet or more, the maximum residential floor area associated with any single dwelling unit shall not exceed an equivalent floor area ratio of 0\.60\.)", s2321)
    assert fn
    for r in rows[1:]:
        std = re.fullmatch(r"(\d\.\d\d)( 1)?", r[1]); qrs = re.fullmatch(r"(\d\.\d\d)", r[2])
        assert std and qrs, r
        for dd in nyc_expand(r[0], s2321):
            d[dd]["far"] = {"standard": float(std.group(1)), "qualifying_residential_site": float(qrs.group(1)),
                            "per_unit_cap": {"far": 0.60, "min_lot_sqft": 4000, "quote": fn.group(1)} if std.group(2) else None,
                            "row": " | ".join(r), "section": "23-21", "url": url("ii", 3, "23-21")}
    assert all("far" in d[dd] for dd in NYC_DISTRICTS)

    # 23-421 / 23-422: heights for houses.
    s421 = section_text(t23, "23-421", "Basic pitched-roof envelopes for certain districts")
    m = re.search(r"chapter-3/23-421 ((?:R[0-9A-Z\-]+ )+)In the districts indicated, the height and setback regulations for single- or two-family detached, semi-detached, or zero lot line buildings or other structures, where permitted, shall be set forth in this Section\.", s421)
    assert m
    wall = re.search(r"Perimeter walls are subject to setback regulations at a maximum height above the base plane of (\d+) feet\.", s421)
    ridge = re.search(r"These planes start at the maximum permitted height of the perimeter walls and meet at a ridge line of (\d+) feet above the base plane\.", s421)
    assert wall and ridge
    heights = {dd: [] for dd in NYC_DISTRICTS}
    for dd in nyc_expand(m.group(1), s421):
        heights[dd].append({"max_height_ft": int(ridge.group(1)), "perimeter_wall_ft": int(wall.group(1)), "applies_to": "single- or two-family detached, semi-detached or zero lot line buildings",
                            "quote": f"{wall.group(0)} … {ridge.group(0)}", "section": "23-421", "url": url("ii", 3, "23-421")})
    s422 = section_text(t23, "23-422", "Basic flat-roof envelopes for certain districts")
    found = re.findall(r"((?:R[0-9A-Z\-]+ )+)(In the districts? indicated, [^.]*?maximum building height shall be \d+ feet\.)", s422)
    assert len(found) >= 5, found
    for dists, sentence in found:
        h = int(re.findall(r"maximum building height shall be (\d+) feet", sentence)[0])
        bh = re.search(r"maximum base height shall be (\d+) feet", sentence)
        # "except R5 Districts with a letter suffix": the listed district only, not its variants (ZR 11-25 "express provisions")
        targets = [t for t in re.findall(DIST_RE, dists)] if "with a letter suffix" in sentence else nyc_expand(dists, s422)
        for dd in targets:
            if dd in heights:
                heights[dd].append({"max_height_ft": h, "max_base_height_ft": int(bh.group(1)) if bh else None, "quote": sentence,
                                    "section": "23-422", "url": url("ii", 3, "23-422")})
    for dd, hs in heights.items():
        assert hs, f"no height rule parsed for {dd}"
        # 23-42 applies 23-421 and 23-422 together; where both name a district the lower height is the binding one.
        low = min(hs, key=lambda x: x["max_height_ft"])
        d[dd]["height"] = dict(low, all_rules=[{k: v for k, v in x.items() if k != "url"} for x in hs])
    assert all("height" in d[dd] for dd in NYC_DISTRICTS), [dd for dd in NYC_DISTRICTS if "height" not in d[dd]]

    # 12-10 definitions: ancillary dwelling unit, qualifying residential site.
    adu = re.search(r"An “ancillary dwelling unit” is an additional dwelling unit, permitted on the same zoning lot as a single- or two-family residence that does not exceed (eight hundred) square feet of floor area\. Only one ancillary dwelling unit shall be permitted per every single- or two-family residence on a zoning lot\..*?the zoning lot on which the ancillary dwelling unit is located must be the primary residence of an owner of such zoning lot\.", t12)
    assert adu and adu.group(1) == "eight hundred"
    gtz = re.search(r"in ((?:R[0-9A-Z\-]+(?:, | and )?)+) Districts, or portions thereof, located beyond the Greater Transit Zone, no backyard ancillary dwelling units shall be permitted", adu.group(0))
    assert gtz
    no_backyard_outside_gtz = re.findall(DIST_RE, gtz.group(1))
    assert no_backyard_outside_gtz and all(x in NYC_DISTRICTS for x in no_backyard_outside_gtz)
    qrs = re.search(r"A “qualifying residential site” is a zoning lot, or portion thereof: in an R1 through R5 District, that: meets the following criteria: has a minimum lot area of at least 5,000 square feet; is located within the Greater Transit Zone\..*?is not located within an R1 or R2 District;", t12)
    assert qrs

    return {
        "id": "nyc", "name": "New York City", "counties": ["36005", "36047", "36061", "36081", "36085"],
        "zone_source": {"kind": "parcel_field", "field": "ZoneDist1", "lot_area_field": "LotArea", "lot_width_field": "LotFront", "floor_area_field": "BldgArea",
                        "note": "MapPLUTO ZoneDist1 is the district covering the largest share of the tax lot (PLUTO data dictionary)."},
        "code": "New York City Zoning Resolution", "cite_prefix": "ZR", "code_url": base, "as_amended": "sections amended 12/5/2024 (City of Yes for Housing Opportunity), as published on " + TODAY,
        "districts_covered": NYC_DISTRICTS,
        "not_covered": "R6-R12, commercial (C), manufacturing (M) and special-purpose district standards are not encoded here.",
        "caveats": [caveat,
                    {"text": "A zoning lot can be made of more than one tax lot, and MapPLUTO's floor area is the city's recorded gross floor area, not zoning floor area; both are screening inputs only.",
                     "section": "PLUTO data dictionary (LotArea, BldgArea)", "url": "https://s-media.nyc.gov/agencies/dcp/assets/files/pdf/data-tools/bytes/pluto_datadictionary.pdf"}],
        "adu": {"max_sqft": 800, "no_backyard_outside_greater_transit_zone": no_backyard_outside_gtz, "quote": adu.group(0), "section": "12-10 (ancillary dwelling unit)", "url": f"{base}/article-i/chapter-2/12-10"},
        "qualifying_residential_site": {"quote": qrs.group(0), "section": "12-10 (qualifying residential site)", "url": f"{base}/article-i/chapter-2/12-10"},
        "districts": d,
        "verification": {"status": "verified", "checked_on": TODAY,
                         "method": "Fetched the Zoning Resolution chapters from zr.planning.nyc.gov and parsed the tables and sentences with scripts/build_zoning_standards.py; each rule keeps the verbatim text it came from.",
                         "evidence": "Article I Ch. 2 (12-10), Article II Ch. 2 (22-00, 22-121, 22-122), Article II Ch. 3 (23-11, 23-21, 23-421, 23-422)",
                         "unverified_fields": []},
    }


def build_nyc_use_codes():
    pdf_url = "https://s-media.nyc.gov/agencies/dcp/assets/files/pdf/data-tools/bytes/pluto_datadictionary.pdf"
    pdf = fetch(pdf_url, binary=True)
    with tempfile.TemporaryDirectory() as tmp:
        p = os.path.join(tmp, "dd.pdf")
        open(p, "wb").write(pdf)
        txt = subprocess.run(["pdftotext", "-layout", p, "-"], capture_output=True, text=True, check=True).stdout
    version = re.search(r"PLUTO DATA DICTIONARY\s+(\w+ \d{4} \(\d\dv\d\))", txt).group(1)
    i = txt.find("LAND USE CATEGORY (LandUse)\n")
    block = txt[i: i + 4000]
    codes = dict(re.findall(r"^\s+(0[1-9]|1[01])\s{2,}(\S.*?)\s*$", block, flags=re.M))
    assert len(codes) == 11 and codes["01"] == "One & Two Family Buildings", codes
    kind = {"01": "residential", "02": "residential", "03": "residential", "04": "mixed", "11": "vacant"}
    return {
        "id": "nyc_pluto_landuse", "counties": ["36005", "36047", "36061", "36081", "36085"], "field": "LandUse",
        "codes": {c: {"label": lab, "type": kind.get(c, "non-residential")} for c, lab in sorted(codes.items())},
        "source": {"name": f"PLUTO Data Dictionary, {version}, LAND USE CATEGORY (LandUse)", "url": pdf_url},
        "type_rule": "The label is the agency's; the type is read from it: one- and two-family and multi-family buildings are residential, mixed residential & commercial is mixed, vacant land is vacant, all others non-residential.",
        "verification": {"status": "verified", "checked_on": TODAY, "method": "Parsed from the PDF by scripts/build_zoning_standards.py", "evidence": f"{len(codes)} codes", "unverified_fields": []},
    }


# ---------------------------------------------------------------- Washington, DC
# 11 DCMR (Zoning Regulations of 2016), Subtitle D (Residential House zones) and Subtitle U (use permissions), from
# dcregs.dc.gov. Each section's text is the Word file the chapter list links as "View text" (the file id changes when a
# section is amended, so it is read from the chapter list each build); each rule cites the section's own page.
DCREGS = "https://www.dcregs.dc.gov/Common/DCMR"
DC_ZONES = ["R-1A", "R-1B", "R-2", "R-3"]
DC_ZONING_LAYER = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Planning_Landuse_and_Zoning_WebMercator/MapServer/32"


def dc_sections(chapter):
    """{section: (heading, download url, effective date)} from a DCMR chapter list page."""
    page = fetch(f"{DCREGS}/RuleList.aspx?ChapterNum={chapter}")
    out = {}
    for sec, head, guid in re.findall(r"(11-[A-Z]\d+)</a>.*?<td[^>]*>(.*?)</td>.*?DownloadFile=(\{[^}]+\})", page, flags=re.S):
        out[sec] = (text_of(head), f"https://dcregs.dc.gov/Common/DCMR/RuleList.aspx?DownloadFile={guid}")
    assert out, f"no sections listed for {chapter}"
    return out


def dc_text(download_url):
    """Plain text of a DCMR section's Word file (LibreOffice converts it; nothing is retyped)."""
    data = fetch(download_url, binary=True)
    with tempfile.TemporaryDirectory() as tmp:
        p = os.path.join(tmp, "s.doc")
        open(p, "wb").write(data)
        subprocess.run(["soffice", "--headless", "--convert-to", "txt:Text (encoded):UTF8", "--outdir", tmp, p], capture_output=True, check=True, timeout=240)
        t = open(os.path.join(tmp, "s.txt"), encoding="utf-8-sig").read()
    return t.replace("\r", "")


def dc_flat(t):
    return re.sub(r"\s+", " ", t).strip()


def dc_table(t, title, ncols, has_structure):
    """Rows of a DCMR table as it comes out of the Word file: one cell per line, zone cells first (a zone cell can be
    followed by more zone cells that share its rows), then [structure,] value cells. Returns
    [(zones, structure, values, row text)]."""
    i = t.index(title)
    end = re.search(r"\n\s*(?:\d{3}\.\d+\s|SOURCE:)", t[i:])
    cells = [c.strip() for c in t[i: i + (end.start() if end else len(t) - i)].split("\n")[1:] if c.strip()]
    # skip the header cells (they contain no digits except "(ft.)" style units): stop at the first zone cell
    k = next(j for j, c in enumerate(cells) if re.fullmatch(r"R-\d[A-Z]?", c))
    cells, rows, zones, last_zone = cells[k:], [], [], False
    j = 0
    while j < len(cells):
        c = cells[j]
        if re.fullmatch(r"R-\d[A-Z]?", c):
            zones = (zones if last_zone else []) + [c]
            last_zone = True
            j += 1
            continue
        last_zone = False
        struct = None
        if has_structure:
            struct, j = c, j + 1
        vals = cells[j: j + ncols]
        assert len(vals) == ncols and all(re.fullmatch(r"[\d,]+", v) for v in vals), (title, zones, struct, vals)
        rows.append((list(zones), struct, [int(v.replace(",", "")) for v in vals], " | ".join(zones + ([struct] if struct else []) + vals)))
        j += ncols
    assert rows, title
    return rows


def dc_zones_for(listed):
    """A table's zone cell to the base zones it covers. "R-1" in the height, lot-occupancy and accessory-apartment tables
    is the R-1 zone family, whose zones are R-1A and R-1B (Subtitle D § 101.3: "The purposes of the R-1A and R-1B zones")."""
    return [z for z in DC_ZONES if z == listed or (listed == "R-1" and z in ("R-1A", "R-1B"))]


def build_dc():
    secs = {}
    for ch in ("11-D1", "11-D2", "11-U2"):
        secs.update(dc_sections(ch))
    T, F, cite = {}, {}, {}
    for s in ("11-D100", "11-D101", "11-D201", "11-D202", "11-D203", "11-D210", "11-U200", "11-U201", "11-U253"):
        T[s] = dc_text(secs[s][1])
        F[s] = dc_flat(T[s])
        cite[s] = {"section": "Subtitle " + s[3] + " § " + s[4:], "url": f"{DCREGS}/SectionList.aspx?SectionNumber={s}", "text_file": secs[s][1]}
    q = lambda s, rx: (re.search(rx, F[s]) or (_ for _ in ()).throw(AssertionError(f"{s}: {rx}"))).group(0)

    overlay = q("11-D100", r"Geographically modified zones are indicated by letters following the base zone name, such as R-1A/TS/NO or R-3/FB\.")
    density = q("11-D201", r"In all R zones, one \(1\) principal dwelling unit and one \(1\) accessory apartment shall be permitted per lot of record, subject to Subtitle U, Use Permissions\.")
    purpose = {"R-1A": q("11-D101", r"The R-1A zone is intended to provide for areas predominantly developed with detached houses on large lots\."),
               "R-1B": q("11-D101", r"The R-1B zone is intended to provide for areas predominantly developed with detached houses on moderately sized lots\."),
               "R-2": q("11-D101", r"The R-2 zone is intended to provide for areas predominantly developed with semi-detached houses on moderately sized lots that also contain some detached houses\."),
               "R-3": q("11-D101", r"The R-3 zone is intended to permit attached row houses on small lots\.")}
    family = q("11-D101", r"The purposes of the R-1A and R-1B zones are to:")
    principal = q("11-U201", r"The following uses in this section shall be permitted as a matter of right subject to any applicable conditions: \(a\) A principal dwelling unit;")

    d = {z: {"purpose": dict(cite["11-D101"], quote=purpose[z]),
             "dwelling_units": {"principal": 1, "accessory_apartment": 1, "quote": density, **cite["11-D201"]},
             "min_lot": [], "min_lot_inclusionary": [], "lot_occupancy": []} for z in DC_ZONES}
    for zones, st, (w, area), row in dc_table(T["11-D202"], "TABLE D § 202.1", 2, True):
        for z in zones:
            for zz in dc_zones_for(z):
                d[zz]["min_lot"].append({"structure": st, "width_ft": w, "area_sqft": area, "row": row, "table": "Table D § 202.1", **cite["11-D202"]})
    for zones, st, (w, area), row in dc_table(T["11-D202"], "TABLE D § 202.2", 2, True):
        for z in zones:
            for zz in dc_zones_for(z):
                d[zz]["min_lot_inclusionary"].append({"structure": st, "width_ft": w, "area_sqft": area, "row": row, "table": "Table D § 202.2 (Inclusionary Developments)", **cite["11-D202"]})
    for zones, _, (h, stories), row in dc_table(T["11-D203"], "TABLE D § 203.2", 2, False):
        for z in zones:
            for zz in dc_zones_for(z):
                d[zz]["height"] = {"max_height_ft": h, "max_stories": stories, "row": row, "table": "Table D § 203.2", "applies_to": "buildings, not including a penthouse or rooftop structure", **cite["11-D203"]}
    for zones, st, (pct,), row in dc_table(T["11-D210"], "TABLE D § 210.1", 1, True):
        for z in zones:
            for zz in dc_zones_for(z):
                d[zz]["lot_occupancy"].append({"structure": st, "max_pct": pct, "row": row, "table": "Table D § 210.1", **cite["11-D210"]})
    for z in DC_ZONES:
        assert d[z]["min_lot"] and d[z].get("height") and d[z]["lot_occupancy"], (z, d[z])

    # Subtitle U § 253: accessory apartment.
    aa = {
        "by_right": q("11-U253", r"An accessory apartment shall be permitted in a principal dwelling or an accessory building as a matter of right in the R zones, except the R-1B/GT or R 3/GT zone, subject to the provisions of this section\."),
        "owner": q("11-U253", r"Either the principal dwelling or accessory apartment unit shall be owner-occupied for the duration of the accessory apartment use\."),
        "persons": q("11-U253", r"The total number of persons that may occupy the accessory apartment shall not exceed three \(3\)"),
        "share": q("11-U253", r"The accessory apartment unit may not occupy more than thirty-five percent \(35%\) of the gross floor area of the house;"),
        "entrance": q("11-U253", r"Except as provided in Subtitle U § 253\.7\(d\), if an additional entrance is created to a house it shall not be located on a wall of the house that faces a street;"),
        "access": q("11-U253", r"An accessory apartment in an accessory building in an R zone, except the R-1B/GT or R-3/GT zone, shall be permitted as a matter of right subject to the following conditions: \(a\) There shall be permanent access to the accessory building apartment;"),
        "license": q("11-U253", r"Prior to renting an accessory apartment in any zone, the property owner shall obtain a Residential Rental Business License from the Department of Buildings and the property shall be inspected for relevant housing code compliance\."),
    }
    # Table U § 253.7(a) has "2,000 sq. ft." cells, so it is read with its own pattern.
    m = re.search(r"TABLE U § 253\.7\(a\):\s*MINIMUM GROSS FLOOR AREA Zones Minimum GFA ((?:R-\d[A-Z]? [\d,]+ sq\. ft\. ?)+)", F["11-U253"])
    assert m, "Table U § 253.7(a) not found"
    min_gfa = {}
    for z, v in re.findall(r"(R-\d[A-Z]?) ([\d,]+) sq\. ft\.", m.group(1)):
        for zz in dc_zones_for(z):
            min_gfa[zz] = {"sqft": int(v.replace(",", "")), "row": f"{z} | {v} sq. ft.", "table": "Table U § 253.7(a)"}
    assert set(min_gfa) == {"R-1A", "R-1B", "R-2"}, min_gfa   # the table lists R-1 and R-2 only; R-3 has no minimum
    pct = re.search(r"thirty-five percent \((\d+)%\)", aa["share"]).group(1)

    return {
        "id": "dc", "name": "Washington, DC", "counties": ["11001"],
        "zone_source": {"kind": "point_layer", "url": DC_ZONING_LAYER, "field": "ZONING", "attr": "ZoningDC", "lot_area_field": "LANDAREA", "floor_area_field": "CAMA_GBA",
                        "note": "DC Office of Zoning's map of the Zoning Regulations of 2016 (DC GIS), queried at the clicked point; a lot crossed by a zone line takes the zone at the point. Lot area is OTR's LANDAREA; gross floor area is OTR's residential CAMA GBA."},
        "code": "DC Zoning Regulations of 2016 (11 DCMR)", "cite_prefix": "11 DCMR", "code_url": "https://dcregs.dc.gov",
        "as_amended": "sections as published on dcregs.dc.gov on " + TODAY,
        "districts_covered": DC_ZONES,
        "not_covered": "Only the four base R zones are encoded. Geographically modified zones (letters after the base name, such as R-1B/GT or R-3/FB) have their own rules in Subtitle D and are not encoded, nor are the RF, RA, MU and other zones.",
        "overlay_rule": dict(cite["11-D100"], quote=overlay),
        "r1_family": dict(cite["11-D101"], quote=family),
        "principal_use": dict(cite["11-U201"], quote=principal),
        "accessory_apartment": {"max_share_pct": int(pct), "max_persons": 3, "min_gfa": min_gfa, "quotes": aa, **cite["11-U253"]},
        "districts": d,
        "verification": {"status": "verified", "checked_on": TODAY,
                         "method": "Read each section's Word file from the chapter lists on dcregs.dc.gov (converted to text with LibreOffice) and parsed the tables and sentences with scripts/build_zoning_standards.py; each rule keeps the verbatim text or table row it came from.",
                         "evidence": "11 DCMR Subtitle D §§ 100, 101, 201, 202, 203, 210; Subtitle U §§ 200, 201, 253",
                         "unverified_fields": []},
    }


def build_dc_use_codes():
    url = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/MapServer/54"
    meta = json.loads(fetch(url + "?f=json"))
    assert meta.get("name") == "USECODE" and meta.get("description", "").startswith("The Property Use Code table contains a code"), meta.get("name")
    rows = json.loads(fetch(url + "/query?where=1%3D1&outFields=CODE,DESCRIPTION,LONG_DESCRIPTION&returnGeometry=false&f=json"))["features"]
    codes = {}
    for r in rows:
        a = r["attributes"]
        lab, long_ = (a["DESCRIPTION"] or "").strip(), (a["LONG_DESCRIPTION"] or "")
        if a["CODE"] in ("000", "995"):   # "Not assigned yet"; "Condo Main" (the regime's master record, not one home)
            t = "unknown"
        elif re.match(r"Vacan", lab):
            t = "vacant"
        elif re.search(r"Garage|Transient", lab) or re.search(r"(?i)\bno living quarters\b", long_):
            t = "non-residential"
        elif lab == "Residential-Mixed Use":
            t = "mixed"
        elif re.match(r"Residential", lab) or (re.match(r"Condo", lab) and re.search(r"(?i)single.family", long_) and not re.search(r"(?i)parking", lab)):
            t = "residential"
        else:
            t = "non-residential"
        form = None
        if t in ("residential", "mixed"):
            form = ("unit" if re.search(r"Condo", lab) else
                    "multi-family" if re.search(r"Coop|Cooperative|Apartment|Multi-Family|Mutlifamily|Conversion-5", lab) else
                    "small-multi" if re.search(r"Less than 5", lab) else "single-family")
        codes[a["CODE"]] = {"label": lab, "type": t, "form": form}
    assert codes["012"] == {"label": "Residential-Detached-Single-Family", "type": "residential", "form": "single-family"}, codes.get("012")
    assert codes["016"]["form"] == "unit" and codes["023"]["form"] == "small-multi" and codes["021"]["form"] == "multi-family"
    assert codes["011"]["type"] == "residential" and codes["041"]["type"] == "non-residential" and codes["091"]["type"] == "vacant"
    return {
        "id": "dc_otr_usecode", "counties": ["11001"], "field": "USECODE", "codes": dict(sorted(codes.items())),
        "source": {"name": "DC Office of Tax and Revenue USECODE Table, DC GIS Property and Land service, layer 54", "url": url,
                   "description": meta.get("description", "")[:300]},
        "type_rule": "Labels are OTR's. Residential: labels starting 'Residential' (except garages and transient uses) and condominium units whose OTR description says single-family use. Mixed: 'Residential-Mixed Use'. Vacant: labels starting 'Vacant'. Codes 000 'Not assigned yet' and 995 'Condo Main' (a condominium's master record) are unknown. Everything else, including garages (no living quarters), parking units, hotels, dormitories, commercial and institutional codes, is non-residential. Form (residential and mixed only): condominium labels are a unit; cooperative, apartment, multi-family and 5-unit conversion labels are a multi-family building; 'Less than 5' flats and conversions are small multi-unit (2-4); the rest single-family.",
        "verification": {"status": "verified", "checked_on": TODAY, "method": "Read from OTR's USECODE table by scripts/build_zoning_standards.py", "evidence": f"{len(codes)} codes", "unverified_fields": []},
    }


def build_davidson_use_codes():
    """Metro Nashville's parcel layer carries LUDesc, which the layer's metadata document defines as the "General Land
    Use assigned by the Assessor of Property". The metadata does not print the list of descriptions, so the list is read
    from the layer itself (every distinct LUCode / LUDesc pair); labels are the Assessor's own text."""
    meta_url = "https://nashville.maps.arcgis.com/sharing/rest/content/items/691604512e634cb88615773d388d4379/data"
    pdf = fetch(meta_url, binary=True)
    with tempfile.TemporaryDirectory() as tmp:
        p = os.path.join(tmp, "m.pdf")
        open(p, "wb").write(pdf)
        mtxt = subprocess.run(["pdftotext", "-layout", p, "-"], capture_output=True, text=True, check=True).stdout
    mdef = re.search(r"Land Use Description\s+Text\s+(General Land Use assigned by the Assessor of Property)", mtxt)
    assert mdef, "LUDesc definition not found in the Parcels metadata"
    layer = "https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Parcels_view/FeatureServer/0"
    rows = json.loads(fetch(layer + "/query?where=1%3D1&outFields=LUCode,LUDesc&returnDistinctValues=true&returnGeometry=false&orderByFields=LUCode&resultRecordCount=2000&f=json"))["features"]
    codes = {}
    res = re.compile(r"(SINGLE FAMILY|DUPLEX|TRIPLEX|QUADPLEX|RESIDENTIAL CONDO|ZERO LOT LINE|MOBILE HOME|RESIDENTIAL COMBO/MISC|APARTMENT: .*)", re.S)
    unsure = re.compile(r"(RURAL COMBO|PARSONAGE|DORMITORY/BOARDING HOUSE)")
    for r in rows:
        c, lab = r["attributes"]["LUCode"], r["attributes"]["LUDesc"]
        if not lab or not lab.strip():
            continue
        key = lab.strip()   # the page looks a parcel's LUDesc up as the layer gives it (trimmed)
        # The type is read from the Assessor's label, not the code: the same label appears under more than one code
        # (SINGLE FAMILY is 011 in the urban range and 081 in the rural range).
        t = "vacant" if "VACANT" in key else "residential" if res.fullmatch(key) else "unknown" if unsure.fullmatch(key) else "non-residential"
        form = None
        if t == "residential":
            form = ("unit" if key == "RESIDENTIAL CONDO" else "multi-family" if key.startswith("APARTMENT") else
                    "small-multi" if key in ("DUPLEX", "TRIPLEX", "QUADPLEX") else "single-family" if key in ("SINGLE FAMILY", "ZERO LOT LINE", "MOBILE HOME") else None)
        e = codes.setdefault(key, {"label": re.sub(r"\s+", " ", key), "codes": [], "type": t, "form": form})
        if c and c not in e["codes"]:
            e["codes"].append(c)
    assert codes["SINGLE FAMILY"]["type"] == "residential" and codes["DUPLEX"]["type"] == "residential", codes.get("SINGLE FAMILY")
    return {
        "id": "nashville_ludesc", "counties": ["47037"], "field": "LUDesc", "codes": dict(sorted(codes.items())),
        "source": {"name": "Metro Nashville Parcels (Parcels_view), LUDesc: " + mdef.group(1) + " (Parcels metadata document)", "url": meta_url, "values_read_from": layer},
        "type_rule": "Labels are the Assessor's; the type is read from the label. Residential: SINGLE FAMILY, DUPLEX, TRIPLEX, QUADPLEX, RESIDENTIAL CONDO, ZERO LOT LINE, MOBILE HOME, RESIDENTIAL COMBO/MISC and the APARTMENT labels. Vacant: labels containing VACANT. Unknown (a home may or may not be there): RURAL COMBO, PARSONAGE, DORMITORY/BOARDING HOUSE. All others non-residential. Form: SINGLE FAMILY, ZERO LOT LINE and MOBILE HOME single-family; DUPLEX, TRIPLEX, QUADPLEX small multi-unit (2-4); RESIDENTIAL CONDO a unit; APARTMENT labels a multi-family building; RESIDENTIAL COMBO/MISC not stated.",
        "verification": {"status": "verified", "checked_on": TODAY, "method": "Field definition read from the metadata PDF; the distinct LUCode/LUDesc pairs read from the layer by scripts/build_zoning_standards.py",
                         "evidence": f"{len(codes)} labels", "unverified_fields": []},
    }


def main():
    nyc = build_nyc()
    dc = build_dc()
    out = {
        "_source": {
            "description": "Local zoning standards used by the page's 'what fits on this lot' checks. Every rule is parsed from the code's own text at build time and keeps the verbatim text and section URL it came from.",
            "built_by": "scripts/build_zoning_standards.py", "built_on": TODAY,
            "rule": "A jurisdiction not listed here shows 'zoning standards not on file' with the reason; nothing is filled in.",
        },
        "jurisdictions": [nyc, dc],
        "withheld": json.load(open(os.path.join(ROOT, "scripts", "zoning_standards_withheld.json"))),
    }
    json.dump(out, open(os.path.join(ROOT, "app/data/zoning_standards.json"), "w"), indent=1, ensure_ascii=False)
    uses = {
        "_source": {"description": "Parcel-use code tables, from each publisher's own documentation, used to tell whether a parcel is a home.", "built_by": "scripts/build_zoning_standards.py", "built_on": TODAY},
        "systems": [build_nyc_use_codes(), build_dc_use_codes(), build_davidson_use_codes()],
    }
    json.dump(uses, open(os.path.join(ROOT, "app/data/parcel_use_codes.json"), "w"), indent=1, ensure_ascii=False)
    for dd, r in nyc["districts"].items():
        print(dd, r["housing_types"]["limited_to"], r["min_lot"]["area_sqft"], r["min_lot"]["width_ft"], r["far"]["standard"], r["height"]["max_height_ft"], r["height"].get("perimeter_wall_ft"))
    for z, r in dc["districts"].items():
        print(z, [(x["structure"], x["width_ft"], x["area_sqft"]) for x in r["min_lot"]], r["height"]["max_height_ft"], r["height"]["max_stories"], [(x["structure"], x["max_pct"]) for x in r["lot_occupancy"]])
    print("DC accessory apartment min GFA", dc["accessory_apartment"]["min_gfa"])


if __name__ == "__main__":
    main()
