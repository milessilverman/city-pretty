#!/usr/bin/env python3
"""Steps 2b and 2c of the site zoning work (docs/audit/site-zoning-2026-11-23.md): the code tables and the per-site files.

Writes
  app/data/site_zoning/index.json            which county files and city code tables exist, and every city's status
  app/data/site_zoning/<fips>.json           per station-area site: the zoning jurisdiction, the zone code and where it
                                             came from (the city's zoning map asked at the site's point, or the county
                                             parcel record)
  app/data/site_zoning/codes/<city>.json     for each code that occurs on a site: category, whether housing is permitted,
                                             density, floor-area ratio, height; each with section, verbatim quote, URL
                                             and fetch date, or a reason it is not determined

Every code text is fetched by this script when it runs (nothing typed): New York City's Zoning Resolution through the
parsers of scripts/build_zoning_standards.py (build_nyc, run fresh), plus ZR 12-10, 23-52 and 42-12; San Diego
Municipal Code Chapter 13 Divisions 2 to 7 and Chapter 15 Division 1 (City PDFs). Every quote is checked to occur in
the fetched text; a quote that is not found stops the build.

Inputs: <work>/site_juris.json (pipeline/site_zoning_measure.py), <work>/zq_<city>.json (pipeline/site_zoning_points.py).
Usage: python3 -I pipeline/site_zoning_build.py <work>
"""
import collections
import html
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
OUT = os.path.join(ROOT, "app", "data", "site_zoning")
TODAY = date.today().isoformat()
UA = {"User-Agent": "Mozilla/5.0 (city-pretty public-data build)"}
SQFT_PER_ACRE = 43560  # definition of the acre


def get(url, binary=False):
    data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180).read()
    return data if binary else data.decode("utf-8", "replace")


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def page_text(url):
    t = get(url)
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", t, flags=re.S)
    return norm(html.unescape(re.sub(r"<[^>]+>", " ", t)))


def pdf_text(url):
    raw = get(url, binary=True)
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "a.pdf")
        open(p, "wb").write(raw)
        subprocess.run(["pdftotext", "-layout", p, p + ".txt"], check=True)
        t = open(p + ".txt", encoding="utf8", errors="replace").read()
    # drop the running page furniture so sentences that cross a page join up
    t = re.sub(r"\n\s*Ch\.\s+Art\.\s+Div\.\s*\n[^\n]*\n", "\n", t)
    t = re.sub(r"\n\s*San Diego Municipal Code\s+Chapter 1[35]: [A-Za-z ]+\n\s*\(\d+-\d{4}\)\s*\n", "\n", t)
    return t


def must(text, quote, where):
    q = norm(quote)
    if q not in norm(text):
        raise AssertionError(f"quote not found in {where}: {q[:120]}")
    return q


def src(section, quote, url, text):
    return {"section": section, "quote": must(text, quote, url), "url": url, "fetched": TODAY}


# ------------------------------------------------------------------ New York City
NYC = "https://zr.planning.nyc.gov"


