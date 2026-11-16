#!/usr/bin/env python3
"""
Laws / finance / funding audit — apply script (run once, 2026-11-16).

Applies the corrections and per-record `verification` blocks recorded in
docs/audit/laws-finance-audit.md to:
  app/data/statutes.json (and its byte-identical copy app/data/state-housing-laws.json)
  app/data/state_finance_profiles.json
  app/data/funding_programs.json

Every "verified" below was confirmed against a source FETCHED during the audit
session (official legislature text where reachable). Nothing here is filled
from memory. Where a source could not be reached, the record says so.
"""
import json, copy, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
D = "2026-11-16"

def V(status, method, evidence, unverified=None, notes=""):
    return {"status": status, "method": method, "checked_on": D,
            "evidence": evidence, "unverified_fields": unverified or [], "notes": notes}

CA_DB = ("California Legislative Counsel official bulk database "
         "(downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip, LAW_SECTION_TBL, read via HTTP range requests; "
         "leginfo.legislature.ca.gov itself returns 403 from the audit container)")

# ---------------------------------------------------------------- statutes
statutes = json.loads((ROOT / "app/data/statutes.json").read_text())
by_id = {s["id"]: s for s in statutes}
log = {"statutes": [], "state_finance_profiles": [], "funding_programs": []}
removed = []

def upd(sid, changes, verification, corrections):
    s = by_id[sid]
    for k, v in changes.items():
        if v is _DEL:
            s.pop(k, None)
        else:
            s[k] = v
    s["last_verified"] = D if verification["status"] in ("verified", "partially_verified") else None
    s["verification"] = verification
    log["statutes"].append({"id": sid, "status": verification["status"], "corrections": corrections})

class _D: pass
_DEL = _D()

SB79_COUNTIES = ["06001", "06037", "06059", "06067", "06073", "06075", "06081", "06085"]
SB79_URL = "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB79"
SB79_CIT = "Cal. Gov. Code §§ 65912.155–65912.162 (added by Stats. 2025, Ch. 512 (SB 79))"
SB79_EXCL = ["calfire_or_state_vhfhsz", "sea_level_rise_1ft (alternative-plan exclusion, § 65912.161)",
             "local_historic_register (≤10% of TOD zone, § 65912.161)"]
SB79_AFF = {"one_of": [{"pct": 0.07, "income": "extremely low"}, {"pct": 0.10, "income": "very low"},
                       {"pct": 0.13, "income": "lower"}],
            "exempt_if_units_at_or_below": 10, "term_years_rental": 55, "term_years_ownership": 45,
            "citation": "Gov. Code § 65912.157(i)"}

upd("ca_sb79_tier1", {
    "short_name": "CA SB 79 — Tier 1 TOD stop, within 1/4 mile",
    "statute_citation": SB79_CIT,
    "eligible_counties": SB79_COUNTIES,
    "transit_mode": "heavy_rail_or_very_high_frequency_commuter_rail_72_trains_per_day",
    "max_units_by_right": None,
    "min_allowed_density_du_per_acre": 120,
    "max_height_ft": 75,
    "max_far": 3.5,
    "affordability_mandate_pct": None,
    "affordability_options": SB79_AFF,
    "statutory_exclusions": SB79_EXCL,
    "summary": ("Housing development is an allowed use on residential, mixed or commercial sites within 1/4 mile of a "
                "Tier 1 transit-oriented development stop (heavy rail or 72+ trains/day commuter rail) in an urban transit "
                "county (>15 passenger rail stations). Local governments may not impose a height limit below 75 ft, a "
                "density cap below 120 du/acre, or standards precluding a residential FAR of 3.5 (§ 65912.157(a)(3)). "
                "Projects need at least 5 units and 30 du/acre. Applies to local agencies from July 1, 2026 "
                "(§ 65912.157(n)). The 75 ft / 120 du/ac figures are floors on local limits, not a unit cap. "
                "SB 79 does not by itself grant ministerial approval; see § 65912.159 for the streamlining path."),
}, V("verified", CA_DB + "; Gov. Code §§ 65912.156, 65912.157 read in full",
     "§ 65912.157(a)(3): 'shall not impose any height limit less than 75 feet ... any maximum density of less than 120 dwelling units per acre ... residential floor area ratio of up to 3.5'",
     ["eligible_counties (list of urban transit counties is from Wikipedia 'California Senate Bill 79', a secondary source; statute defines the test as >15 passenger rail stations)",
      "min_parking_spaces_per_unit (SB 79 itself sets none; 0 comes from AB 2097, Gov. Code § 65863.2, subject to its exceptions)"],
     "Original record cited Gov. Code § 65913.16 (a different section, amended by SB 597), included Contra Costa (06013), labelled the 120 du/acre density floor as a 120-unit by-right cap, claimed a single 10% affordability mandate, and said the law 'mandates ministerial by-right approval'. All corrected."),
  ["statute_citation 65913.16 -> 65912.155–65912.162", "removed 06013 Contra Costa", "max_units_by_right 120 -> null (density floor 120 du/ac)",
   "affordability 10% -> one of 7% ELI / 10% VLI / 13% LI, not for ≤10 units", "summary rewritten", "exclusions: removed unverified coastal/floodway, added sea-level/historic per § 65912.161"])

upd("ca_sb79_tier2", {
    "short_name": "CA SB 79 — Tier 1 TOD stop, 1/4 to 1/2 mile (city pop ≥ 35,000)",
    "statute_citation": SB79_CIT,
    "eligible_counties": SB79_COUNTIES,
    "transit_mode": "heavy_rail_or_very_high_frequency_commuter_rail_72_trains_per_day",
    "distance_to_transit_min_mi": 0.25,
    "city_population_min": 35000,
    "max_units_by_right": None,
    "min_allowed_density_du_per_acre": 100,
    "max_height_ft": 65,
    "max_far": 3,
    "affordability_mandate_pct": None,
    "affordability_options": SB79_AFF,
    "statutory_exclusions": SB79_EXCL,
    "summary": ("Between 1/4 and 1/2 mile of a Tier 1 TOD stop, in a city of at least 35,000, local governments may not "
                "impose a height limit below 65 ft, a density cap below 100 du/acre, or standards precluding FAR 3.0 "
                "(§ 65912.157(a)(4)). NOTE: the id 'ca_sb79_tier2' is historical; this record is Tier 1 at the outer "
                "ring. Statutory Tier 2 (light rail etc.) is in ca_sb79_tier2_light_rail_*."),
}, V("verified", CA_DB, "§ 65912.157(a)(4): 'height limit less than 65 feet ... less than 100 dwelling units per acre ... floor area ratio of up to 3'",
     ["eligible_counties (secondary source, see tier1)"],
     "Original record was mislabelled 'Tier 2' (statutory Tier 2 is light rail/48+ trains/BRT) and omitted the 35,000-population condition."),
  ["relabelled: is Tier 1 outer ring, not Tier 2", "added city_population_min 35000", "same citation/affordability fixes as tier1"])

