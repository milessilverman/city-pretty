#!/usr/bin/env python3
"""Build app/data/zoning_standards.json and app/data/parcel_use_codes.json from the codes themselves.

Pull, don't type: every number below is parsed from the official text fetched at build time, and every rule carries
the verbatim sentence or table row it came from plus the section URL. Nothing is filled in by hand; a parse that
doesn't find what it expects stops the build (assertions), so a changed code can't silently produce wrong rules.

Covered so far:
  - New York City: Zoning Resolution (zr.planning.nyc.gov), R1-R5 districts (the districts that hold one- and
    two-family homes), R6-R12 (build_nyc_high: 22-121, 23-12, 23-22, 23-432, with each footnoted condition kept), and
    commercial districts where residences are permitted (build_nyc_commercial: 32-121 use table, 34-112 residential
    equivalents, 34-03, 34-111 overlays, 35-62 / 35-632 heights). Manufacturing districts, special purpose districts and
    commercial designations the 34-112 table doesn't name are not encoded.
  - NYC parcel use: PLUTO data dictionary, LAND USE CATEGORY (LandUse) codes.
  - Washington, DC: see build_dc() (11 DCMR Subtitle D, residential house zones).

Usage: python3 scripts/build_zoning_standards.py [--cache DIR]
"""
import datetime, html, json, os, re, subprocess, sys, tempfile, urllib.parse, urllib.request

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


def section_html(page_html, sec, next_sec):
    """HTML of ZR section `sec` in a chapter page: from the last link to it that is followed by `next_sec`'s link."""
    starts = [m.start() for m in re.finditer(r"/" + re.escape(sec) + r"\b", page_html)]
    cands = [s for s in starts if page_html.find("/" + next_sec, s + 5) > s]
    assert cands, f"section not found: {sec}"
    s = max(cands)
    return page_html[s: page_html.find("/" + next_sec, s + 5)]


def sup_text(fragment):
    """Cell text with footnote superscripts kept as ^n ("R6<sup>1</sup>" -> "R6^1"), so a footnoted row stays distinct."""
    s = re.sub(r"<sup[^>]*>(?:\s|<[^>]+>)*(\d)(?:\s|<[^>]+>)*</sup>", r"^\1", fragment)   # the digit can sit inside a <span>
    assert not re.search(r"<sup", s), "a superscript wasn't read as a footnote marker"
    s = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()
    s = re.sub(r"\s*\^", "^", s)
    return re.sub(r"(R\d+)\s+-\s*(\d)", r"\1-\2", s)


def sup_rows(table_html):
    return [[sup_text(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, flags=re.S)] for tr in re.findall(r"<tr.*?</tr>", table_html, flags=re.S)]


def sup_footnotes(after_table_html):
    """{number: text} for the footnotes printed under a ZR table ("1 For zoning lots ... 2 Outside of ...")."""
    t = sup_text(after_table_html)
    t = re.sub(r"\s+([,.;])", r"\1", t)
    parts = re.split(r"(?:^|\s|\^)([1-3])\s+(?=For |Outside )", t)
    out = {}
    for i in range(1, len(parts) - 1, 2):
        out[parts[i]] = parts[i + 1].split(" <")[0].strip()
    return out


HIGH_TOKEN = r"(R\d+(?:-\d)?[A-Z]?)(?:\^(\d))?"
HIGH_RANGE = range(6, 13)   # R6-R12 (ZR 22-121, 23-12, 23-22, 23-432 cover all of them)


def is_high(dist):
    return int(re.match(r"R(\d+)", dist).group(1)) in HIGH_RANGE