def nyc_table():
    import build_zoning_standards as B  # the page's own ZR parsers; fetched fresh (no cache)
    nyc = B.build_nyc()
    t12 = page_text(f"{NYC}/article-i/chapter-2/12-10")
    t2352 = page_text(f"{NYC}/article-ii/chapter-3/23-52")
    t4212 = page_text(f"{NYC}/article-iv/chapter-2/42-12")
    t2200 = page_text(f"{NYC}/article-ii/chapter-2/22-00")
    u2352, u4212 = f"{NYC}/article-ii/chapter-3/23-52", f"{NYC}/article-iv/chapter-2/42-12"
    du = src("23-52", "In the districts indicated, for buildings containing multiple dwelling residences , the maximum number of dwelling units permitted shall be determined by dividing the maximum residential floor area permitted on the zoning lot by the applicable dwelling unit factor.", u2352, t2352)
    du680 = src("23-52", "For all other types of multiple dwelling residences , the applicable dwelling unit factor shall be 680. Fractions equal to or greater than three-quarters resulting from this calculation shall be considered to be one dwelling unit .", u2352, t2352)
    m = re.search(r"applicable dwelling unit factor shall be (\d+)\.", t2352)
    factor = int(m.group(1))
    sda = src("12-10 (special density areas)", "Special density areas shall include: (a) the Manhattan Core ; and (b) the Special Downtown Brooklyn District .", f"{NYC}/article-i/chapter-2/12-10", t12)
    m_res = src("42-12", "Use Group II consists of residences of various types. In Manufacturing Districts , residences shall be allowed as follows: In M1-1D, M1-2D, M1-3D, M1-4D and M1-5D Districts, in accordance with Section 42-311 (Residential uses in M1-1D through M1-5D Districts); In M1-6D Districts, in accordance with Section 42-312 (Use regulations in M1-6D Districts); In M1-5M and M1-6M Districts, in accordance with Section 42-313 (Use regulations in M1-5M and M1-6M Districts); and In certain M1-1, M1-5 and M1-6 Districts, in accordance with Section 42-314 (Use regulations in certain M1-1, M1-5 and M1-6 Districts).", u4212, t4212)
    sp = src("22-00", "The use provisions of this Chapter may be modified or superseded by special rules for certain areas in Article I (General Provisions), Article VI (Special Regulations Applicable to Certain Areas), and through Special Purpose Districts.", f"{NYC}/article-ii/chapter-2/22-00", t2200)
    mx = src("12-10 (Special Mixed Use District)", re.search(r"The \"?Special Mixed Use District\"? is a Special Purpose District designated by the letters \"?MX\"?[^.]*\.", t12).group(0), f"{NYC}/article-i/chapter-2/12-10", t12)
    codes = {}

    def far_range(r):
        f = r.get("far") or {}
        if f.get("standard") is not None:
            return [f["standard"], f["standard"]], [f.get("row")], f
        opts = (f.get("options") or {}).get("standard") or []
        if not opts:
            return None, [], f
        vals = [o["far"] for o in opts]
        return [min(vals), max(vals)], [o["row"] + (" (" + o["condition"] + ")" if o.get("condition") else "") for o in opts], f

    for z, r in nyc["districts"].items():
        ht = r.get("housing_types") or {}
        lim = ht.get("limited_to")
        com = r.get("commercial")
        fr, rows, f = far_range(r)
        cat = "mixed-use" if com else ("multifamily" if not lim else ("single-family" if re.search(r"single-family", lim) and not re.search(r"two-family", lim) else "single-family"))
        row = {"zone": z, "category": cat,
               "categoryBasis": ("a commercial district whose use table permits residences (ZR 32-121); its bulk rules are those of its residential equivalent " + com["equivalent"] + " (ZR 34-112)") if com else ("a residence district (ZR Article II); housing types: " + (lim or "any type of residence")),
               "housing": {"permitted": True, "types": lim or "any type of residence", "section": ht.get("section"), "quote": ht.get("quote"), "url": ht.get("url"), "fetched": TODAY},
               "far": {"low": fr[0], "high": fr[1], "rows": rows, "section": f.get("section"), "url": f.get("url"), "fetched": TODAY,
                       "note": "the standard column; the higher column for qualifying affordable or senior housing is not used" + ("; the higher figure applies only within 100 feet of a wide street, which is not checked here" if fr and fr[0] != fr[1] else "")} if fr else None,
               "height": None, "parking": {"why": "parking rules (ZR Article II Chapter 5) were not read in this job"}}
        h = r.get("height") or {}
        hs = [o["max_height_ft"] for o in ((h.get("options") or {}).get("standard") or []) if o.get("max_height_ft")]
        if h.get("max_height_ft") or hs:
            row["height"] = {"maxFt": [min(hs), max(hs)] if hs else [h["max_height_ft"], h["max_height_ft"]], "section": h.get("section"), "url": h.get("url"), "fetched": TODAY,
                             "quote": "; ".join(o["row"] for o in (h.get("options") or {}).get("standard") or []) or h.get("row") or ""}
        if com:
            row["equivalent"] = {"district": com["equivalent"], **com["how"], "fetched": TODAY}
        if lim:
            row["density"] = {"why": f"the district limits housing to {lim} (ZR 22-122), so the multiple-dwelling unit count of ZR 23-52 does not size it"}
        elif fr:
            row["density"] = {"method": "floor_area_over_factor", "duFactor": factor, "duPerAcre": [round(fr[0] * SQFT_PER_ACRE / factor, 2), round(fr[1] * SQFT_PER_ACRE / factor, 2)],
                              "roundUpFrom": 0.75, "rule": du, "factor": du680,
                              "formula": f"homes = floor-area ratio x lot area / {factor}; a fraction of three-quarters or more counts as one home (ZR 23-52)"}
        else:
            row["density"] = {"why": "no floor-area ratio parsed for this district"}
        codes[z] = row
    for z, q in nyc["no_residences"].items():
        codes[z] = {"zone": z, "category": "commercial", "categoryBasis": "a commercial district whose use table does not permit residences",
                    "housing": {"permitted": False, "section": q["section"], "quote": q["quote"], "url": q["url"], "fetched": TODAY}, "density": {"why": "housing is not permitted"}}
    rules = {"factor": factor, "special_density": sda, "special_district": sp, "manufacturing": m_res, "mixed_use_district": mx,
             "manhattan_counties": ["36061"]}
    return codes, rules, nyc


