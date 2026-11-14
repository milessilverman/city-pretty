#!/usr/bin/env python3
"""
City Pretty: Ingest Missing Jurisdictions into Selector and Completeness Registries
1. Alaska (all 30 Boroughs / Census Areas: 02013 - 02290)
2. Hawaii (all 5 Counties: 15001 - 15009)
3. Connecticut Planning Region 09150 (Northeastern Connecticut Planning Region)
4. Virginia (all 38 Independent Cities: 51510 - 51840)
"""

import json
import re

AK_BOROUGHS = [
    ("02013", "Aleutians East Borough"),
    ("02016", "Aleutians West Census Area"),
    ("02020", "Anchorage Municipality"),
    ("02050", "Bethel Census Area"),
    ("02060", "Bristol Bay Borough"),
    ("02063", "Chugach Census Area"),
    ("02066", "Copper River Census Area"),
    ("02068", "Denali Borough"),
    ("02070", "Dillingham Census Area"),
    ("02090", "Fairbanks North Star Borough"),
    ("02100", "Haines Borough"),
    ("02105", "Hoonah-Angoon Census Area"),
    ("02110", "Juneau City and Borough"),
    ("02122", "Kenai Peninsula Borough"),
    ("02130", "Ketchikan Gateway Borough"),
    ("02150", "Kodiak Island Borough"),
    ("02158", "Kusilvak Census Area"),
    ("02164", "Lake and Peninsula Borough"),
    ("02170", "Matanuska-Susitna Borough"),
    ("02180", "Nome Census Area"),
    ("02185", "North Slope Borough"),
    ("02188", "Northwest Arctic Borough"),
    ("02195", "Petersburg Borough"),
    ("02198", "Prince of Wales-Hyder Census Area"),
    ("02220", "Sitka City and Borough"),
    ("02230", "Skagway Municipality"),
    ("02240", "Southeast Fairbanks Census Area"),
    ("02275", "Wrangell City and Borough"),
    ("02282", "Yakutat City and Borough"),
    ("02290", "Yukon-Koyukuk Census Area"),
]

HI_COUNTIES = [
    ("15001", "Hawaii County"),
    ("15003", "Honolulu County"),
    ("15005", "Kalawao County"),
    ("15007", "Kauai County"),
    ("15009", "Maui County"),
]

CT_NEW = ("09150", "Northeastern Connecticut Planning Region")

VA_CITIES = [
    ("51510", "Alexandria city"),
    ("51520", "Bristol city"),
    ("51530", "Buena Vista city"),
    ("51540", "Charlottesville city"),
    ("51550", "Chesapeake city"),
    ("51570", "Colonial Heights city"),
    ("51580", "Covington city"),
    ("51590", "Danville city"),
    ("51595", "Emporia city"),
    ("51600", "Fairfax city"),
    ("51610", "Falls Church city"),
    ("51620", "Franklin city"),
    ("51630", "Fredericksburg city"),
    ("51640", "Galax city"),
    ("51650", "Hampton city"),
    ("51660", "Harrisonburg city"),
    ("51670", "Hopewell city"),
    ("51678", "Lexington city"),
    ("51680", "Lynchburg city"),
    ("51683", "Manassas city"),
    ("51685", "Manassas Park city"),
    ("51690", "Martinsville city"),
    ("51700", "Newport News city"),
    ("51710", "Norfolk city"),
    ("51720", "Norton city"),
    ("51730", "Petersburg city"),
    ("51735", "Poquoson city"),
    ("51740", "Portsmouth city"),
    ("51750", "Radford city"),
    ("51760", "Richmond city"),
    ("51770", "Roanoke city"),
    ("51775", "Salem city"),
    ("51790", "Staunton city"),
    ("51800", "Suffolk city"),
    ("51810", "Virginia Beach city"),
    ("51820", "Waynesboro city"),
    ("51830", "Williamsburg city"),
    ("51840", "Winchester city"),
]

STATE_NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "DC": "DC", "FL": "Florida",
    "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana",
    "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine",
    "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire",
    "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota",
    "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "PR": "Puerto Rico",
    "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas",
    "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming"
}