for sid, dist_min, dist_max, h, dens, far, popmin, sub in [
        ("ca_sb79_tier2_light_rail_quarter", None, 0.25, 65, 100, 3, None, "(a)(5)"),
        ("ca_sb79_tier2_light_rail_half", 0.25, 0.5, 55, 80, 2.5, 35000, "(a)(6)")]:
    rec = {
        "id": sid, "state_code": "CA", "bill_number": "SB 79", "session": "2025-2026 Regular Session",
        "short_name": f"CA SB 79 — Tier 2 TOD stop (light rail / 48+ trains / qualifying BRT), {'within 1/4 mile' if dist_min is None else '1/4 to 1/2 mile (city pop ≥ 35,000)'}",
        "statute_citation": SB79_CIT, "effective_date": "2026-07-01", "statute_url": SB79_URL,
        "eligible_counties": SB79_COUNTIES, "distance_to_transit_max_mi": dist_max,
        "transit_mode": "light_rail_or_high_frequency_commuter_rail_48_trains_or_qualifying_bus",
        "max_units_by_right": None, "min_allowed_density_du_per_acre": dens, "max_height_ft": h, "max_far": far,
        "min_parking_spaces_per_unit": 0, "affordability_mandate_pct": None, "affordability_options": SB79_AFF,
        "tax_exemption_pct": 0, "statutory_exclusions": SB79_EXCL,
        "summary": f"Local governments may not impose a height limit below {h} ft, a density cap below {dens} du/acre, or standards precluding FAR {far} (§ 65912.157{sub}).",
        "last_verified": D,
        "verification": V("verified", CA_DB, f"§ 65912.157{sub}: 'height limit less than {h} feet ... less than {dens} dwelling units per acre ... floor area ratio of up to {far}'",
                          ["eligible_counties (secondary source)", "min_parking_spaces_per_unit (from AB 2097, not SB 79)"],
                          "Added in this audit from the official statute text; the original data had no true Tier 2 rows."),
    }
    if dist_min is not None:
        rec["distance_to_transit_min_mi"] = dist_min
    if popmin:
        rec["city_population_min"] = popmin
    statutes.insert([i for i, s in enumerate(statutes) if s["id"] == "ca_sb79_tier2"][0] + (1 if dist_min is None else 2), rec)
    by_id[sid] = rec
    log["statutes"].append({"id": sid, "status": "verified", "corrections": ["ADDED from official statute text"]})

upd("ca_sb9_lot_split", {
    "short_name": "CA SB 9 (California HOME Act) — two units per lot and urban lot split",
    "max_height_ft": None,
    "min_parking_spaces_per_unit": None,
    "parking_note": ("Local agency may require up to one off-street space per unit, but none where the parcel is within "
                     "one-half mile walking distance of qualifying transit or another statutory exception applies "
                     "(Gov. Code §§ 65852.21, 66411.7)."),
}, V("partially_verified", CA_DB + "; Gov. Code §§ 65852.21 and 66411.7 (current text, as amended by SB 1426 (2026))",
     "§ 66411.7: 'no more than two new parcels of approximately equal lot area ... not be smaller than 40 percent ... both newly created parcels are no smaller than 1,200 square feet'; § 65852.21: 'no more than two residential units within a single-family residential zone shall be considered ministerially'",
     ["effective_date (2022-01-01 not checked; the 2021 bill version was not retrieved)"],
     "Original max_height_ft 25 does not appear in either section and was removed. Original min_parking 0 was wrong as a general rule (up to 1/unit may be required). Short name was garbled ('Home Opportunity & Act')."),
  ["max_height_ft 25 -> null (not in statute)", "min_parking 0 -> null + corrected note", "short_name fixed"])

upd("ca_ab2097", {
    "summary": ("Prohibits public agencies from imposing minimum automobile parking requirements on residential, commercial "
                "or other development within one-half mile of public transit (a major transit stop). Cities may still impose "
                "them on some projects by written findings within 30 days, except for projects with ≥20% affordable units or "
                "fewer than 20 units (Gov. Code § 65863.2(b)–(c))."),
}, V("verified", CA_DB, "§ 65863.2(a): 'A public agency shall not impose or enforce any minimum automobile parking requirement ... within one-half mile of public transit.' History: 'Added by Stats. 2022, Ch. 459 (AB 2097) Effective January 1, 2023.'",
     [], "Summary updated to include the statutory exceptions."), ["summary: added findings exception"])