def nyc_row(zone, rec, codes, rules, county):
    """The code-table row for one NYC site, or a not-determined row with the reason."""
    z = (zone or "").strip()
    spd = (rec.get("special_district") or {}).get("values") or []
    if not z:
        return None
    if spd:
        return {"zone": z, "category": "planned/special", "notDetermined": f"the site's point lies in special purpose district {', '.join(spd)}, whose rules modify or supersede the base district's",
                "quote": rules["special_district"]}
    if county in rules["manhattan_counties"] and z in codes and codes[z].get("density", {}).get("method"):
        return {"zone": z, "category": codes[z]["category"], "notDetermined": "the site is in Manhattan, where the Manhattan Core is a special density area with its own unit rules; whether this point is in the Core is not checked",
                "quote": rules["special_density"]}
    if "/" in z and z.startswith("M"):
        return {"zone": z, "category": "planned/special", "notDetermined": "a paired M/R designation of the Special Mixed Use District (MX), whose own rules are not read here", "quote": rules["mixed_use_district"]}
    if z in codes:
        return codes[z]
    if z == "PARK":
        return {"zone": z, "category": "public/open space", "categoryBasis": "mapped as PARK on the Department of City Planning's zoning district layer (ZONEDIST = PARK), not a zoning district",
                "housing": {"permitted": None, "why": "parkland is not a zoning district; no housing rule applies from the Zoning Resolution"}, "density": {"why": "not a zoning district"}}
    m = re.match(r"^M([123])-(\d)([A-Z]?)$", z)
    if m:
        n, h, suf = m.groups()
        if suf in ("D", "M"):
            return {"zone": z, "category": "industrial", "notDetermined": f"residences in {z} follow ZR 42-311 to 42-313, not read here", "quote": rules["manufacturing"]}
        if suf == "A":
            return {"zone": z, "category": "industrial", "notDetermined": f"{z} carries an A suffix, whose use rules (ZR 42-30s) are not read here", "quote": rules["manufacturing"]}
        if n == "1" and h in ("1", "5", "6"):
            return {"zone": z, "category": "industrial", "notDetermined": f"residences are allowed in certain {('M1-' + h)} districts (ZR 42-314); whether this site is in one is not checked", "quote": rules["manufacturing"]}
        return {"zone": z, "category": "industrial", "categoryBasis": "a manufacturing district (ZR Article IV)",
                "housing": {"permitted": False, **rules["manufacturing"], "note": f"{z} is not one of the districts this section lets residences into"}, "density": {"why": "housing is not permitted"}}
    return {"zone": z, "category": None, "notDetermined": f"{z} is not in the districts parsed from the Zoning Resolution (R, C1-C6 with residential equivalents, C7, C8, M)"}


# ------------------------------------------------------------------ San Diego
SD = "https://docs.sandiego.gov/municode/MuniCodeChapter13/Ch13Art01Division0{n}.pdf"
SD15 = "https://docs.sandiego.gov/municode/MuniCodeChapter15/Ch15Art01Division01.pdf"
SD113 = "https://docs.sandiego.gov/municode/MuniCodeChapter11/Ch11Art03Division02.pdf"   # §113.0222 Calculating Maximum Permitted Density


