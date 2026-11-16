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


def main():
    nyc = build_nyc()
    out = {
        "_source": {
            "description": "Local zoning standards used by the page's 'what fits on this lot' checks. Every rule is parsed from the code's own text at build time and keeps the verbatim text and section URL it came from.",
            "built_by": "scripts/build_zoning_standards.py", "built_on": TODAY,
            "rule": "A jurisdiction not listed here shows 'zoning standards not on file' with the reason; nothing is filled in.",
        },
        "jurisdictions": [nyc],
        "withheld": json.load(open(os.path.join(ROOT, "scripts", "zoning_standards_withheld.json"))),
    }
    json.dump(out, open(os.path.join(ROOT, "app/data/zoning_standards.json"), "w"), indent=1, ensure_ascii=False)
    uses = {
        "_source": {"description": "Parcel-use code tables, from each publisher's own documentation, used to tell whether a parcel is a home.", "built_by": "scripts/build_zoning_standards.py", "built_on": TODAY},
        "systems": [build_nyc_use_codes()],
    }
    json.dump(uses, open(os.path.join(ROOT, "app/data/parcel_use_codes.json"), "w"), indent=1, ensure_ascii=False)
    for dd, r in nyc["districts"].items():
        print(dd, r["housing_types"]["limited_to"], r["min_lot"]["area_sqft"], r["min_lot"]["width_ft"], r["far"]["standard"], r["height"]["max_height_ft"], r["height"].get("perimeter_wall_ft"))


if __name__ == "__main__":
    main()