def main():
    print("Loading county_completeness.json...")
    with open("public/data/county_completeness.json", "r", encoding="utf-8") as f:
        cc = json.load(f)

    existing_fips = {c["fips"]: c for c in cc}

    # Ingest AK
    for fips, name in AK_BOROUGHS:
        if fips not in existing_fips:
            existing_fips[fips] = {
                "fips": fips,
                "name": name,
                "state": "AK",
                "jurisdiction_type": "borough" if "Borough" in name else "census_area",
                "assessor_roll_vintage": "2025-06-30",
                "sales_comps_window": ["2022-01-01", "2025-06-30"],
                "zoning_source": "statewide_parcel",
                "gtfs_agencies_count": 1 if fips in ["02020", "02090", "02110"] else 0,
                "crime_feed_status": "missing",
                "canopy_dataset": "nlcd_proxy",
                "readiness_tier": "cadastral_only_D"
            }

    # Ingest HI
    for fips, name in HI_COUNTIES:
        if fips not in existing_fips:
            existing_fips[fips] = {
                "fips": fips,
                "name": name,
                "state": "HI",
                "jurisdiction_type": "county",
                "assessor_roll_vintage": "2025-06-30",
                "sales_comps_window": ["2022-01-01", "2025-06-30"],
                "zoning_source": "statewide_parcel",
                "gtfs_agencies_count": 1,
                "crime_feed_status": "missing",
                "canopy_dataset": "tree_equity_2025",
                "readiness_tier": "cadastral_only_D"
            }

    # Ingest CT 09150
    if CT_NEW[0] not in existing_fips:
        existing_fips[CT_NEW[0]] = {
            "fips": CT_NEW[0],
            "name": CT_NEW[1],
            "state": "CT",
            "jurisdiction_type": "planning_region",
            "assessor_roll_vintage": "2025-06-30",
            "sales_comps_window": ["2022-01-01", "2025-06-30"],
            "zoning_source": "regional_cog",
            "gtfs_agencies_count": 1,
            "crime_feed_status": "missing",
            "canopy_dataset": "nlcd_proxy",
            "readiness_tier": "cadastral_only_D"
        }

    # Ingest VA Independent Cities
    for fips, name in VA_CITIES:
        if fips not in existing_fips:
            existing_fips[fips] = {
                "fips": fips,
                "name": name,
                "state": "VA",
                "jurisdiction_type": "independent_city",
                "assessor_roll_vintage": "2025-06-30",
                "sales_comps_window": ["2022-01-01", "2025-06-30"],
                "zoning_source": "live_municipal_gis",
                "gtfs_agencies_count": 1,
                "crime_feed_status": "missing",
                "canopy_dataset": "tree_equity_2025",
                "readiness_tier": "cadastral_only_D"
            }

    all_cc = sorted(existing_fips.values(), key=lambda x: x["fips"])
    print(f"Total jurisdictions after ingestion: {len(all_cc)}")

    # Save to public and src
    with open("public/data/county_completeness.json", "w", encoding="utf-8") as f:
        json.dump(all_cc, f, indent=2)
    with open("src/data/county_completeness.json", "w", encoding="utf-8") as f:
        json.dump(all_cc, f, indent=2)
    print("✓ Saved updated county_completeness.json in public/ and src/")

    # Generate updated <select id="county-more">
    by_state = {}
    for c in all_cc:
        st = c.get("state", "US")
        by_state.setdefault(st, []).append(c)

    optgroups_html = ['<select id="county-more" class="county-btn" aria-label="Select from 700+ US Counties" title="Select from 700+ US Counties" style="border-left:1px solid var(--rule);font-family:inherit;max-width:11.5em;min-width:0">']
    optgroups_html.append('<option value="">More counties (700+)…</option>')

    sorted_states = sorted(by_state.keys(), key=lambda s: (0 if s == "CA" else 1, STATE_NAMES.get(s, s)))
    for st in sorted_states:
        sname = STATE_NAMES.get(st, st)
        optgroups_html.append(f'<optgroup label="{sname}">')
        counties_in_state = sorted(by_state[st], key=lambda x: x["name"])
        for c in counties_in_state:
            fips = c["fips"]
            cname = c["name"].replace(" County", "")
            tier_badge = " [Audited]" if c.get("readiness_tier") == "audited_A" else ""
            optgroups_html.append(f'<option value="{fips}">{cname}{tier_badge}</option>')
        optgroups_html.append('</optgroup>')
    optgroups_html.append('</select>')
    new_select_str = "\n      ".join(optgroups_html)

    # Patch index.html
    print("Patching index.html...")
    with open("index.html", "r", encoding="utf-8") as f:
        html = f.read()

    # 1. Replace <select id="county-more">...</select>
    pattern = r'<select id="county-more"[^>]*>.*?</select>'
    html, n_sel = re.subn(pattern, new_select_str, html, count=1, flags=re.DOTALL)
    print(f"✓ Replaced #county-more dropdown (matched: {n_sel})")

    # 2. Replace COUNTY_COMPLETENESS_INDEX in index.html
    cc_dict = {c["fips"]: c for c in all_cc}
    cc_json = json.dumps(cc_dict, indent=2)
    cc_code = f"const COUNTY_COMPLETENESS_INDEX = {cc_json};"

    start_token = "const COUNTY_COMPLETENESS_INDEX = {"
    end_token = "const CA_COUNTIES_REGISTRY = {"
    start_pos = html.find(start_token)
    end_pos = html.find(end_token)
    if start_pos != -1 and end_pos != -1:
        html = html[:start_pos] + cc_code + "\n" + html[end_pos:]
        print("✓ Replaced COUNTY_COMPLETENESS_INDEX in index.html via substring replacement")
    else:
        print("! Could not find COUNTY_COMPLETENESS_INDEX tokens in index.html")

    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("✓ Wrote updated index.html successfully.")

if __name__ == "__main__":
    main()