def sd_table(zones):
    T = {n: pdf_text(SD.format(n=n)) for n in (2, 3, 4, 5, 6, 7)}
    t15 = pdf_text(SD15)
    U = {n: SD.format(n=n) for n in T}
    N = {n: norm(t) for n, t in T.items()}
    codes = {}
    # density in words, from the purpose sections (131.0406 RM, 131.0503 CN ... 131.0507 CC)
    dens = {}
    for n in (4, 5):
        for m in re.finditer(r"((?:RM|CC|CN|CR|CO|CV)-\d-\d+) (?:[^•§]*?)?permits (?:a )?maximum density of 1 dwelling unit for (?:each )?([\d,]+) square feet of lot area", N[n]):
            z = m.group(1)
            if z not in dens:
                sec = "131.0406" if z.startswith("RM") else {"CN": "131.0502", "CR": "131.0503", "CO": "131.0504", "CV": "131.0505", "CC": "131.0507"}[z[:2]]
                dens[z] = (int(m.group(2).replace(",", "")), {"section": "§" + sec, "quote": m.group(0), "url": U[n], "fetched": TODAY})
    nores = {}
    for m in re.finditer(r"((?:CC|CN|CR|CO|CV)-\d-\d+) allows [^•§]*? but no residential use", N[5]):
        nores[m.group(1)] = {"section": "§131.0503(b)" if m.group(1).startswith("CR") else "§131.05", "quote": m.group(0), "url": U[5], "fetched": TODAY}
    mixed_req = src("§131.0540(b)", "Mixed-Use or Multi-Use Requirement. Residential development is permitted only when a commercial structure exists on the premises or is a part of the proposed development.", U[5], T[5])
    commercial_res = src("§131.0540(a)", "Residential Development as a Permitted Use. Residential development is permitted in commercial zones only where it is identified in Table 131-05B.", U[5], T[5])
    limited_cc2 = src("§131.0507(b)(2)", "The following zones allow community-serving uses with limited residential uses:", U[5], T[5])
    limited_co2 = src("§131.0504(b)(2)", "The following zones allow limited residential development:", U[5], T[5])
    rs = src("§131.0403(a)", "The purpose of the RS zones is to provide appropriate regulations for the development of single dwelling units that accommodate a variety of lot sizes and residential dwelling types and which promote neighborhood quality, character, and livability.", U[4], T[4])
    ar = src("§131.0303(a)", "The purpose of the AR zones is to accommodate a wide range of agricultural uses while also permitting the development of single dwelling unit homes at a very low density.", U[3], T[3])
    oc = src("§131.0203", "The purpose of the OC zone is to protect natural and cultural resources and environmentally sensitive lands.", U[2], T[2])
    of = src("§131.0205", "The purpose of the OF zone is to control development within floodplains to protect the public health, safety, and welfare and to minimize hazards due to flooding in areas identified by the FIRM on file with the City Engineer.", U[2], T[2])
    op = src("§131.0202(a)", "The purpose of the OP zones is to be applied to public parks and facilities in order to promote recreation and facilitate the implementation of land use plans.", U[2], T[2])
    rmx = src("§131.0703", "The purpose of the RMX zones is to provide a mix of uses with a focus on residential uses.", U[7], T[7])
    rmx_d = src("§131.0703", "The RMX zones are differentiated in Table 131.07B based on the floor area ratio and structure height.", U[7], T[7])
    emx = src("§131.0704", "The purpose of the EMX zones is to provide a mix of uses with a focus on non-residential uses with opportunities for residential development.", U[7], T[7])
    emx_f = src("Table 131-07A, footnote 1", "Not allowed on sites designated as Prime Industrial Land in a land use plan.", U[7], T[7])
    t113 = pdf_text(SD113)
    rounding = src("§113.0222(a)(1)", "If the quotient resulting from this calculation exceeds a whole number by 0.50 or more, the number of dwelling units shall be increased to the next whole number.", SD113, t113)
    pd = src("§151.0103(a)", "Planned district regulations shall supersede any zoning regulations in the Land Development Code that are inconsistent or not expressly incorporated into the planned district regulations", SD15, t15)
    # Table 131-07B rows (RMX-1..3, EMX-1..3)
    far_row = re.search(r"Maximum Floor Area Ratio\(3\)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)", T[7])
    ht_row = re.search(r"Maximum Structure Height \(ft\)\(2\)\s+(\d+)\s+(\d+)\s+-\s+(\d+)\s+(\d+)\s+-", T[7])
    assert far_row and ht_row
    mx_cols = ["RMX-1", "RMX-2", "RMX-3", "EMX-1", "EMX-2", "EMX-3"]
    mx_far = dict(zip(mx_cols, [float(x) for x in far_row.groups()]))
    hts = ht_row.groups()
    mx_ht = {"RMX-1": int(hts[0]), "RMX-2": int(hts[1]), "RMX-3": None, "EMX-1": int(hts[2]), "EMX-2": int(hts[3]), "EMX-3": None}
    # industrial use table row (Table 131-06B), 10 columns
    ind = re.search(r"IP-\s+IL-\s+IH-\s+IS- IBT-\s*\n.*?3rd >> 1-\s+2-\s+3-\s+1-\s+2-\s+3-\s+1-\s+2-\s+1-\s+1-.*?\n\s*Multiple Dwelling Units\s+((?:[-P]\s+){9}[-P])", T[6], flags=re.S)
    assert ind, "industrial use table row not found"
    ind_cols = ["IP-1-1", "IP-2-1", "IP-3-1", "IL-1-1", "IL-2-1", "IL-3-1", "IH-1-1", "IH-2-1", "IS-1-1", "IBT-1-1"]
    ind_cells = dict(zip(ind_cols, ind.group(1).split()))
    ind_quote = src("Table 131-06B", "Multiple Dwelling Units " + " ".join(ind.group(1).split()), U[6], T[6])
    for z in zones:
        row = {"zone": z}
        if z in dens:
            d, s = dens[z]
            row.update({"category": "multifamily" if z.startswith("RM") else "mixed-use", "categoryBasis": s["quote"],
                        "housing": {"permitted": True, **(s if z.startswith("RM") else commercial_res)},
                        "density": {"method": "lot_area_per_home", "sqftPerHome": d, "duPerAcre": [round(SQFT_PER_ACRE / d, 2), round(SQFT_PER_ACRE / d, 2)], "rule": s,
                                    "roundUpFrom": 0.5, "rounding": rounding,
                                    "formula": f"homes = lot area / {d:,} square feet (1 dwelling unit for each {d:,} square feet of lot area); a fraction of 0.50 or more counts as one more home (§113.0222(a)(1))"}})
            if not z.startswith("RM"):
                row["cautions"] = [{"text": "homes are allowed only with a commercial building on the lot", **mixed_req}]
        elif z in nores:
            row.update({"category": "commercial", "categoryBasis": nores[z]["quote"], "housing": {"permitted": False, **nores[z]}, "density": {"why": "housing is not permitted"}})
        elif re.match(r"^CC-2-\d$", z) or re.match(r"^CO-2-\d$", z):
            row.update({"category": "commercial", "notDetermined": "the zone allows only limited residential use, and the limit is in the use table, not read here", "quote": limited_cc2 if z.startswith("CC") else limited_co2})
        elif z.startswith("RS-"):
            row.update({"category": "single-family", "categoryBasis": rs["quote"], "housing": {"permitted": True, "types": "single dwelling units", **rs}, "density": {"why": "a single-unit zone: one home per lot (Table 131-04D), not a density per acre"}})
        elif z.startswith("AR-"):
            row.update({"category": "single-family", "categoryBasis": ar["quote"], "housing": {"permitted": True, "types": "single dwelling unit homes at a very low density", **ar}, "density": {"why": "residential density beyond one home needs a Planned Development Permit (§131.0303(a)); not sized here"}})
        elif z in ("OC-1-1", "OF-1-1") or z.startswith("OP-"):
            s = oc if z.startswith("OC") else of if z.startswith("OF") else op
            row.update({"category": "public/open space", "categoryBasis": s["quote"], "housing": {"permitted": None, "why": "the open space use table was not read"}, "density": {"why": "an open space zone"}})
        elif z in mx_far:
            isr = z.startswith("RMX")
            row.update({"category": "mixed-use", "categoryBasis": (rmx if isr else emx)["quote"],
                        "housing": {"permitted": True, **rmx} if isr else {"permitted": None, "why": "multiple dwelling units are permitted with footnote 1 of Table 131-07A, which excludes Prime Industrial Land; whether the site is on Prime Industrial Land is not checked", **emx_f},
                        "density": {"why": "the RMX and EMX zones set no dwelling units per lot area; floor area and height govern", **rmx_d},
                        "far": {"low": mx_far[z], "high": mx_far[z], "section": "Table 131-07B", "quote": norm(far_row.group(0)), "url": U[7], "fetched": TODAY},
                        "height": {"maxFt": [mx_ht[z], mx_ht[z]], "section": "Table 131-07B", "quote": norm(ht_row.group(0)), "url": U[7], "fetched": TODAY} if mx_ht[z] else {"why": "the table gives no height limit ('-') for " + z}})
        elif z in ind_cells:
            ok = ind_cells[z] == "P"
            row.update({"category": "industrial", "categoryBasis": "an industrial zone (Chapter 13, Article 1, Division 6)",
                        "housing": {"permitted": ok, **ind_quote, "note": f"the cell for {z} is '{ind_cells[z]}' ('P' permitted, '-' not permitted)"},
                        "density": {"why": "housing is not permitted" if not ok else "no density for multiple dwelling units in industrial zones was read"}})
        elif re.match(r"^(CCPD|OTCC|OTOP|LJSPD|SEPD|BLPD|MVPD|GQPD|CUPD|CVPD)-", z):
            row.update({"category": "planned/special", "notDetermined": "not a Chapter 13 base zone: the designator is a planned district zone, whose own regulations (Chapter 15) were not read", "quote": pd})
        else:
            row.update({"category": None, "notDetermined": f"{z} is not among the zones parsed here (RM, CC, CO, CR, CV, CN with a stated density; RS; AR; RMX; EMX; IP, IL, IH, IS; OC, OF, OP)"})
        codes[z] = row
    return codes