upd("fl_live_local", {
    "bill_number": "SB 102 (2023) / SB 328 (2024)",
    "short_name": "FL Live Local Act (Fla. Stat. § 166.04151(7) zoning + § 196.1978(3) exemption)",
    "statute_citation": "Fla. Stat. §§ 166.04151(7) (municipalities), 125.01055 (counties), 196.1978(3) (tax exemption)",
    "max_units_by_right": None,
    "max_far_rule": "Not below 150% of the highest currently allowed (or allowed on July 1, 2023) FAR in the municipality",
    "tax_exemption_pct": 0.75,
    "tax_exemption_note": ("§ 196.1978(3)(d)1.a: 75% of assessed value for qualifying units at >80% to ≤120% AMI; units at ≤80% AMI "
                           "are exempt under (d)1.b. § 196.1979 is a separate LOCAL-OPTION exemption for ≤60% AMI units."),
    "min_parking_spaces_per_unit": None,
    "parking_note": ("Municipality must reduce parking by 15% on request near a transit stop or other listed conditions, and must "
                     "eliminate parking for mixed-use projects in a recognized TOD area (§ 166.04151(7)(f))."),
    "summary": ("Municipalities must allow multifamily and mixed-use residential in any commercial, industrial or mixed-use zone "
                "(and on some public and religious-institution land) if at least 40% of units are affordable rentals for at least "
                "30 years; density not below the highest allowed in the municipality, FAR not below 150% of the highest allowed, "
                "height not below the tallest allowed within 1 mile or 3 stories; administrative approval required. Qualifying "
                "units may receive the § 196.1978(3) property-tax exemption."),
}, V("verified", "Official Florida Statutes (leg.state.fl.us) §§ 166.04151, 196.1978, 196.1979; flsenate.gov bill page SB 328 (2024)",
     "§ 166.04151(7)(a)1: 'if at least 40 percent of the residential units ... are rental units that, for a period of at least 30 years, are affordable'; § 196.1978(3)(d)1.a: 'Seventy-five percent of the assessed value of the units ... greater than 80 percent but not more than 120 percent'",
     ["effective_date 2024-07-01", "affordability_ami_ceiling 1.2 (depends on § 420.0004 definition, not fetched)", "§ 125.01055 county provision not fetched"],
     "Original cited § 196.1979 for the 75% exemption (wrong section), set a fabricated 0.5 parking minimum, and a 999-unit placeholder cap."),
  ["exemption citation 196.1979 -> 196.1978(3)", "min_parking 0.5 -> null (not in statute)", "max_units 999 -> null", "added FAR 150% rule"])

upd("tx_sb840", {
    "session": "89th Legislature, Regular Session (2025)",
    "statute_citation": "Tex. Loc. Gov't Code ch. 218 (§§ 218.001–218.102 and subch. C) & § 211.0011",
    "effective_date": "2025-09-01",
    "statute_url": "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=SB840",
    "short_name": "TX SB 840 (2025) — multifamily/mixed-use allowed in commercial zones",
    "commercial_or_office_only": _DEL,
    "applies_in_zoning": "Any zoning classification allowing office, commercial, retail, warehouse or mixed use (not heavy industrial; not within 1,000 ft of heavy industrial use or 3,000 ft of an airport/military base; not clear/accident-potential zones)",
    "max_units_by_right": None,
    "min_allowed_density_du_per_acre": 36,
    "density_rule": "Not more restrictive than the greater of the highest residential density allowed in the city or 36 units/acre",
    "height_rule_ft": 45,
    "height_rule": "Not more restrictive than the greater of the height allowed for office/commercial/retail/warehouse on the site or 45 ft",
    "min_parking_spaces_per_unit": None,
    "max_parking_requirement_per_unit": 1,
    "summary": ("In cities over 150,000 population located wholly or partly in a county over 300,000, cities must allow multifamily "
                "and mixed-use residential (≥65% residential) without rezoning in zones that allow office, commercial, retail, "
                "warehouse or mixed use; may not cap density below the greater of the city's highest density or 36 du/acre, "
                "height below the greater of the commercial height or 45 ft, or require more than one parking space per unit; "
                "compliant permits must be administratively approved."),
}, V("verified", "Texas Legislature Online: bill history 89(R) SB 840 and enrolled text (capitol.texas.gov/tlodocs/89R/billtext/html/SB00840F.htm)",
     "History: '06/20/2025 E Effective on 9/1/25'; § 218.002: 'applies only to a municipality with a population greater than 150,000 that is wholly or partly located in a county with a population greater than 300,000'",
     [],
     "SEVERE: original record cited 88(R) SB 840 (2023), which is 'Relating to increasing the criminal penalty for assault of certain hospital personnel' — an unrelated bill — and § 214.908. The housing law is 89(R) SB 840 (2025). It is not limited to office conversions."),
  ["session 88R -> 89R; effective 2023-09-01 -> 2025-09-01", "citation 214.908 -> ch. 218", "scope widened from office-only to commercial/retail/warehouse/mixed-use zones", "parking: is a cap of 1, not a minimum of 1"])

upd("wa_hb1110", {
    "rules": [
        {"pop_min": 75000, "base_units": 4, "near_transit_or_affordable_units": 6,
         "note": "6 within 1/4-mile walking distance of a major transit stop, or if at least 2 units are affordable"},
        {"pop_min": 25000, "pop_max_exclusive": 75000, "base_units": 2, "near_transit_or_affordable_units": 4,
         "note": "4 within 1/4-mile walking distance of a major transit stop, or if at least 1 unit is affordable"},
        {"pop_min": 0, "pop_max_exclusive": 25000, "base_units": 2, "near_transit_or_affordable_units": 2,
         "condition": "Only cities within a contiguous urban growth area with the largest city in a county of more than 275,000"}],
    "max_height_ft": None,
    "min_parking_spaces_per_unit": None,
    "parking_note": ("No off-street parking may be required for middle housing within 1/2-mile walking distance of a major transit "
                     "stop; otherwise at most 1 space/unit on lots ≤6,000 sq ft and 2 spaces/unit on larger lots (RCW 36.70A.635(6))."),
}, V("verified", "Washington Legislature: RCW 36.70A.635 (app.leg.wa.gov) and bill summary HB 1110 (2023)",
     "RCW 36.70A.635(1)(b): 'at least four units per lot ... at least six units per lot ... within one-quarter mile walking distance of a major transit stop'; bill page: 'Governor signed. Chapter 332, 2023 Laws. Effective date 7/23/2023.'",
     [], "Original max_height_ft 35 not found in the statute; removed. The <25,000 rule lacked its UGA condition. min_parking 0 was only true near major transit."),
  ["max_height_ft 35 -> null", "added UGA condition to small-city rule", "parking corrected"])