def build_nyc_high(ch22, ch23, url):
    """R6-R12 (ZR 22-121, 23-12, 23-22, 23-432). The tables list every suffixed district on its own row, so each row
    applies to exactly the districts it names (ZR 11-25's suffix rule adds none). Where a district's value depends on a
    condition (a footnote: within 100 feet of a wide street, outside a Mandatory Inclusionary Housing area for UAP or
    senior housing, a narrow street), every value is kept with the footnote's own words; a district row without the
    footnote is the value for its other lots."""
    out = {}

    # 22-121: Use Group II table. R6-R12 columns are "●" (permitted) for every residence type, with no "P".
    s121 = section_html(ch22, "22-121", "22-122")
    rows = sup_rows(re.search(r"<table.*?</table>", s121, flags=re.S).group(0))
    head = next(r for r in rows if r[:2] == ["Uses", "R1"])
    cols = head[1:]
    assert cols == [f"R{i}" for i in range(1, 13)], cols
    res_rows = []
    for r in rows:
        if len(r) >= 13 and r[-12:] and all(c in ("●", "● P", "♦", "○", "–", "S", "P") or re.fullmatch(r"[●♦○–SP ]+", c) for c in r[-12:]):
            label = " ".join(r[:-12])
            res_rows.append((label, r[-12:]))
    assert len(res_rows) == 5, res_rows   # single-family detached / other, two-family detached / other, all other types
    for label, cells in res_rows:
        for i in range(5, 12):   # R6..R12
            assert cells[i] == "●", (label, cols[i], cells[i])
    ht_quote = "ZR 22-121 Use Group II table, R6-R12 columns: " + "; ".join(f"{label}: " + " ".join(cells[5:12]) for label, cells in res_rows) + " (● = Permitted)"

    # 23-12: minimum lot area and width for R6-R12.
    s12 = section_html(ch23, "23-12", "23-20")
    rows = sup_rows(re.search(r"<table.*?</table>", s12, flags=re.S).group(0))
    assert rows[0] == ["Type of Residence", "District", "Minimum Lot Area (in sq. ft)", "Minimum Lot Width (in ft)"], rows[0]
    assert len(rows) == 3 and rows[1][1] == rows[2][1] == "R6 - R12", rows
    det = {"applies_to": "single- or two-family detached or zero lot line", "area_sqft": int(rows[1][2].replace(",", "")), "width_ft": int(rows[1][3]),
           "row": " | ".join(rows[1]), "section": "23-12", "url": url("ii", 3, "23-12")}
    oth = {"applies_to": "other residences", "area_sqft": int(rows[2][2].replace(",", "")), "width_ft": int(rows[2][3]),
           "row": " | ".join(rows[2]), "section": "23-12", "url": url("ii", 3, "23-12")}
    assert rows[1][0].startswith("Single- or two-family") and rows[2][0] == "Other residences"

    # 23-22: maximum residential floor area ratio, standard residences vs qualifying affordable or senior housing.
    s22 = section_html(ch23, "23-22", "23-23")
    tb = re.search(r"<table.*?</table>", s22, flags=re.S)
    rows = sup_rows(tb.group(0))
    fn22 = sup_footnotes(s22[tb.end():])
    assert rows[0] == ["District", "Standard residences", "Qualifying affordable housing or qualifying senior housing"], rows[0]
    assert set(fn22) == {"1", "2"} and fn22["1"].startswith("For zoning lots, or portions thereof, located within 100 feet of a wide street") \
        and fn22["2"].startswith("Outside of Mandatory Inclusionary Housing areas"), fn22
    far = {}
    for r in rows[1:]:
        toks = re.findall(HIGH_TOKEN, r[0])
        assert toks and " ".join(t + (f"^{n}" if n else "") for t, n in toks) == r[0], r
        sv, qv = re.fullmatch(r"(\d+\.\d\d)(?:\^(\d))?", r[1]), re.fullmatch(r"(\d+\.\d\d)(?:\^(\d))?", r[2])
        assert sv and qv, r
        for dist, dfn in toks:
            if not is_high(dist):
                continue
            assert not (dfn and (sv.group(2) or qv.group(2))), r
            e = far.setdefault(dist, {"standard": [], "qualifying": []})
            row = " | ".join(r)
            e["standard"].append({"far": float(sv.group(1)), "condition": fn22.get(dfn or sv.group(2)), "row": row})
            e["qualifying"].append({"far": float(qv.group(1)), "condition": fn22.get(dfn or qv.group(2)), "row": row})

    # 23-432: minimum base height, maximum base height and maximum building height.
    s432 = section_html(ch23, "23-432", "23-433")
    tb = re.search(r"<table.*?</table>", s432, flags=re.S)
    rows = sup_rows(tb.group(0))
    fn432 = sup_footnotes(s432[tb.end():])
    assert set(fn432) == {"1", "2", "3"} and fn432["1"].startswith("For zoning lots or portions thereof within 100 feet of a wide street") \
        and fn432["2"].startswith("For zoning lots or portions thereof on a narrow street") and fn432["3"].startswith("Outside of Mandatory Inclusionary Housing areas"), fn432
    assert rows[0][0] == "District" and rows[0][2:] == ["Standard residences", "Qualifying affordable housing or qualifying senior housing"], rows[0]
    assert rows[1] == ["Maximum base height (in feet)", "Maximum height of buildings or other structures (in feet)"] * 2, rows[1]
    hts = {}
    for r in rows[2:]:
        toks = re.findall(HIGH_TOKEN, r[0])
        assert toks and len(r) == 6 and all(re.fullmatch(r"\d+", c) for c in r[1:]), r
        mn, sb, sh, qb, qh = (int(c) for c in r[1:])
        row = " | ".join(r)
        for dist, dfn in toks:
            if not is_high(dist):
                continue
            e = hts.setdefault(dist, {"standard": [], "qualifying": []})
            cond = fn432.get(dfn)
            # Footnote 3 rows are for lots containing UAP developments or qualifying senior housing: their values go to
            # the qualifying column only (their standard-residence values repeat the footnote-1 row; checked below).
            if dfn != "3":
                e["standard"].append({"min_base_ft": mn, "max_base_ft": sb, "max_height_ft": sh, "condition": cond, "row": row})
            e["qualifying"].append({"min_base_ft": mn, "max_base_ft": qb, "max_height_ft": qh, "condition": cond, "row": row,
                                    "_std": (sb, sh)})
    for dist, e in hts.items():
        for q in e["qualifying"]:
            if q["condition"] == fn432["3"]:
                f1 = [s for s in e["standard"] if s["condition"] == fn432["1"]]
                assert f1 and (f1[0]["max_base_ft"], f1[0]["max_height_ft"]) == q["_std"], (dist, q)
        for q in e["qualifying"]:
            q.pop("_std")

    # ZR 11-25: "All regulations applicable to a district designation shall be applicable to such district designation
    # appended with a suffix, except as otherwise set forth in express provisions". 23-432 lists R11A on its own row; 23-22
    # lists only R11, so R11's floor area row applies to R11A. Only done where 23-22 never mentions the suffixed district.
    t22 = text_of(s22)
    for dist in sorted(set(hts) - set(far)):
        base_d = re.match(r"R\d+(?:-\d)?", dist).group(0)
        assert base_d in far and base_d != dist and not re.search(r"\b" + re.escape(dist) + r"\b", t22), (dist, base_d)
        far[dist] = {k: [dict(o, via_11_25=f"ZR 23-22 lists {base_d} and not {dist}; ZR 11-25 applies a listed district's rules to its suffixed designations") for o in v]
                     for k, v in far[base_d].items()}
    assert set(far) == set(hts), (sorted(set(far) ^ set(hts)))
    for dist in sorted(far, key=lambda x: (int(re.match(r"R(\d+)", x).group(1)), x)):
        f, h = far[dist], hts[dist]
        assert f["standard"] and f["qualifying"] and h["standard"] and h["qualifying"], dist
        out[dist] = {
            "tier": "R6-R12",
            "housing_types": {"limited_to": None, "quote": ht_quote, "section": "22-121", "url": url("ii", 2, "22-121")},
            "min_lot": dict(det), "min_lot_other_residences": dict(oth),
            "far": {"standard": None, "options": f, "section": "23-22", "url": url("ii", 3, "23-22"),
                    "qualifying_note": "The higher column applies to zoning lots containing qualifying affordable housing or qualifying senior housing (ZR 12-10 definitions); whether a building qualifies isn't checked here."},
            "height": {"max_height_ft": None, "options": h, "section": "23-432", "url": url("ii", 3, "23-432"),
                       "setback_note": "Above the maximum base height a setback is required (ZR 23-433); towers, special areas and the alternative rules of ZR 23-70 aren't checked here."},
        }
    return out