# ------------------------------------------------------------------ Los Angeles (category from the City's own map; code text blocked)
LA_PAGE = "https://planning.lacity.gov/zoning/original-code"
LA_CAT = {"Commercial": "commercial", "Commercial-Mixed": "mixed-use", "Multiple Family Residential": "multifamily", "Single Family Residential": "single-family",
          "Residential": "multifamily", "Residential-Mixed": "mixed-use", "Manufacturing": "industrial", "Industrial": "industrial", "Hybrid Industrial": "industrial",
          "Industrial-Mixed": "industrial", "Open Space": "public/open space", "Public Facilities": "public/open space", "Public": "public/open space"}


def la_table(zq):
    t = page_text(LA_PAGE)
    q = src("Original Zoning Code (Chapter 1) page", "The zoning regulations in all areas of the City excluding Downtown (that is, any Community Plan effective prior to the Downtown Community Plan, which went into effect in January 2025) are in the Original Zoning Code (Chapter 1). These regulations are published in the Municipal Code .", LA_PAGE, t)
    qprefix = src("Original Zoning Code (Chapter 1) page", "A Q condition prefix may impose either temporary or permanent development restrictions on a property.", LA_PAGE, t)
    qd = src("Original Zoning Code (Chapter 1) page", "A D limitation may be adopted on a property or neighborhood to impose further restrictions on the height, floor area, and setbacks of a building.", LA_PAGE, t)
    qo = src("Original Zoning Code (Chapter 1) page", "Zones that are located within a Supplemental Use District, or Overlay, are subject to further regulatory controls.", LA_PAGE, t)
    codes = {}
    for r in zq.values():
        z, f = r.get("zone"), r.get("fields") or {}
        if not z or z in codes:
            continue
        c = f.get("CATEGORY")
        row = {"zone": z, "category": LA_CAT.get(c), "categoryBasis": f"the Department of City Planning's own category for this zone on its zoning layer: \"{c}\"",
               "categorySource": {"url": r["url"], "field": "CATEGORY", "value": c, "fetched": r["asked"]},
               "housing": {"permitted": None, "why": "the zoning code's text is not on file: it is published on American Legal Publishing (codelibrary.amlegal.com), which answered this machine HTTP 403 (a bot check)"},
               "density": {"why": "the code's lot area per dwelling unit is not on file (codelibrary.amlegal.com answered HTTP 403)"}, "codeHost": q}
        if c and not LA_CAT.get(c):
            row["notDetermined"] = f"the map's category \"{c}\" is not one of the categories used here"
        cautions = []
        if re.search(r"[\[(]Q[\])]|^Q", z):
            cautions.append({"text": "Q condition on this zone", **qprefix})
        if re.search(r"\d[A-Z]*D\b|-\d+D|\dD-", z):
            cautions.append({"text": "D limitation on this zone", **qd})
        if re.search(r"-(SP|CPIO|CDO|HPOZ|O|SN|RIO|CUGU|POD|K)\b", z):
            cautions.append({"text": "overlay or supplemental use district on this zone", **qo})
        if cautions:
            row["cautions"] = cautions
        codes[z] = row
    return codes