upd("or_hb2001", {
    "statute_citation": "ORS 197A.420 (formerly ORS 197.758; HB 2001 (2019))",
    "statute_url": "https://www.oregonlegislature.gov/bills_laws/ors/ors197A.html",
    "rules": [
        {"pop_min": 25000, "allowed": "all middle housing types (duplex, triplex, quadplex, cottage cluster, townhouse) on each lot zoned for residential use; also each county and each city ≥1,000 within Metro"},
        {"pop_min": 2500, "pop_max_exclusive": 25000, "allowed": "a duplex on each lot zoned for residential use (cities not within Metro)"}],
    "min_parking_spaces_per_unit": None,
    "summary": ("Oregon cities of 25,000+ (and Metro-area cities of 1,000+, and counties) must allow all middle housing types on "
                "residential lots inside urban growth boundaries; cities of 2,500–25,000 outside Metro must allow duplexes."),
}, V("verified", "Official ORS chapter 197A (oregonlegislature.gov/bills_laws/ors/ors197A.html)",
     "ORS 197A.420(2)–(3): 'each city with a population of 25,000 or greater, and each city with a population of 1,000 or greater within Metro, shall allow the development of all middle housing types ... Each city not within Metro with a population of 2,500 or greater and less than 25,000 shall allow the development of a duplex'",
     ["effective_date 2020-01-01"], "Original cited the renumbered ORS 197.758 and a 10,000 duplex threshold; current law is 2,500. min_parking 0 not found in statute."),
  ["citation 197.758 -> 197A.420", "duplex threshold 10,000 -> 2,500", "min_parking 0 -> null"])

upd("az_hb2720_2721", {
    "statute_citation": "A.R.S. § 9-461.18 (HB 2720, Laws 2024 ch. 196, ADUs); Laws 2024 ch. 197 (HB 2721) adding § 9-462.10 as enacted (middle housing)",
    "statute_url": "https://www.azleg.gov/legtext/56leg/2R/laws/0197.pdf",
    "max_units_by_right": 4,
    "max_height_ft": None,
    "height_rule": "Municipality may not restrict middle housing to less than two floors or FAR below 50%",
    "min_parking_spaces_per_unit": None,
    "max_parking_requirement_per_unit": 1,
    "summary": ("Municipalities over 75,000 must allow at least one attached and one detached ADU on any lot where a single-family "
                "home is allowed, with no added parking (A.R.S. § 9-461.18). Municipalities of 75,000+ must, by January 1, 2026, "
                "allow duplexes, triplexes, fourplexes and townhomes on all single-family lots within one mile of the central "
                "business district and on at least 20% of new developments over 10 contiguous acres, requiring no more than one "
                "parking space per unit (Laws 2024 ch. 197)."),
}, V("verified", "Arizona Legislature: chaptered session laws 2024 ch. 196 and ch. 197 (azleg.gov/legtext/56leg/2R/laws/0196.pdf, 0197.pdf) and current A.R.S. § 9-461.18",
     "Ch. 197: 'ON OR BEFORE JANUARY 1, 2026, A MUNICIPALITY WITH A POPULATION OF SEVENTY-FIVE THOUSAND PERSONS OR MORE MUST AUTHORIZE ... DUPLEXES, TRIPLEXES, FOURPLEXES AND TOWNHOMES ... WITHIN ONE MILE OF THE MUNICIPALITY'S CENTRAL BUSINESS DISTRICT'",
     ["effective_date 2024-09-14", "current codified section number for the HB 2721 text (the current online § 9-462.10 contains a different, commercial adaptive-reuse provision)"],
     "Original cited A.R.S. §§ 9-467.04 and 9-467.05, which do not exist (azleg.gov 404). max_height_ft 30 was not in the law. Parking value is a cap, not a minimum."),
  ["citation 9-467.04/05 (nonexistent) -> 9-461.18 + Laws 2024 ch. 197", "max_height_ft 30 -> null", "parking reframed as cap of 1"])

upd("tx_austin_home", {
    "bill_number": "Ordinances 20231207-001 (Phase 1) & 20240516-006 (Phase 2)",
    "statute_citation": "Austin Ordinances No. 20231207-001 and No. 20240516-006 (Land Development Code amendments)",
    "statute_url": "https://www.austintexas.gov/development-services/home-amendments",
    "min_lot_size_sqft": 1800,
    "min_parking_spaces_per_unit": None,
    "summary": ("HOME Phase 1 (adopted Dec. 7, 2023) allows up to three housing units on SF-1, SF-2 and SF-3 lots. HOME Phase 2 "
                "(adopted May 16, 2024) creates 'small lot single-family residential use' allowing one unit on lots of at least "
                "1,800 sq ft (standard minimum is 5,750 sq ft)."),
}, V("verified", "City of Austin Development Services 'HOME Amendments' page (austintexas.gov/development-services/home-amendments)",
     "'Allow up to three housing units, including tiny homes, on a Single-Family (SF) zoned property (SF-1, SF-2, SF-3)'; 'one unit on lots of at least 1,800 square feet but less than 5,750 square feet'; 'Ordinance 20240516-006 - Phase 2 HOME Amendments adopted ordinance'",
     ["min_parking_spaces_per_unit (Austin's parking-minimum repeal is a separate action, not checked)"],
     "Original had the wrong Phase 2 ordinance number (-004) and wrong minimum lot size (1,500 sq ft)."),
  ["ordinance 20240516-004 -> 20240516-006", "min lot 1,500 -> 1,800 sq ft", "parking 0 -> null (unchecked)"])

# REMOVE tx_adu_statute: SB 1412 (88R) never became law
statutes = [s for s in statutes if s["id"] != "tx_adu_statute"]
removed.append({"id": "tx_adu_statute", "reason": "88(R) SB 1412 'Relating to regulation of accessory dwelling units by political subdivisions' — Last Action '05/22/2023 H Failed to pass to 3rd reading' (capitol.texas.gov). It never became law; the cited Tex. Loc. Gov't Code § 214.909 could not be confirmed."})
log["statutes"].append({"id": "tx_adu_statute", "status": "removed", "corrections": ["REMOVED: bill failed in 2023; not law"]})