MAPPLUTO_URL = "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0"
C_TOKEN = r"C\d(?:-\d+)?[A-Z]?"


def mappluto_commercial_districts():
    """Commercial ZoneDist1 values actually mapped (MapPLUTO, queried at build time), so the 11-25 suffix rule below is
    applied to real designations only."""
    q = MAPPLUTO_URL + "/query?" + urllib.parse.urlencode({
        "where": "ZoneDist1 LIKE 'C%'", "outFields": "ZoneDist1", "groupByFieldsForStatistics": "ZoneDist1",
        "outStatistics": json.dumps([{"statisticType": "count", "onStatisticField": "OBJECTID", "outStatisticFieldName": "n"}]), "f": "json"})
    d = json.loads(fetch(q))
    vals = sorted({f["attributes"]["ZoneDist1"].strip().upper() for f in d["features"] if f["attributes"]["ZoneDist1"]})
    assert len(vals) > 40 and "C4-4" in vals, vals
    return vals


def build_nyc_commercial(base, url, d):
    """Commercial districts where residences are permitted. Use (ZR 32-121): which residence types each commercial
    district permits. Bulk: ZR 34-112's table of residential equivalents (and 34-03 for C3A); a residential building in
    the district takes the equivalent Residence District's floor area, minimum lot and (R6-R12 equivalents, 35-632)
    height table. C1/C2 overlays mapped in Residence Districts (34-111) are returned separately; the page names them."""
    ch32, ch34, ch35 = (fetch(f"{base}/article-iii/chapter-2"), fetch(f"{base}/article-iii/chapter-4"), fetch(f"{base}/article-iii/chapter-5"))
    q = lambda sec, ch, nxt, pat: re.search(pat, text_of(section_html(ch, sec, nxt)).replace("non" + "- ", "non-"))

    # 32-121: Use Group II by commercial district (columns C1..C8).
    s121 = section_html(ch32, "32-121", "32-122")
    rows = sup_rows(re.search(r"<table.*?</table>", s121, flags=re.S).group(0))
    head = next(r for r in rows if r and r[0] == "Uses")
    cols = head[1:]
    assert cols == [f"C{i}" for i in range(1, 9)], cols
    res_rows = [(" ".join(r[:-8]), r[-8:]) for r in rows if len(r) >= 9 and all(re.fullmatch(r"[●♦○–SPU ]+", c) for c in r[-8:])]
    assert len(res_rows) == 5, res_rows
    use = {}
    for i, col in enumerate(cols):
        cells = [c[i] for _, c in res_rows]
        use[col] = cells
    assert all(c == "–" for c in use["C7"] + use["C8"]), (use["C7"], use["C8"])
    for col in ("C1", "C2", "C5", "C6"):
        assert all(c == "●" for c in use[col]), (col, use[col])
    assert all(c == "● P" for c in use["C4"]), use["C4"]
    assert use["C3"][0] == "●" and use["C3"][2] == "●" and use["C3"][1] == use["C3"][3] == use["C3"][4] == "♦", use["C3"]
    use_quote = lambda col: f"ZR 32-121 Use Group II table, {col} column: " + "; ".join(f"{label}: {cells[cols.index(col)]}" for label, cells in res_rows) + \
        " (● = Permitted, ♦ = Permitted with limitations, P = Additional conditions, – = Not permitted)"
    m122 = q("32-122", ch32, "32-123", r"In C3A Districts, only single- or two-family detached or zero lot line residences shall be permitted\.")
    m123 = q("32-123", ch32, "32-13", r"In C4 Districts, all residential uses shall be permitted except that in lower density growth management areas within the Borough of Staten Island, no residences shall be allowed on the following zoning lots in C4-1 Districts where such zoning district occupies at least four acres within a block, except by special permit of the City Planning Commission in accordance with Section 74-121 \(Residential use in C4-1 Districts in Staten Island\)\.")
    assert m122 and m123

    # 34-112: residential equivalents; 34-03: C3A; 34-111: C1/C2 overlays.
    s112 = section_html(ch34, "34-112", "34-113")
    rows = sup_rows(re.search(r"<table.*?</table>", s112, flags=re.S).group(0))
    assert rows[0] == ["Districts", "Applicable residential equivalent"], rows[0]
    table = {}
    for r in rows[1:]:
        toks = re.findall(C_TOKEN, r[0])
        assert toks and " ".join(toks) == r[0] and re.fullmatch(r"R\d+(?:-\d)?[A-Z]?", r[1]), r
        for t in toks:
            assert t not in table, t
            table[t] = {"equivalent": r[1], "row": " | ".join(r)}
    q112 = q("34-112", ch34, "34-113", r"In the districts indicated, the applicable bulk regulations are the bulk regulations for the residential equivalent of the Commercial District as set forth in the following table:")
    m03 = q("34-03", ch34, "34-10", r"In C3A Districts, the bulk regulations of this Chapter shall not apply\. In lieu thereof, the bulk regulations for R3A Districts in Article II, Chapter 3 \(Residential Bulk Regulations in Residence Districts\), shall apply\.")
    m01 = q("34-01", ch34, "34-02", r"The bulk regulations of this Chapter apply to any zoning lot containing only residential buildings in any Commercial District in which such buildings are permitted\. Where a residential building and one or more buildings containing non-residential uses are on a single zoning lot, the bulk regulations of Article III, Chapter 5, shall apply\.")
    m221 = q("34-221", ch34, "34-222", r"In the districts indicated, the maximum floor area ratio on a zoning lot shall be the applicable maximum floor area ratio permitted pursuant to the provisions of Article II, Chapter 3, except as provided for in the following Sections: Section 34-223 \(Floor area bonus for a public plaza\) Section 34-224 \(Floor area bonus for an arcade\)")
    m111 = q("34-111", ch34, "34-112", r"In the districts indicated, the bulk regulations for the Residence District within which such Commercial Districts are mapped apply, except that: on qualifying residential sites within the Greater Transit Zone, where such districts are mapped within R1 through R5 Districts, the bulk regulations for R5 Districts without a letter suffix shall apply; and on non-qualifying residential sites, where such districts are mapped within R1 or R2 Districts, the bulk regulations for R3-2 Districts shall apply\.")
    m62 = q("35-62", ch35, "35-63", r"However, for non-qualifying residential sites: \(a\) located within R3 and R4 Districts, the height and setback regulations for R4 Districts without a letter or number suffix shall apply; and \(b\) located within R5A or R5B Districts, the height and setback regulations for R5 Districts without a letter suffix shall apply\.")
    m632 = q("35-632", ch35, "35-633", r"The minimum base height, maximum base height and maximum building height shall be as set forth in the table in Section 23-432 for the applicable Residence District\.")
    assert q112 and m03 and m01 and m221 and m111 and m62 and m632
    clean = lambda m: m.group(0)

    # The designations actually mapped. ZR 11-25 (quoted in build_nyc) applies a listed designation to the same
    # designation appended with a suffix, unless the section lists the suffixed one separately: "C5" covers C5-1..C5-5.
    # Designations with other suffixes (".5", G, M, P, T) are mapped with Special Purpose District rules; whether 11-25
    # carries the residential equivalent over is not settled here, so they are withheld with that reason.
    mapped = mappluto_commercial_districts()
    out, withheld, no_res = {}, {}, {}
    for z in mapped:
        col = re.match(r"C(\d)", z).group(0)
        if col in ("C7", "C8"):
            no_res[z] = {"quote": use_quote(col), "section": "32-121", "url": url("iii", 2, "32-121")}
            continue
        if z == "C3A":
            eq, how = "R3A", {"section": "34-03", "url": url("iii", 4, "34-03"), "quote": clean(m03)}
        elif z in table:
            eq, how = table[z]["equivalent"], {"section": "34-112", "url": url("iii", 4, "34-112"), "quote": clean(q112) + " " + table[z]["row"]}
        else:
            parents = [t for t in table if z.startswith(t) and z != t]
            parent = max(parents, key=len) if parents else None
            suffix = z[len(parent):] if parent else None
            if parent and "-" not in parent and re.fullmatch(r"-\d", suffix):
                eq = table[parent]["equivalent"]
                how = {"section": "34-112, 11-25", "url": url("iii", 4, "34-112"),
                       "quote": clean(q112) + " " + table[parent]["row"] + f" ({z}: ZR 11-25 applies {parent}'s listing to {z}, which the table doesn't list separately)"}
            else:
                withheld[z] = (f"ZR 34-112's table doesn't list {z}" + (f"; it is {parent} with the suffix \"{suffix}\", a designation mapped with Special Purpose District rules, so its residential equivalent isn't applied here" if parent else ""))
                continue
        assert eq in d, (z, eq)
        e = json.loads(json.dumps(d[eq]))
        col_cells = use[col]
        if z == "C3A":
            ht = {"limited_to": "single- or two-family detached or zero lot line residences", "quote": clean(m122), "section": "32-122", "url": url("iii", 2, "32-122")}
        else:
            ht = {"limited_to": None, "quote": use_quote(col), "section": "32-121", "url": url("iii", 2, "32-121")}
            if z == "C4-1":
                ht["condition"] = clean(m123)
                ht["condition_section"] = "32-123"
        e["housing_types"] = ht
        e["commercial"] = {"district": z, "equivalent": eq, "how": how,
                           "residential_only": {"quote": clean(m01), "section": "34-01", "url": url("iii", 4, "34-01")},
                           "bonus": {"quote": clean(m221), "section": "34-221", "url": url("iii", 4, "34-221")}}
        if e.get("tier") == "R6-R12":
            e["height"]["commercial_note"] = {"quote": clean(m632), "section": "35-632", "url": url("iii", 5, "35-632")}
        elif z == "C3A":
            # 34-03: Chapter 34 (with its 34-24 height modifications) doesn't apply in C3A; R3A's Article II, Chapter 3 rules do.
            e["height"]["commercial_note"] = {"quote": clean(m03), "section": "34-03", "url": url("iii", 4, "34-03")}
        else:
            # R1-R5 equivalents: 35-62 substitutes other districts' heights on non-qualifying sites in some cases; which
            # case a C3 or C4-1 lot falls in isn't settled from the text, so no height is shown.
            e["height"] = {"withheld": True, "quote": clean(m62), "section": "35-62", "url": url("iii", 5, "35-62"),
                           "reason": f"ZR 35-62 modifies the residence district's height rules in commercial districts with an R1-R5 equivalent for non-qualifying residential sites; how it applies to {z} isn't settled here, so no height is shown."}
        out[z] = e

    # Overlays: C1-1..C1-5 and C2-1..C2-5 mapped within Residence Districts (MapPLUTO Overlay1 / Overlay2).
    ov_d = re.search(r"/34-111 ((?:C\d-\d )+)In the districts indicated", re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", section_html(ch34, "34-111", "34-112")))))
    assert ov_d, "34-111 district list"
    overlay_districts = ov_d.group(1).split()
    assert overlay_districts == [f"C{a}-{b}" for a in (1, 2) for b in range(1, 6)], overlay_districts
    within = {}
    for dist in list(d):
        n = int(re.match(r"R(\d+)", dist).group(1))
        if n in (1, 2):
            within[dist] = {"bulk_from": "R3-2", "why": "34-111: non-qualifying sites in R1 or R2 take R3-2's bulk (an R1 or R2 lot can't be a qualifying residential site, ZR 12-10)"}
        elif n in (3, 4):
            within[dist] = {"bulk_from": dist, "height_from_non_qrs": "R4", "why": "35-62(a): non-qualifying sites within R3 and R4 take R4's height and setback rules"}
        elif dist in ("R5A", "R5B"):
            within[dist] = {"bulk_from": dist, "height_from_non_qrs": "R5", "why": "35-62(b): non-qualifying sites within R5A or R5B take R5's height and setback rules"}
        elif n == 5:
            within[dist] = {"bulk_from": dist, "why": "34-111: the residence district's own bulk"}
        else:
            within[dist] = {"bulk_from": dist, "why": "34-111: the residence district's own bulk; 35-632: heights from the 23-432 table for that district"}
    overlay = {"districts": overlay_districts, "within": within,
               "quote": clean(m111), "section": "34-111", "url": url("iii", 4, "34-111"),
               "height_quote": clean(m62), "height_section": "35-62", "height_url": url("iii", 5, "35-62"),
               "coverage_note": "MapPLUTO assigns a commercial overlay to a tax lot when it covers at least 10% of the lot's area or at least 50% of the overlay lies within the lot (PLUTO data dictionary, Overlay1), so part of the lot can lie outside it."}
    return out, withheld, no_res, overlay


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

    high = build_nyc_high(ch22, ch23, url)
    assert not set(high) & set(d), set(high) & set(d)
    d.update(high)
    comm, comm_withheld, no_res, overlay = build_nyc_commercial(base, url, d)
    assert not set(comm) & set(d)
    d.update(comm)
    covered = NYC_DISTRICTS + list(high) + list(comm)
    # The registry's MapPLUTO request carries ZoneDist1 but not the overlay, special-district or frontage fields; the page
    # reads those from the same layer by BBL (extra_fields). Same service as the registry entry, checked here.
    reg = json.load(open(os.path.join(ROOT, "app/data/parcel_services.json")))
    assert any(sv["url"] == MAPPLUTO_URL for sv in reg["services"]), "MapPLUTO URL differs from the registry"

    return {
        "id": "nyc", "name": "New York City", "counties": ["36005", "36047", "36061", "36081", "36085"],
        "zone_source": {"kind": "parcel_field", "field": "ZoneDist1", "lot_area_field": "LotArea", "lot_width_field": "LotFront", "floor_area_field": "BldgArea",
                        "note": "MapPLUTO ZoneDist1 is the district covering the largest share of the tax lot (PLUTO data dictionary).",
                        "extra_fields": {"url": MAPPLUTO_URL, "by": "BBL", "fields": ["Overlay1", "Overlay2", "SPDist1", "SPDist2", "LotFront"],
                                         "note": "Read from MapPLUTO by the lot's BBL: commercial overlays (Overlay1/2), special purpose districts (SPDist1/2) and lot frontage (LotFront)."}},
        "code": "New York City Zoning Resolution", "cite_prefix": "ZR", "code_url": base, "as_amended": "sections amended 12/5/2024 (City of Yes for Housing Opportunity), as published on " + TODAY,
        "districts_covered": covered,
        "not_covered": "Manufacturing (M), mixed-use (MX) and special purpose district standards, and commercial designations ZR 34-112 doesn't list, are not encoded here.",
        "commercial_withheld": comm_withheld,
        "no_residences": no_res,
        "commercial_overlay": overlay,
        "caveats": [caveat,
                    {"text": "A zoning lot can be made of more than one tax lot, and MapPLUTO's floor area is the city's recorded gross floor area, not zoning floor area; both are screening inputs only.",
                     "section": "PLUTO data dictionary (LotArea, BldgArea)", "url": "https://s-media.nyc.gov/agencies/dcp/assets/files/pdf/data-tools/bytes/pluto_datadictionary.pdf"}],
        "adu": {"max_sqft": 800, "no_backyard_outside_greater_transit_zone": no_backyard_outside_gtz, "quote": adu.group(0), "section": "12-10 (ancillary dwelling unit)", "url": f"{base}/article-i/chapter-2/12-10"},
        "qualifying_residential_site": {"quote": qrs.group(0), "section": "12-10 (qualifying residential site)", "url": f"{base}/article-i/chapter-2/12-10"},
        "districts": d,
        "verification": {"status": "verified", "checked_on": TODAY,
                         "method": "Fetched the Zoning Resolution chapters from zr.planning.nyc.gov and parsed the tables and sentences with scripts/build_zoning_standards.py; each rule keeps the verbatim text it came from.",
                         "evidence": "Article I Ch. 1 (11-25), Ch. 2 (12-10), Article II Ch. 2 (22-00, 22-121, 22-122), Article II Ch. 3 (23-11, 23-12, 23-21, 23-22, 23-421, 23-422, 23-432), Article III Ch. 2 (32-121, 32-122, 32-123), Ch. 4 (34-01, 34-03, 34-111, 34-112, 34-221), Ch. 5 (35-62, 35-632); commercial designations from MapPLUTO",
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
    # Building form from the label itself: "Multi-Family ... Buildings" are apartment buildings, so the page doesn't run
    # house checks (ADU, pool, lot split) on them. "One & Two Family Buildings" is left to the record's unit count.
    assert codes["02"].startswith("Multi-Family") and codes["03"].startswith("Multi-Family"), codes
    form = {c: "multi-family" for c, lab in codes.items() if lab.startswith("Multi-Family")}
    return {
        "id": "nyc_pluto_landuse", "counties": ["36005", "36047", "36061", "36081", "36085"], "field": "LandUse",
        "codes": {c: dict({"label": lab, "type": kind.get(c, "non-residential")}, **({"form": form[c]} if c in form else {})) for c, lab in sorted(codes.items())},
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
        if r.get("tier") == "R6-R12":
            fo, ho = r["far"]["options"], r["height"]["options"]
            print(dd, r["min_lot"]["area_sqft"], "FAR std", [(o["far"], (o["condition"] or "")[:25]) for o in fo["standard"]], "qual", [o["far"] for o in fo["qualifying"]],
                  "HT std", [(o["max_base_ft"], o["max_height_ft"], (o["condition"] or "")[:25]) for o in ho["standard"]], "qual", [(o["max_base_ft"], o["max_height_ft"]) for o in ho["qualifying"]])
            continue
        print(dd, r["housing_types"]["limited_to"], r["min_lot"]["area_sqft"], r["min_lot"]["width_ft"], r["far"]["standard"],
              "height withheld" if r["height"].get("withheld") else (r["height"]["max_height_ft"], r["height"].get("perimeter_wall_ft")),
              "via " + r["commercial"]["equivalent"] if r.get("commercial") else "")
    print("commercial withheld:", nyc["commercial_withheld"])
    print("no residences:", sorted(nyc["no_residences"]))
    for z, r in dc["districts"].items():
        print(z, [(x["structure"], x["width_ft"], x["area_sqft"]) for x in r["min_lot"]], r["height"]["max_height_ft"], r["height"]["max_stories"], [(x["structure"], x["max_pct"]) for x in r["lot_occupancy"]])
    print("DC accessory apartment min GFA", dc["accessory_apartment"]["min_gfa"])


if __name__ == "__main__":
    main()