# ------------------------------------------------------------------ cities whose code text could not be fetched
TRIED = {
    "place:4805000": {"city": "Austin", "tried": [
        {"url": "https://library.municode.com/tx/austin/codes/land_development_code", "result": "HTTP 403 (Cloudflare bot check, 'Performing security verification')", "on": "2026-11-22"},
        {"url": "https://api.municode.com/Clients/name?clientName=austin&stateAbbr=tx", "result": "HTTP 403", "on": "2026-11-22"},
        {"url": "https://www.austintexas.gov/planning/zoning-resources-site-regulations", "result": "HTTP 200; the City's page links to Municode for the code text (Permitted Use Chart, 25-2-491; Site Development Regulations, 25-2-492)", "on": "2026-11-22"}]},
    "place:0644000": {"city": "Los Angeles", "tried": [
        {"url": "https://codelibrary.amlegal.com/codes/los_angeles/latest/lapz/0-0-0-2527", "result": "HTTP 403 (Cloudflare bot check)", "on": "2026-11-22"},
        {"url": "https://codelibrary.amlegal.com/codes/los_angeles/latest/lapz/0-0-0-1", "result": "HTTP 403", "on": "2026-11-22"},
        {"url": "https://planning.lacity.gov/zoning/original-code", "result": "HTTP 200; the City says Chapter 1 'is published in the Municipal Code' and links to American Legal", "on": "2026-11-22"}]},
    "place:1714000": {"city": "Chicago", "tried": [{"url": "https://codelibrary.amlegal.com/codes/chicago/latest/chicago_il/0-0-0-2627958", "result": "HTTP 403", "on": "2026-11-22"}]},
    "place:4819000": {"city": "Dallas", "tried": [{"url": "https://codelibrary.amlegal.com/codes/dallas/latest/dallas_tx/0-0-0-1", "result": "HTTP 403", "on": "2026-11-22"}]},
    "place:0455000": {"city": "Phoenix", "tried": [{"url": "https://phoenix.municipal.codes/ZO", "result": "HTTP 403", "on": "2026-11-22"}]},
    "place:5363000": {"city": "Seattle", "tried": [{"url": "https://seattle.municipal.codes/SMC/23.44.010", "result": "HTTP 403", "on": "2026-11-22"}]},
}
CITY_KEY = {"place:3651000": "nyc", "place:0666000": "san_diego", "place:0644000": "los_angeles", "place:4805000": "austin"}
POINT_SERVICE = {"nyc": "zq_nyc.json", "san_diego": "zq_san_diego.json", "los_angeles": "zq_los_angeles.json", "austin": "zq_austin.json"}
NOT_A_ZONE = {"CONTACT LOCAL JURISDICTION": "the parcel service's zoning field says 'CONTACT LOCAL JURISDICTION', not a zone"}