upd("co_hb24_1313", {
    "statute_citation": "HB 24-1313 (Colo. 2024); C.R.S. section numbers not confirmed",
    "municipality_types": "Local governments within an MPO with population ≥4,000 and ≥75 acres of transit-related areas (plus certain county areas)",
    "min_average_density_units_per_acre": None,
    "housing_opportunity_goal_du_per_acre": 40,
    "min_parking_spaces_per_unit": None,
    "summary": ("Requires 'transit-oriented communities' to meet a housing opportunity goal: zoning CAPACITY equal to an average "
                "40 dwelling units/acre times the acres of transit-related areas, mainly via 'transit centers' that uniformly allow "
                "at least 15 units/acre net and have administrative approval for multifamily on parcels ≤5 acres. It is a "
                "zoning-capacity goal, not a by-right density on every parcel, and the act does not itself abolish parking minimums."),
}, V("verified", "Colorado General Assembly bill page leg.colorado.gov/bills/hb24-1313 (bill summary and history)",
     "'A housing opportunity goal is a zoning capacity goal determined based on an average zoned housing density of 40 dwelling units per acre multiplied by the number of acres of transit-related areas'; history '05/13/2024 Governor Signed'",
     ["effective_date 2024-06-05", "statute_citation (C.R.S. § 29-35-101 et seq. not confirmed)", "number of covered municipalities"],
     "Original summary claimed '31 municipalities', a by-right 40 du/acre minimum and parking-mandate elimination — none supported by the bill summary."),
  ["summary rewritten: capacity goal, not by-right", "removed parking-elimination claim", "removed '31 municipalities'"])

upd("co_hb24_1152", {
    "statute_citation": "HB 24-1152 (Colo. 2024); C.R.S. section numbers not confirmed",
    "effective_date": "2024-05-13",
    "min_parking_spaces_per_unit": None,
    "summary": ("Subject jurisdictions (municipalities of ≥1,000 in an MPO, and county areas in census-designated places of "
                "≥40,000 in an MPO) must, from June 30, 2025, allow one ADU as an accessory use to a single-unit detached "
                "dwelling wherever such dwellings are allowed, through administrative approval."),
}, V("partially_verified", "Colorado General Assembly bill page leg.colorado.gov/bills/hb24-1152",
     "'requires a subject jurisdiction, on or after June 30, 2025, to allow, subject to an administrative approval process, one accessory dwelling unit'; '05/13/2024 Governor Signed'",
     ["min_parking_spaces_per_unit (parking provisions not in the summary; not checked against bill text)", "statute_citation"],
     "effective_date field holds the signature date (05/13/2024); the operative requirement starts June 30, 2025."),
  ["parking 0 -> null (unchecked)", "summary rewritten to bill summary"])

upd("mn_minneapolis_2040", {"min_parking_spaces_per_unit": None},
    V("could_not_check", "minneapolis2040.com housing topic page (reachable, no ordinance text); Wikipedia 'Single-family zoning' (secondary)",
      "Wikipedia: 'In 2018, Minneapolis implemented the Minneapolis 2040 Plan, which fully eliminated single-family zoning citywide.'",
      ["max_units_by_right 3", "min_parking 0 (citywide parking-minimum repeal)", "statute_citation (Code § 546; 'Minn. Laws 2024 c. 115')", "effective_date"],
      "No primary zoning-code text was reachable."), ["parking 0 -> null (unchecked)"])

upd("mt_sb323", {"statute_url": "https://leg.mt.gov/bills/mca/title_0760/chapter_0020/part_0030/section_0040/0760-0020-0030-0040.html"},
    V("partially_verified", "Montana Code Annotated § 76-2-304 (leg.mt.gov)",
      "§ 76-2-304(3): 'In a city with a population of at least 5,000 residents, duplex housing must be allowed as a permitted use on a lot where a single-family residence is a permitted use'",
      ["bill_number SB 323 (statute history lists Ch. 445 and Ch. 499, L. 2023; mapping to SB 323 not confirmed)", "effective_date 2024-01-01"],
      "Original statute_url (leg.mt.gov/bills/2023/billhtml/SB0323.htm) returns 404."), ["statute_url replaced (old URL 404)"])

upd("me_ld2003", {
    "statute_citation": "30-A M.R.S. § 4364-A (created by PL 2021, c. 672, § 5; amended through PL 2025, c. 733) & § 4364-B (ADUs)",
    "statute_url": "https://legislature.maine.gov/statutes/30-A/title30-Asec4364-A-2.html",
    "rules": [{"area": "Designated growth area, or served by public water and public sewer", "max_units_by_right": 4},
              {"area": "Any other area where residential use is allowed", "max_units_by_right": 3}],
    "min_parking_spaces_per_unit": None,
    "summary": ("Maine municipalities must allow at least 3 dwelling units per lot (inclusive of ADUs) wherever housing is allowed, "
                "and at least 4 per lot in designated growth areas or on lots served by public water and sewer (current text, as "
                "amended in 2025)."),
}, V("verified", "Maine Revisor of Statutes, 30-A M.R.S. § 4364-A and § 4364-B (legislature.maine.gov/statutes)",
     "§ 4364-A(1): 'At least 3 dwelling units ... per lot; and B. At least 4 dwelling units ... if the lot is located in a designated growth area ... or ... served by ... a public sewer system'; history 'PL 2021, c. 672, §5 (NEW)'",
     ["effective_date 2024-01-01", "min_parking (§ 4364-F not read)", "bill number LD 2003 (statute history gives PL 2021 c. 672, not the LD number)"],
     "Original rule (2 outside growth areas) reflects the pre-2025 law; current statute is 3. Section is marked '(CONFLICT)' between two 2025 chapters; both versions give 3/4."),
  ["2 -> 3 units outside growth areas (current law)", "statute_url fixed (old URL returned 'no information')", "parking 0 -> null"])