def dedupe(codes):
    """Quote objects used by more than one row are stored once in the table's `quotes` and referenced as {"ref": id}
    (StationSites.limitsOf resolves them), so a city file stays small."""
    seen = collections.Counter()
    key = lambda v: json.dumps(v, sort_keys=True)

    def walk(x, f):
        items = list(x.items()) if isinstance(x, dict) else list(enumerate(x)) if isinstance(x, list) else []
        for k, v in items:
            if isinstance(v, dict) and isinstance(v.get("quote"), str) and len(v["quote"]) > 60:
                x[k] = f(v)
            else:
                walk(v, f)
    walk(codes, lambda v: (seen.update([key(v)]), v)[1])
    quotes, ids = {}, {}

    def rep(v):
        k = key(v)
        if seen[k] < 2:
            return v
        if k not in ids:
            ids[k] = "q" + str(len(ids))
            quotes[ids[k]] = v
        return {"ref": ids[k]}
    walk(codes, rep)
    return quotes


def main(work):
    juris = json.load(open(os.path.join(work, "site_juris.json")))
    zq = {c: json.load(open(os.path.join(work, f))) for c, f in POINT_SERVICE.items() if os.path.exists(os.path.join(work, f))}
    os.makedirs(os.path.join(OUT, "codes"), exist_ok=True)
    tables = {}
    nyc_codes, nyc_rules, nyc = nyc_table()
    sd_zones = sorted({r["zone"] for r in zq.get("san_diego", {}).values() if r.get("zone")})
    tables["san_diego"] = {"codes": sd_table(sd_zones), "city": "City of San Diego", "code": "San Diego Municipal Code, Chapter 13 (Zones) and Chapter 15 (Planned Districts)", "codeUrl": "https://docs.sandiego.gov/municode/MuniCodeChapter13/"}
    tables["los_angeles"] = {"codes": la_table(zq.get("los_angeles", {})), "city": "City of Los Angeles", "code": "Los Angeles Municipal Code, Chapter 1 and Chapter 1A (text not fetched; see codeHost)", "codeUrl": LA_PAGE}
    # NYC: one row per zone string actually found at a site (special district, Manhattan and MX rows are per site, below)
    nyc_rows = {}
    files = collections.defaultdict(dict)
    srcs = collections.defaultdict(list)
    stats = collections.Counter()

    def si(fips, s):
        if s not in srcs[fips]:
            srcs[fips].append(s)
        return srcs[fips].index(s)

    for s in juris:
        ck = CITY_KEY.get(s["juris"])
        rec, zone, how = None, None, None
        if ck and ck in zq and s["id"] in zq[ck]:
            rec = zq[ck][s["id"]]
            zone = rec.get("zone")
            how = si(s["fips"], {"kind": "point", "url": rec["url"], "asked": rec["asked"]})
        if not zone and s.get("zn") and s["zn"] not in NOT_A_ZONE and not (s["fips"] == "06073" and re.fullmatch(r"\d+", s["zn"])):
            zone = s["zn"]
            how = si(s["fips"], {"kind": "parcel", "note": "the zoning field of the county parcel record (station_sites p.zn)"})
        key = None
        if ck == "nyc" and zone:
            row = nyc_row(zone, rec or {}, nyc_codes, nyc_rules, s["county"])
            spd = ((rec or {}).get("special_district") or {}).get("values") or []
            key = zone + "|special:" + ",".join(spd) if spd else zone + "|manhattan" if "Manhattan" in (row.get("notDetermined") or "") else zone
            nyc_rows[key] = row
        elif ck in ("san_diego", "los_angeles") and zone:
            key = zone if zone in tables[ck]["codes"] else None
        out = [s["juris"], zone, how]
        if key and key != zone:
            out.append(key)
        if rec and not rec.get("zone") and rec.get("why"):
            out.append({"why": rec["why"]})
        if rec and (rec.get("commercial_overlay") or {}).get("values"):
            out.append({"overlay": rec["commercial_overlay"]["values"]})
        files[s["fips"]][s["id"]] = out
        stats["sites"] += 1
        stats["zone"] += 1 if zone else 0
    tables["nyc"] = {"codes": nyc_rows, "city": "New York City", "code": "New York City Zoning Resolution", "codeUrl": NYC,
                     "rules": {"factor": nyc_rules["factor"]}}
    tables["austin"] = {"codes": {}, "city": "City of Austin", "code": "Austin Land Development Code, Title 25 (text not fetched)", "codeUrl": TRIED["place:4805000"]["tried"][0]["url"], "notOnFile": TRIED["place:4805000"]}
    # write
    idx = {"built": TODAY, "builder": "pipeline/site_zoning_build.py", "audit": "docs/audit/site-zoning-2026-11-23.md",
           "columns": ["zoning jurisdiction (place:<Census place GEOID> = incorporated place; county:<FIPS> = unincorporated county land)", "zone code (null = not on file)", "index into sources: how the code was read", "optional: the code-table key when it differs from the code (a site-specific row)", "optional: { why } the zoning service's answer when it gave no code, or { overlay } NYC commercial overlay at the point"],
           "cities": {}, "counties": sorted(files), "notOnFile": TRIED}
    for ck, T in tables.items():
        doc = {"city": T["city"], "jurisdiction": [k for k, v in CITY_KEY.items() if v == ck][0], "code": T["code"], "codeUrl": T["codeUrl"], "built": TODAY,
               "categories": ["single-family", "multifamily", "commercial", "mixed-use", "industrial", "public/open space", "planned/special"],
               "rule": "a value appears only where the city's code text was fetched and quoted; otherwise the row says why it is not determined", "codes": T["codes"]}
        for k in ("rules", "notOnFile"):
            if k in T:
                doc[k] = T[k]
        doc["quotes"] = dedupe(doc["codes"])
        json.dump(doc, open(os.path.join(OUT, "codes", ck + ".json"), "w"), separators=(",", ":"), ensure_ascii=False)
        idx["cities"][doc["jurisdiction"]] = {"key": ck, "name": T["city"], "table": "codes/" + ck + ".json", "codes": len(T["codes"])}
    names = {s["juris"]: s["jname"] for s in juris}
    for fips, sites in files.items():
        places = {j: names[j] for j in sorted({r[0] for r in sites.values()})}
        json.dump({"fips": fips, "built": TODAY, "places": places, "sources": srcs[fips], "sites": sites}, open(os.path.join(OUT, fips + ".json"), "w"), separators=(",", ":"))
    json.dump(idx, open(os.path.join(OUT, "index.json"), "w"), indent=1)
    print(stats, {k: len(v["codes"]) for k, v in tables.items()})


if __name__ == "__main__":
    main(sys.argv[1])