upd("vt_act47", {
    "statute_citation": "24 V.S.A. § 4412(1)(D) & (12); § 4414 (parking); 2023, No. 47, § 2, eff. July 1, 2023",
    "statute_url": "https://legislature.vermont.gov/statutes/section/24/117/04412",
    "min_density_units_per_acre_where_sewer_water": 5,
    "max_parking_requirement_per_unit": 1,
    "summary": ("Duplexes must be a permitted use, with no stricter dimensional standards than a single-unit dwelling, in any district "
                "allowing year-round residential use; areas served by municipal sewer and water must allow at least five dwelling "
                "units per acre; in such districts a municipality may not require more than one parking space per unit."),
}, V("verified", "Vermont Statutes Online 24 V.S.A. §§ 4412, 4414 (legislature.vermont.gov/statutes)",
     "§ 4412(12): 'bylaws shall establish lot and building dimensional standards that allow five or more dwelling units per acre'; § 4414: 'a municipality shall not require more than one parking space per dwelling unit'; history '2023, No. 47, § 2, eff. July 1, 2023'",
     [], "Citation corrected from (1)(E) to (1)(D)/(12). The current text also contains a future (eff. Jan 1, 2028) version allowing up to 4 units in sewer/water districts."),
  ["citation (1)(E) -> (1)(D), (12), § 4414"])

by_id["ma_mbta_communities"]["summary"] = ("Requires each MBTA community to have at least one zoning district of reasonable size where "
    "multi-family housing is permitted as of right, without age restrictions and suitable for families with children, with a "
    "minimum gross density of 15 units per acre, located not more than 0.5 miles from a commuter rail station, subway station, "
    "ferry terminal or bus station, if applicable.")
upd("ma_mbta_communities", {"min_parking_spaces_per_unit": None,
                            "statute_url": "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVII/Chapter40A/Section3A"},
    V("verified", "Massachusetts General Laws ch. 40A § 3A (malegislature.gov)",
      "'(i) have a minimum gross density of 15 units per acre ... and (ii) be located not more than 0.5 miles from a commuter rail station, subway station, ferry terminal or bus station, if applicable'",
      ["effective_date 2021-01-14", "number of covered municipalities (177; mass.gov returned 403)"],
      "Removed unverified '177 municipalities' from summary and the parking-0 value (not in § 3A)."),
    ["summary: removed '177' count", "parking 0 -> null"])

upd("nc_raleigh_missing_middle", {},
    V("could_not_check", "raleighnc.gov returned 403 from the audit container; no alternate source reached", "",
      ["all fields"], ""), [])

ut = by_id["ut_sb174"]
ut.update({
    "id": "ut_hb82_iadu",
    "bill_number": "HB 82 (2021)",
    "short_name": "Utah HB 82 (2021) — internal accessory dwelling units",
    "statute_citation": "Utah Code § 10-9a-530 (municipalities) & § 17-27a-526 (counties), enacted by HB 82 (2021)",
    "effective_date": "2021-05-05",
    "statute_url": "https://le.utah.gov/~2021/bills/static/HB0082.html",
    "summary": "Requires municipalities and counties to classify internal accessory dwelling units within owner-occupied single-family homes as a permitted use in zones allowing single-family homes (with listed exceptions).",
})
by_id["ut_hb82_iadu"] = ut
upd("ut_hb82_iadu", {},
    V("partially_verified", "Utah Legislature: HB 82 (2021) status page and enrolled text (le.utah.gov)",
      "Status: '16 Mar 2021, Governor Signed'; enrolled text: 'ENACTS: 10-9a-530 ... 17-27a-526'; '(1) Except as provided in Subsection (2), this bill takes effect on May 5, 2021.'",
      ["max_units_by_right 2", "owner-occupancy and lot-size conditions (summary paraphrase not checked clause-by-clause)"],
      "SEVERE: original record cited Utah SB 174 (2021), which is 'Driver License Document Requirements' — unrelated. Also cited 'HB 465' and § 10-9a-403 and a commuter-rail incentive, none of which were confirmed; removed."),
    ["id ut_sb174 -> ut_hb82_iadu", "bill SB 174 (driver licenses) -> HB 82 (2021)", "removed unconfirmed HB 465 / § 10-9a-403 / rail claims"])

# fix log entry id for ut
for e in log["statutes"]:
    if e["id"] == "ut_hb82_iadu":
        e["previous_id"] = "ut_sb174"

out = json.dumps(statutes, indent=2, ensure_ascii=False)
(ROOT / "app/data/statutes.json").write_text(out)
(ROOT / "app/data/state-housing-laws.json").write_text(out)

# ---------------------------------------------------------------- finance profiles
fp_path = ROOT / "app/data/state_finance_profiles.json"
fp = json.loads(fp_path.read_text())
urlcheck = json.loads((ROOT / "docs/audit/laws-finance-urlcheck.json").read_text())
UNSOURCED = ["rsmeans_cost_multiplier (RSMeans is a proprietary index; no source given; value unverified)",
             "tree_capital_cost_usd (no source given)", "climate_energy_regime (no source given)",
             "non_pledgeable_share (no source given)"]

FIN = {
 "CA": ({}, V("partially_verified", CA_DB + "; Rev. & Tax. Code §§ 51, 218, 401; Gov. Code § 53398.50",
        "RTC § 51: 'In no event shall the percentage increase ... exceed 2 percent of the prior year's value'; RTC § 218: 'seven thousand dollars ($7,000)'; RTC § 401: 'assess all property ... at its full value'",
        ["uncaps_on_sale (RTC § 110.1 change-of-ownership not read)", "reassessment_cycle_years"] + UNSOURCED, ""), []),
 "TX": ({"annual_assessment_cap": 0.10},
        V("partially_verified", "Texas Tax Code §§ 23.23, 23.231, 11.13 via texas.public.law mirror; 89(R) SB 4 enrolled text and history (capitol.texas.gov)",
          "§ 23.23: appraised value of a residence homestead limited to prior value plus '10 percent'; § 23.231: 20% circuit breaker for other property, 'This section expires December 31, 2026'",
          ["homestead_exemption_rule amount: § 11.13(b) mirror shows $100,000; 89(R) SB 4 raises it to $140,000 only if SJR 2 was approved by voters (Nov 2025) — approval not confirmed in this audit", "uncaps_on_sale", "reassessment_cycle_years"] + UNSOURCED,
          "annual_assessment_cap corrected from null to 0.10: the record's own citation names the § 23.23 10% homestead cap but stored 'no cap'. The cap applies to residence homesteads only."),
        ["annual_assessment_cap null -> 0.10 (residence homestead, § 23.23)"]),
 "FL": ({}, V("partially_verified", "Official Florida Statutes §§ 193.155, 196.031, 163.387 (leg.state.fl.us)",
        "§ 193.155: change 'shall not exceed the lower of ... Three percent ... or ... Consumer Price Index'; § 196.031: $25,000 exemption plus 'additional exemption of up to $25,000 on the assessed valuation greater than $50,000 for all levies other than school district levies'",
        ["homestead $50,000 applies in full only to non-school levies", "reassessment_cycle_years", "uncaps_on_sale"] + UNSOURCED, "Cap is the lower of 3% or CPI."), []),
 "WA": ({}, V("partially_verified", "RCW 84.55.010 (app.leg.wa.gov) read; RCW 84.41.030 page returned only site chrome",
        "RCW 84.55 is a levy (revenue) limit, not an assessed-value cap — consistent with annual_assessment_cap = null",
        ["reassessment_cycle_years (RCW 84.41.030 text not retrieved)", "homestead_exemption_rule 'none' (senior/disabled exemptions exist but were not checked)"] + UNSOURCED, ""), []),
 "OR": ({"statutory_citation": "Or. Const. art. XI, § 11 (Measure 50); ORS 308.146 (3% MAV growth); ORS ch. 457 (urban renewal)"},
        V("partially_verified", "ORS 308.146 via oregon.public.law mirror",
          "ORS 308.146(1): 'The maximum assessed value of property equals 103 percent of the property's assessed value from the prior year'",
          ["res_assessment_ratio / comm_assessment_ratio 0.65 (no source; Measure 50 uses MAV vs. RMV, not a fixed ratio)", "uncaps_on_sale"] + UNSOURCED, ""), []),
 "AZ": ({"comm_assessment_ratio": 0.155},
        V("verified", "Arizona Revised Statutes §§ 42-13301, 42-15001, 42-15003 (azleg.gov)",
          "§ 42-13301: LPV is prior LPV 'plus five per cent'; § 42-15003: class three 'ten per cent'; § 42-15001(16): class one 'Fifteen and one-half percent beginning from and after December 31, 2025 through December 31, 2026'",
          ["uncaps_on_sale false", "homestead_exemption_rule"] + UNSOURCED,
          "comm_assessment_ratio corrected 0.165 -> 0.155 for tax year 2026 (0.165 was the 2024 rate; 2025 was 0.16)."),
        ["comm_assessment_ratio 0.165 -> 0.155 (TY2026)"]),
 "CO": ({"comm_assessment_ratio": 0.25,
         "statutory_citation": "Colo. Const. art. X, § 3; SB 24-233 and HB 24B-1001 (2024) assessment-rate changes"},
        V("partially_verified", "Colorado General Assembly bill summaries SB 24-233 and HB 24B-1001 (leg.colorado.gov)",
          "HB 24B-1001: 'For the property tax year commencing on January 1, 2026, the valuation for commercial property and agricultural property is 25%'; residential local-levy rate from 2026: '6.7% of the amount equal to the actual value ... minus the lesser of 10% ... $70,000'; school levies 6.95%",
          ["res_assessment_ratio 0.067 is the local-government rate after a value deduction; school-district levies use 6.95% — model uses one number", "reassessment_cycle_years 2", "uncaps_on_sale"] + UNSOURCED,
          "comm_assessment_ratio corrected 0.279 -> 0.25 (2026). SB 24-233 is a property-tax relief bill, not the source of biennial reassessment as the old citation implied."),
        ["comm_assessment_ratio 0.279 -> 0.25 (TY2026)", "citation updated"]),
 "NC": ({"reassessment_cycle_years": 8},
        V("partially_verified", "N.C. Gen. Stat. § 105-286 (ncleg.gov)",
          "§ 105-286(a): reappraisal in the scheduled year 'and every eighth year thereafter, unless the county is required to advance the date ... or chooses to advance the date'",
          ["res/comm ratio 1.0", "uncaps_on_sale", "homestead_exemption_rule"] + UNSOURCED,
          "reassessment_cycle_years corrected 4 -> 8 (statutory default; many counties advance to shorter cycles). The record's own citation said 'Octennial'."),
        ["reassessment_cycle_years 4 -> 8 (statutory maximum)"]),
 "IL": ({}, V("could_not_check", "ilga.gov unreachable from the audit container (connection failed)", "",
        ["all statutory fields"] + UNSOURCED, ""), []),
 "GA": ({}, V("could_not_check", "law.justia.com returned 403; no alternate official Georgia code source reached", "",
        ["all statutory fields"] + UNSOURCED, ""), []),
}
for st, prof in fp.items():
    u = urlcheck.get(st, {})
    if st in FIN:
        changes, ver, corr = FIN[st]
        prof.update(changes)
    else:
        ver = V("unverified", f"Not checked in this audit beyond a reachability test of source_url (HTTP {u.get('http')})", "",
                ["all statutory fields"] + UNSOURCED,
                "Only the 10 featured states were checked against statute text. Treat every number in this profile as unverified.")
        corr = []
    if ver["status"] in ("verified", "partially_verified"):
        prof["last_verified"] = D
    else:
        prof["last_verified"] = None
        prof["verified_by"] = None
    prof["verification"] = ver
    log["state_finance_profiles"].append({"state": st, "status": ver["status"], "source_url_http": u.get("http"), "corrections": corr})
fp_path.write_text(json.dumps(fp, indent=2, ensure_ascii=False))

# ---------------------------------------------------------------- funding programs
fpg_path = ROOT / "app/data/funding_programs.json"
fpg = json.loads(fpg_path.read_text())
F = {p["id"]: p for p in fpg}
def fupd(pid, changes, ver, corr):
    p = F[pid]; p.update(changes); p["verification"] = ver
    p["last_verified"] = D if ver["status"] in ("verified", "partially_verified") else None
    log["funding_programs"].append({"id": pid, "status": ver["status"], "corrections": corr})

fupd("la_measure_w", {}, V("could_not_check", "safecleanwaterla.org returned 403", "",
     ["funding_share_pct", "40% municipal return", "statutory_citation", "cycle_dates"], ""), [])
fupd("la_prop_k", {}, V("could_not_check", "eng.lacity.gov unreachable from the audit container", "",
     ["funding_share_pct 0.8", "'$1,000,000+' grant size", "statutory_citation (Ordinance 171215)", "cycle_dates"],
     "funding_share_pct 0.8 and grant size have no stated source."), [])
fupd("ca_urban_greening", {"statutory_citation": None},
     V("could_not_check", CA_DB + "; resources.ca.gov returned 403",
       "Public Resources Code § 75114 does not exist in the official CA code database (no LAW_SECTION_TBL row).",
       ["all program fields"], "Original citation 'Cal. Pub. Res. Code § 75114 (SB 859)' is not a real section; set to null."),
     ["statutory_citation PRC § 75114 (nonexistent) -> null"])
fupd("calfire_urban_forestry", {
        "statutory_citation": "Cal. Pub. Res. Code § 4799.06 et seq. (California Urban Forestry Act of 1978); grants under § 4799.12",
        "funding_share_pct": 0.9,
        "funding_share_description": "Statute: grants of 25 to 90 percent of project costs; the director may waive cost sharing for projects in disadvantaged and low-income communities (PRC § 4799.12)."},
     V("partially_verified", CA_DB + "; PRC §§ 4799.06, 4799.12. fire.ca.gov returned 403",
       "§ 4799.12: 'may make grants to provide assistance of 25 to 90 percent of costs ... may waive the cost sharing requirement for projects that are in disadvantaged and low-income communities'",
       ["how_to_apply", "cycle_dates", "current program guidelines"],
       "Original '100% for DAC; up to 75% for non-DAC' contradicts the statute (25–90%, waivable)."),
     ["funding share corrected to statutory 25–90%, waivable for DAC"])
fupd("tx_tirz_ch311", {"funding_share_pct": None,
        "funding_share_description": "Each participating taxing unit's share of tax increment and term are set by agreement or order (Tex. Tax Code § 311.013); no statutory 50–100% range was confirmed."},
     V("partially_verified", "Texas Comptroller Ch. 311 program page; Tax Code § 311.013 via texas.public.law mirror",
       "§ 311.013: the agreement 'must specify the portion of the tax increment to be paid into the fund and the years for which that tax increment is to be paid'",
       ["20–30 year term", "how_to_apply (§ 311.005)"], "Original '50% to 100%' pledge range unconfirmed; funding_share_pct 1 removed."),
     ["funding_share_pct 1 -> null; description corrected to § 311.013"])
fupd("fl_cra_ch163", {"funding_share_description": "Increment equal to 95% of the difference between current and base-year ad valorem taxes of each taxing authority (excluding debt-service millage); a governing body may set a lower share but not below 50% (Fla. Stat. § 163.387(1)(a))."},
     V("verified", "Official Florida Statutes § 163.387 (leg.state.fl.us)",
       "§ 163.387(1)(a): 'that amount equal to 95 percent of the difference between ... ' and 'in no event shall such amount be less than 50 percent'",
       ["administering_agency (role of FL Dept. of Economic Opportunity / Commerce)", "cycle_dates", "source_url floridacra.org unreachable"], ""), ["description: added 50% floor"])
fupd("fl_live_local_tax_exemption", {
        "program_name": "Florida Live Local Act multifamily affordable-housing property tax exemption",
        "statutory_citation": "Fla. Stat. § 196.1978(3)",
        "funding_share_description": "Exempts 75% of the assessed value of qualifying units for households at >80% to ≤120% AMI; qualifying units at ≤80% AMI are exempt under § 196.1978(3)(d)1.b. (§ 196.1979 is a separate local-option exemption.)",
        "how_to_apply": "Form DR-504AFH filed with the county property appraiser (Florida DOR lists DR-504AFH for § 196.1978)"},
     V("partially_verified", "Official Florida Statutes §§ 196.1978, 196.1979; Florida DOR exemption forms page",
       "§ 196.1978(3)(d)1.a: 'Seventy-five percent of the assessed value of the units ... greater than 80 percent but not more than 120 percent'; DOR: 'DR-504AFH ... Multifamily Project and Affordable Housing Property ... (section 196.1978, F.S.)'",
       ["eligible_improvements wording (project-size and new-construction conditions not checked)", "cycle_dates March 1 deadline"],
       "Original cited § 196.1979 (wrong section) and form 'DR-504AF' (wrong form)."),
     ["citation 196.1979 -> 196.1978(3)", "form DR-504AF -> DR-504AFH"])
fupd("co_ura_tif", {}, V("could_not_check", "C.R.S. § 31-25-107 text not reached; source_url coloradoworks.org returned an error page", "",
     ["funding_share_pct", "25-year term", "eligible_improvements (the HB 24-1313 '40+ units/acre' reference mischaracterises that act as a density mandate)"], ""), [])
fupd("il_transit_tif", {}, V("could_not_check", "ilga.gov unreachable; source_url chicago.gov page returns 404", "",
     ["all fields", "35-year term", "0.5-mile corridor"], "source_url is dead (HTTP 404)."), [])
fupd("az_gplet", {},
     V("partially_verified", "A.R.S. § 42-6209 (azleg.gov)",
       "§ 42-6209(A): 'may abate the tax ... ending eight years after the certificate of occupancy is issued ... located in a single central business district'; property value increase 'at least one hundred percent'",
       ["'followed by reduced excise tax rates'", "list of cities", "source_url phoenix.gov returns 404"], "Abatement is of the GPLET excise tax, limited to a single CBD."), [])
fupd("federal_fra_intercity_grant", {},
     V("verified", "49 U.S.C. § 24911 via Cornell LII (reproduces U.S. Code); railroads.dot.gov returned 403",
       "§ 24911(f)(2): 'The Federal share of total costs for a project under this section shall not exceed 80 percent, except as specified under paragraph (4)'; amended by Pub. L. 117-58 § 22307",
       ["cycle_dates (annual NOFO)", "example corridors in eligible_improvements are illustrative, not FRA-designated"], ""), [])
fpg_path.write_text(json.dumps(fpg, indent=2, ensure_ascii=False))

log["removed"] = removed
(ROOT / "docs/audit/laws-finance-audit.json").write_text(json.dumps(log, indent=1, ensure_ascii=False) + "\n")
print("done")
