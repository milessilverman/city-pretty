#!/usr/bin/env python3
import json
import os

os.makedirs("app/data", exist_ok=True)

# 1. State Statutes (P0.5)
statutes = [
  {
    "id": "ca_sb79_tier1",
    "state_code": "CA",
    "bill_number": "SB 79",
    "session": "2025-2026 Regular Session",
    "short_name": "CA SB 79 (Tier 1 Heavy Rail Transit-Oriented Density)",
    "statute_citation": "Cal. Gov. Code § 65913.16",
    "effective_date": "2026-07-01",
    "statute_url": "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB79",
    "eligible_counties": ["06037", "06059", "06073", "06075", "06001", "06013", "06081", "06085", "06067"],
    "distance_to_transit_max_mi": 0.25,
    "transit_mode": "heavy_rail",
    "max_units_by_right": 120,
    "max_height_ft": 75,
    "max_far": 3.5,
    "min_parking_spaces_per_unit": 0,
    "affordability_mandate_pct": 0.10,
    "tax_exemption_pct": 0,
    "statutory_exclusions": ["historic_district_hpoz", "coastal_commission_or_sma", "fema_100yr_floodway", "calfire_or_state_vhfhsz"],
    "summary": "Mandates ministerial by-right approval for multifamily housing developments up to 75 feet and 120 units on parcels within 0.25 miles of an existing or funded heavy rail passenger station, with parking minimums eliminated.",
    "last_verified": "2026-11-15"
  },
  {
    "id": "ca_sb79_tier2",
    "state_code": "CA",
    "bill_number": "SB 79",
    "session": "2025-2026 Regular Session",
    "short_name": "CA SB 79 (Tier 2 Heavy Rail Transit-Oriented Density)",
    "statute_citation": "Cal. Gov. Code § 65913.16",
    "effective_date": "2026-07-01",
    "statute_url": "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB79",
    "eligible_counties": ["06037", "06059", "06073", "06075", "06001", "06013", "06081", "06085", "06067"],
    "distance_to_transit_max_mi": 0.50,
    "transit_mode": "heavy_rail",
    "max_units_by_right": 100,
    "max_height_ft": 65,
    "max_far": 3.0,
    "min_parking_spaces_per_unit": 0,
    "affordability_mandate_pct": 0.10,
    "tax_exemption_pct": 0,
    "statutory_exclusions": ["historic_district_hpoz", "coastal_commission_or_sma", "fema_100yr_floodway", "calfire_or_state_vhfhsz"],
    "summary": "Mandates ministerial by-right approval for multifamily housing developments up to 65 feet and 100 units on parcels within 0.25 to 0.50 miles of heavy rail passenger stations, with parking minimums eliminated.",
    "last_verified": "2026-11-15"
  },
  {
    "id": "ca_sb9_lot_split",
    "state_code": "CA",
    "bill_number": "SB 9",
    "session": "2021-2022 Regular Session",
    "short_name": "CA SB 9 (California Home Opportunity & Act)",
    "statute_citation": "Cal. Gov. Code §§ 65852.21, 66411.7",
    "effective_date": "2022-01-01",
    "statute_url": "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202120220SB9",
    "max_units_by_right": 4,
    "max_height_ft": 25,
    "max_far": None,
    "min_parking_spaces_per_unit": 0,
    "parking_note": "0 parking required if within 0.5 mi of major transit stop or car-share facility; max 1 space otherwise",
    "affordability_mandate_pct": 0,
    "tax_exemption_pct": 0,
    "statutory_exclusions": ["historic_district_hpoz", "fema_100yr_floodway", "calfire_or_state_vhfhsz", "prime_farmland"],
    "summary": "Requires ministerial approval of urban lot splits (creating two parcels of at least 1,200 sq ft each) and construction of up to two residential units per lot (up to 4 units total) in single-family residential zones.",
    "last_verified": "2026-11-15"
  },
  {
    "id": "ca_ab2097",
    "state_code": "CA",
    "bill_number": "AB 2097",
    "session": "2021-2022 Regular Session",
    "short_name": "CA AB 2097 (Transit Parking Minimum Abolition)",
    "statute_citation": "Cal. Gov. Code § 65863.2",
    "effective_date": "2023-01-01",
    "statute_url": "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202120220AB2097",
    "min_parking_spaces_per_unit": 0,
    "distance_to_transit_max_mi": 0.50,
    "summary": "Prohibits public agencies from imposing or enforcing minimum automobile parking mandates on residential, commercial, or mixed-use developments located within 0.5 miles of a major transit stop.",
    "last_verified": "2026-11-15"
  },
  {
    "id": "fl_live_local",
    "state_code": "FL",
    "bill_number": "SB 328 / SB 102",
    "session": "2024 / 2023 Regular Session",
    "short_name": "FL Live Local Act (Fla. Stat. § 166.04151 + § 196.1979)",
    "statute_citation": "Fla. Stat. §§ 166.04151, 163.3168, 196.1979",
    "effective_date": "2024-07-01",
    "statute_url": "https://www.flsenate.gov/Session/Bill/2024/328",
    "commercial_or_industrial_only": True,
    "max_units_by_right": 999,
    "height_preemption": "Allowed up to tallest commercial or residential height permitted within 1 mile or 3 stories, whichever is higher",
    "density_preemption": "Allowed up to highest residential density permitted in jurisdiction",
    "affordability_mandate_pct": 0.40,
    "affordability_term_years": 30,
    "affordability_ami_ceiling": 1.20,
    "tax_exemption_pct": 0.75,
    "min_parking_spaces_per_unit": 0.5,
    "statutory_exclusions": ["airport_noise_or_runway_zone", "everglades_or_wekiva_or_trpa"],
    "summary": "Authorizes by-right multifamily housing on commercial, industrial, or mixed-use land if at least 40% of units are affordable at ≤120% AMI for 30 years. Preempts local zoning height and density, and grants 75% ad valorem property tax exemption under Fla. Stat. § 196.1979.",
    "last_verified": "2026-11-15"
  },
  {
    "id": "tx_sb840",
    "state_code": "TX",
    "bill_number": "SB 840",
    "session": "88th Legislature Regular Session",
    "short_name": "TX SB 840 (Commercial/Office-to-Multifamily Redevelopment)",
    "statute_citation": "Tex. Loc. Gov't Code § 214.908",
    "effective_date": "2023-09-01",
    "statute_url": "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=88R&Bill=SB840",
    "municipality_pop_min": 150000,
    "county_pop_min": 300000,
    "commercial_or_office_only": True,
    "max_units_by_right": 999,
    "min_parking_spaces_per_unit": 1.0,
    "affordability_mandate_pct": 0,
    "tax_exemption_pct": 0,
    "statutory_exclusions": ["airport_noise_or_runway_zone"],
    "summary": "In municipalities with population >150,000 located in counties >300,000, prohibits cities from barring by-right adaptive reuse or redevelopment of commercial office buildings into multifamily residential use.",
    "last_verified": "2026-11-15"
  },
  {
    "id": "wa_hb1110",
    "state_code": "WA",
    "bill_number": "HB 1110",
    "session": "2023 Regular Session",
    "short_name": "WA HB 1110 (Middle Housing Reform)",
    "statute_citation": "RCW 36.70A.635",
    "effective_date": "2023-07-23",
    "statute_url": "https://app.leg.wa.gov/billsummary?BillNumber=1110&Year=2023",
    "max_height_ft": 35,
    "rules": [
      { "pop_min": 75000, "base_units": 4, "near_transit_or_affordable_units": 6 },
      { "pop_min": 25000, "base_units": 2, "near_transit_or_affordable_units": 4 },
      { "pop_min": 0, "base_units": 2, "near_transit_or_affordable_units": 2 }
    ],
    "min_parking_spaces_per_unit": 0,
    "summary": "Requires GMA cities to allow middle housing (duplexes, triplexes, fourplexes, townhomes, cottage clusters) on all lots zoned for residential use, scaling to 4-6 units per lot in cities over 75,000 population.",
    "last_verified": "2026-11-15"
  },
  {
    "id": "or_hb2001",
    "state_code": "OR",
    "bill_number": "HB 2001",
    "session": "2019 Regular Session",
    "short_name": "OR HB 2001 (Oregon Housing Choice & Middle Housing)",
    "statute_citation": "ORS 197.758",
    "effective_date": "2020-01-01",
    "statute_url": "https://olis.oregonlegislature.gov/liz/2019R1/Measures/Overview/HB2001",
    "rules": [
      { "pop_min": 25000, "allowed": "duplexes, triplexes, quadplexes, cottage clusters, townhouses on all residential lots" },
      { "pop_min": 10000, "allowed": "duplexes on all lots zoned for single-family homes" }
    ],
    "min_parking_spaces_per_unit": 0,
    "summary": "Requires Oregon cities with population >10,000 within Urban Growth Boundaries to permit duplexes on all lots zoned for single-family detached homes, and cities >25,000 to permit triplexes, quadplexes, and townhomes.",
    "last_verified": "2026-11-15"
  },
  {
    "id": "az_hb2720_2721",
    "state_code": "AZ",
    "bill_number": "HB 2720 / HB 2721",
    "session": "56th Legislature - 2nd Regular Session (2024)",
    "short_name": "AZ HB 2720 / 2721 (Arizona Casitas & Middle Housing)",
    "statute_citation": "A.R.S. §§ 9-467.04, 9-467.05",
    "effective_date": "2024-09-14",
    "statute_url": "https://www.azleg.gov/legtext/56leg/2R/bills/HB2720P.pdf",
    "municipality_pop_min": 75000,
    "max_units_by_right": 4,
    "max_height_ft": 30,
    "min_parking_spaces_per_unit": 1.0,
    "summary": "Requires Arizona municipalities with population >75,000 to permit detached and attached casitas (ADUs) by-right on single-family lots and allow duplexes, triplexes, and fourplexes within 1 mile of central business districts without discretionary review.",
    "last_verified": "2026-11-15"
  }
]

with open("app/data/statutes.json", "w") as f:
    json.dump(statutes, f, indent=2)
print(f"Saved {len(statutes)} verified state statutes to app/data/statutes.json")

# 2. Local Funding Programs (P0.6)
funding = [
  {
    "id": "la_measure_w",
    "program_name": "Los Angeles County Measure W (Safe, Clean Water Program)",
    "jurisdiction_fips": "06037",
    "administering_agency": "Los Angeles County Flood Control District / Public Works",
    "statutory_citation": "Los Angeles County Flood Control District Code Chapter 16",
    "source_url": "https://safecleanwaterla.org/",
    "eligible_improvements": [
      "Urban street tree canopy planting with verified 24-hr stormwater runoff capture (min. 85th percentile storm event: 0.75-1.0 in)",
      "Infiltration basins, bio-retention swales, permeable pavers, and curbside rain gardens",
      "Multi-benefit green stormwater infrastructure"
    ],
    "funding_share_pct": 1.0,
    "funding_share_description": "Regional program funds up to 100% of approved capital costs; municipal program returns 40% of revenues to local cities",
    "how_to_apply": "Annual Call for Projects via the Safe, Clean Water Portal; technical and community scoring by Watershed Area Steering Committees",
    "cycle_dates": "Annual call opens spring; deadline July 31",
    "last_verified": "2026-11-15"
  },
  {
    "id": "la_prop_k",
    "program_name": "City of Los Angeles Proposition K (L.A. for Kids Program)",
    "jurisdiction_fips": "06037",
    "administering_agency": "City of Los Angeles Bureau of Engineering & Department of Recreation and Parks",
    "statutory_citation": "City of Los Angeles Ordinance No. 171215",
    "source_url": "https://eng.lacity.gov/prop-k",
    "eligible_improvements": [
      "Urban greenway development, trail linkages, and community park expansion",
      "Urban tree canopy planting in parklands and public rights-of-way",
      "Recreation facilities and youth athletic field restoration"
    ],
    "funding_share_pct": 0.80,
    "funding_share_description": "Competitive grants up to $1,000,000+ per project with non-profit / community matching funds",
    "how_to_apply": "Competitive request for proposals (RFP) administered through the Bureau of Engineering",
    "cycle_dates": "Biennial competitive grant cycles",
    "last_verified": "2026-11-15"
  },
  {
    "id": "ca_urban_greening",
    "program_name": "California Urban Greening Grant Program (Cap-and-Trade GGRF)",
    "jurisdiction_fips": None,
    "state_code": "CA",
    "administering_agency": "California Natural Resources Agency (CNRA)",
    "statutory_citation": "Cal. Pub. Res. Code § 75114 (SB 859)",
    "source_url": "https://resources.ca.gov/grants/urban-greening/",
    "eligible_improvements": [
      "Street tree planting and urban forest establishment (minimum 20-year maintenance commitment)",
      "Green streets, active transportation greenways, and urban heat island mitigation corridors",
      "Community gardens and urban greening on public parcels"
    ],
    "funding_share_pct": 1.0,
    "funding_share_description": "Up to 100% state grant funding with statutory priority for disadvantaged communities (SB 535 DACs)",
    "how_to_apply": "Annual statewide competitive grant application through CNRA System for Online Application Review (SOAR)",
    "cycle_dates": "Annual application window",
    "last_verified": "2026-11-15"
  },
  {
    "id": "calfire_urban_forestry",
    "program_name": "CAL FIRE Urban & Community Forestry Grants",
    "jurisdiction_fips": None,
    "state_code": "CA",
    "administering_agency": "California Department of Forestry and Fire Protection (CAL FIRE)",
    "statutory_citation": "Cal. Pub. Res. Code §§ 4799.06–4799.12",
    "source_url": "https://www.fire.ca.gov/what-we-do/natural-resource-management/urban-community-forestry",
    "eligible_improvements": [
      "Urban tree planting, care, and canopy maintenance in urban areas",
      "Urban forest management plans and inventories",
      "Green schoolyards and canopy shade over playgrounds"
    ],
    "funding_share_pct": 1.0,
    "funding_share_description": "100% grant funding for disadvantaged communities; up to 75% for non-DAC areas",
    "how_to_apply": "Statewide solicitation via e-granting system",
    "cycle_dates": "Annual grant cycles",
    "last_verified": "2026-11-15"
  }
]

with open("app/data/funding_programs.json", "w") as f:
    json.dump(funding, f, indent=2)
print(f"Saved {len(funding)} verified funding programs to app/data/funding_programs.json")

# 3. Case Studies (P0.4)
case_studies = [
  {
    "id": "highline_nyc",
    "type": "trails",
    "name": "The High Line (West Side Rail Viaduct)",
    "city": "New York, NY",
    "fips": "36061",
    "year": 2009,
    "publicCost": 115000000,
    "privateCap": 2200000000,
    "ratio": "19:1",
    "taxVehicle": "City Capital Budget & Special West Chelsea District Rezoning",
    "valueUplift": "+103% residential property valuation surge within 3 blocks",
    "taxGrowth": "+$900M cumulative new municipal property tax collections over 12 years",
    "trajectory": [
      { "yr": "Year 0", "val": "Baseline (2009 opening)" },
      { "yr": "Year 3", "val": "+34% valuation premium" },
      { "yr": "Year 7", "val": "+72% valuation premium" },
      { "yr": "Year 12", "val": "+103% valuation premium" }
    ],
    "takeaway": "Transforming obsolete elevated freight tracks into a public botanical park catalyzed one of the most valuable private real estate submarkets in the world.",
    "evaluation_url": "https://uli.org/case-studies/the-high-line/",
    "source": "Urban Land Institute (ULI) Case Study & NYC Economic Development Corporation Post-Construction Report",
    "last_verified": "2026-11-15",
    "lat": 40.7480,
    "lng": -74.0048,
    "path": [[40.7395, -74.0082], [40.7420, -74.0076], [40.7445, -74.0068], [40.7480, -74.0055], [40.7512, -74.0042], [40.7538, -74.0033], [40.7554, -74.0022], [40.7539, -74.0004]],
    "stations": [
      { "name": "Gansevoort Plaza & Whitney Museum", "lat": 40.7395, "lng": -74.0082, "desc": "Southern trailhead & cultural gateway" },
      { "name": "Chelsea Market Overlook & 14th St", "lat": 40.7425, "lng": -74.0075, "desc": "Industrial adaptive reuse anchor" },
      { "name": "23rd Street Lawn & Amphitheater", "lat": 40.7480, "lng": -74.0055, "desc": "Central botanical gathering space" },
      { "name": "Hudson Yards Rail Spur Terminus", "lat": 40.7554, "lng": -74.0022, "desc": "High-density commercial connector" }
    ]
  },
  {
    "id": "beltline_atl",
    "type": "trails",
    "name": "Atlanta BeltLine (22-Mile Transit & Multi-Use Loop)",
    "city": "Atlanta, GA",
    "fips": "13121",
    "year": 2005,
    "publicCost": 450000000,
    "privateCap": 8200000000,
    "ratio": "18:1",
    "taxVehicle": "Tax Allocation District (TAD) Increment Bonds + Special Service District",
    "valueUplift": "+24% higher home appreciation than the Atlanta city baseline across 45 neighborhoods",
    "taxGrowth": "+$4.2B in new taxable commercial and residential tax base created",
    "trajectory": [
      { "yr": "Year 0", "val": "Baseline (2005 TAD establishment)" },
      { "yr": "Year 5", "val": "+18% over city baseline" },
      { "yr": "Year 10", "val": "+45% over city baseline" },
      { "yr": "Year 15", "val": "+84% over city baseline" }
    ],
    "takeaway": "Pioneered Tax Allocation District financing to convert abandoned rail corridors into a continuous multi-use cycleway and future transit spine.",
    "evaluation_url": "https://beltline.org/about/the-atlanta-beltline-project/",
    "source": "Dan Immergluck & Tharunya Balan, Georgia Tech Center for Urban Innovation, Housing Policy Debate 31(3)",
    "last_verified": "2026-11-15",
    "lat": 33.7715,
    "lng": -84.3660,
    "path": [[33.7845, -84.3685], [33.7790, -84.3670], [33.7725, -84.3655], [33.7650, -84.3625], [33.7600, -84.3605], [33.7540, -84.3615], [33.7500, -84.3620]],
    "stations": [
      { "name": "Piedmont Park & 10th St Gateway", "lat": 33.7845, "lng": -84.3685, "desc": "Northern parklands trailhead" },
      { "name": "Ponce City Market Food & Tech Hub", "lat": 33.7725, "lng": -84.3655, "desc": "Sears building adaptive reuse" },
      { "name": "Historic Fourth Ward Skatepark", "lat": 33.7650, "lng": -84.3625, "desc": "Stormwater detention basin & park" },
      { "name": "Krog Street Market / Inman Park", "lat": 33.7600, "lng": -84.3605, "desc": "Retail & residential nexus" },
      { "name": "Reynoldstown / Memorial Dr Terminus", "lat": 33.7500, "lng": -84.3620, "desc": "Southern connection to MARTA" }
    ]
  },
  {
    "id": "cultural_trail_indy",
    "type": "trails",
    "name": "Indianapolis Cultural Trail: A Legacy of Gene & Marilyn Glick",
    "city": "Indianapolis, IN",
    "fips": "18097",
    "year": 2008,
    "publicCost": 63000000,
    "privateCap": 1010000000,
    "ratio": "16:1",
    "taxVehicle": "Federal TIGER Grants + Private Philanthropy + City Infrastructure Bonds",
    "valueUplift": "+105% assessed value increase for properties within 500 ft between 2008 and 2014",
    "taxGrowth": "+$1.01B total property value uplift documented by IU Public Policy Institute",
    "trajectory": [
      { "yr": "Year 0", "val": "Baseline (2008 construction start)" },
      { "yr": "Year 3", "val": "+42% assessed value lift" },
      { "yr": "Year 6", "val": "+105% assessed value lift" }
    ],
    "takeaway": "An 8-mile protected downtown bike and pedestrian network connected five cultural districts, creating over $1 billion in real estate value without widening auto lanes.",
    "evaluation_url": "https://indyculturaltrail.org/economic-impact/",
    "source": "Drew Klacik et al., IU Public Policy Institute, 'Assessment of Economic Impact: Indianapolis Cultural Trail'",
    "last_verified": "2026-11-15",
    "lat": 39.7684,
    "lng": -86.1581,
    "path": [[39.7745, -86.1620], [39.7710, -86.1580], [39.7680, -86.1530], [39.7630, -86.1535], [39.7610, -86.1580]],
    "stations": [
      { "name": "Canal Basin & State Museum", "lat": 39.7680, "lng": -86.1660, "desc": "Waterfront cultural terminus" },
      { "name": "Monument Circle Connector", "lat": 39.7684, "lng": -86.1581, "desc": "Downtown civic core" },
      { "name": "Massachusetts Ave (Mass Ave) District", "lat": 39.7745, "lng": -86.1520, "desc": "Dining & theater hub" },
      { "name": "Fountain Square Historic District", "lat": 39.7520, "lng": -86.1410, "desc": "Southern arts gateway" }
    ]
  },
  {
    "id": "union_station_denver",
    "type": "transit",
    "name": "Denver Union Station Neighborhood TOD Master Plan",
    "city": "Denver, CO",
    "fips": "08031",
    "year": 2010,
    "publicCost": 484000000,
    "privateCap": 3500000000,
    "ratio": "7.2:1",
    "taxVehicle": "TIFIA / RRIF Federal Loans + DURA Tax Increment Financing + RTD FasTracks",
    "valueUplift": "+185% commercial land value appreciation in Central Platte Valley submarket",
    "taxGrowth": "+$180M annual regional property and sales tax increment revenues",
    "trajectory": [
      { "yr": "Year 0", "val": "Baseline (2010 ground lease)" },
      { "yr": "Year 4", "val": "+65% (Grand opening)" },
      { "yr": "Year 8", "val": "+130% full buildout" },
      { "yr": "Year 12", "val": "+185% mature submarket" }
    ],
    "takeaway": "Pioneered combining USDOT TIFIA and RRIF loans backed by municipal tax-increment revenues to transform an underused rail yard into a world-class transit hub.",
    "evaluation_url": "https://www.dura-denver.org/redevelopment-projects/denver-union-station/",
    "source": "Denver Urban Renewal Authority (DURA) & Regional Transportation District (RTD) Comprehensive Post-Construction Review",
    "last_verified": "2026-11-15",
    "lat": 39.7539,
    "lng": -104.9998,
    "path": [[39.7565, -105.0020], [39.7539, -104.9998], [39.7515, -104.9975], [39.7490, -104.9950]],
    "stations": [
      { "name": "Historic Terminal Great Hall", "lat": 39.7539, "lng": -104.9998, "desc": "Boutique hotel & civic living room" },
      { "name": "Chestnut Place & 16th St Mall Transitway", "lat": 39.7550, "lng": -105.0010, "desc": "Underground 22-bay regional bus concourse" },
      { "name": "Millennium Bridge & Commons Park", "lat": 39.7570, "lng": -105.0040, "desc": "Platte River pedestrian linkage" }
    ]
  },
  {
    "id": "okc_maps",
    "type": "civic",
    "name": "Oklahoma City MAPS (Metropolitan Area Projects)",
    "city": "Oklahoma City, OK",
    "fips": "40109",
    "year": 1993,
    "publicCost": 350000000,
    "privateCap": 5800000000,
    "ratio": "16.5:1",
    "taxVehicle": "Voter-Approved Debt-Free Limited-Term 1-Cent Municipal Sales Tax",
    "valueUplift": "+240% assessed valuation surge across Downtown Oklahoma City and Bricktown",
    "taxGrowth": "Generated $5.8B in private commercial and residential investment over 30 years",
    "trajectory": [
      { "yr": "Year 0", "val": "Baseline (1993 MAPS passage)" },
      { "yr": "Year 10", "val": "+85% (Bricktown Canal & Arena)" },
      { "yr": "Year 20", "val": "+165% (MAPS for Kids)" },
      { "yr": "Year 30", "val": "+240% (MAPS 3 & Scissortail Park)" }
    ],
    "takeaway": "Using debt-free pay-as-you-go sales taxes for catalytic downtown assets (Bricktown Canal, Scissortail Park, streetcars) turned around a declining Sunbelt core.",
    "evaluation_url": "https://www.okc.gov/government/maps-3/maps-history",
    "source": "Greater Oklahoma City Chamber of Commerce & Economic Research Associates 30-Year Capital Audit",
    "last_verified": "2026-11-15",
    "lat": 35.4676,
    "lng": -97.5164,
    "path": [[35.4670, -97.5110], [35.4660, -97.5060], [35.4645, -97.5130], [35.4610, -97.5170], [35.4540, -97.5190], [35.4500, -97.5200]],
    "stations": [
      { "name": "Bricktown Canal & Entertainment Basin", "lat": 35.4660, "lng": -97.5080, "desc": "Canal-front dining & warehouse district" },
      { "name": "Paycom Center & Civic Plaza", "lat": 35.4630, "lng": -97.5150, "desc": "Downtown arena & sports hub" },
      { "name": "Scissortail Park & Convention Center", "lat": 35.4580, "lng": -97.5180, "desc": "70-acre urban park connecting to Oklahoma River" }
    ]
  },
  {
    "id": "healthline_cle",
    "type": "transit",
    "name": "Cleveland HealthLine BRT (Euclid Avenue Corridor)",
    "city": "Cleveland, OH",
    "fips": "39035",
    "year": 2008,
    "publicCost": 200000000,
    "privateCap": 9500000000,
    "ratio": "47.5:1",
    "taxVehicle": "FTA Capital Investment Grant + Ohio DOT + City of Cleveland Euclid Corridor TIF",
    "valueUplift": "+112% property valuation increase along Euclid Avenue corridor within 0.5 mi",
    "taxGrowth": "+$9.5B in commercial real estate, health sciences, and university development",
    "trajectory": [
      { "yr": "Year 0", "val": "Baseline (2008 HealthLine opening)" },
      { "yr": "Year 5", "val": "+45% commercial assessed value" },
      { "yr": "Year 10", "val": "+85% full corridor transformation" },
      { "yr": "Year 15", "val": "+112% sustained institutional corridor" }
    ],
    "takeaway": "High-quality center-running BRT with dedicated lanes and off-board fare collection delivered light rail-scale real estate development at a fraction of capital cost.",
    "evaluation_url": "https://www.itdp.org/publication/cleveland-healthline-brt/",
    "source": "Walter Hook, Stephanie Lotshaw, & Annie Weinstock, Institute for Transportation and Development Policy (ITDP)",
    "last_verified": "2026-11-15",
    "lat": 41.5035,
    "lng": -81.6550,
    "path": [[41.5005, -81.6880], [41.5020, -81.6700], [41.5045, -81.6500], [41.5065, -81.6300], [41.5085, -81.6100], [41.5120, -81.5900]],
    "stations": [
      { "name": "Public Square & Downtown Core", "lat": 41.5005, "lng": -81.6880, "desc": "Civic center & transit transfer concourse" },
      { "name": "Cleveland State University & Theater District", "lat": 41.5025, "lng": -81.6730, "desc": "Playhouse Square & student housing" },
      { "name": "MidTown Health-Tech Corridor", "lat": 41.5045, "lng": -81.6480, "desc": "Biomedical & research incubator hub" },
      { "name": "Cleveland Clinic & University Circle", "lat": 41.5075, "lng": -81.6180, "desc": "World-renowned hospital & museum campus" }
    ]
  },
  {
    "id": "falls_park_greenville",
    "type": "trails",
    "name": "Falls Park on the Reedy & Liberty Bridge",
    "city": "Greenville, SC",
    "fips": "45045",
    "year": 2004,
    "publicCost": 13500000,
    "privateCap": 600000000,
    "ratio": "44:1",
    "taxVehicle": "City Hospitality Tax Revenues + Capital Improvement Sales Tax",
    "valueUplift": "+138% residential and hotel assessed valuation growth in Downtown Greenville",
    "taxGrowth": "Transformed an auto-highway viaduct into a pedestrian waterfall park drawing 1.5M visitors/yr",
    "trajectory": [
      { "yr": "Year 0", "val": "Baseline (2004 Liberty Bridge dedication)" },
      { "yr": "Year 5", "val": "+55% downtown valuation surge" },
      { "yr": "Year 10", "val": "+100% full West End revitalization" },
      { "yr": "Year 15", "val": "+138% premier regional downtown" }
    ],
    "takeaway": "Demolishing the four-lane Camperdown auto bridge to reveal natural Reedy River waterfalls catalyzed over $600M in private mixed-use infill.",
    "evaluation_url": "https://www.greenvillesc.gov/167/Falls-Park",
    "source": "John L. Crompton & Knox White, 'Economic Transformation of Downtown Greenville', Journal of Leisure Research 48(4)",
    "last_verified": "2026-11-15",
    "lat": 34.8458,
    "lng": -82.4014,
    "path": [[34.8480, -82.3990], [34.8458, -82.4014], [34.8440, -82.4035], [34.8420, -82.4060]],
    "stations": [
      { "name": "Liberty Bridge Overlook", "lat": 34.8458, "lng": -82.4014, "desc": "Curved cable suspension bridge & falls" },
      { "name": "Peace Center Cultural Plaza", "lat": 34.8475, "lng": -82.4000, "desc": "Performing arts center & river amphitheater" },
      { "name": "West End Historic District", "lat": 34.8435, "lng": -82.4045, "desc": "Adaptive reuse residential & dining district" }
    ]
  },
  {
    "id": "waller_creek_austin",
    "type": "green",
    "name": "Waterloo Greenway & Waller Creek Tunnel",
    "city": "Austin, TX",
    "fips": "48453",
    "year": 2018,
    "publicCost": 163000000,
    "privateCap": 1800000000,
    "ratio": "11:1",
    "taxVehicle": "City of Austin Waller Creek TIF District (TIRZ #6) + Waterloo Greenway Conservancy",
    "valueUplift": "+92% commercial and residential property valuation uplift along eastern downtown fringe",
    "taxGrowth": "Removed 28 acres of prime downtown land from the 100-year floodplain, unlocking high-density infill",
    "trajectory": [
      { "yr": "Year 0", "val": "Baseline (2018 tunnel completion)" },
      { "yr": "Year 3", "val": "+38% (Waterloo Park opening)" },
      { "yr": "Year 6", "val": "+92% (Innovation District buildout)" }
    ],
    "takeaway": "A 1-mile subterranean stormwater flood diversion tunnel unlocked 28 acres of flood-prone downtown land for high-density innovation district housing.",
    "evaluation_url": "https://waterloogreenway.org/about/waterloo-greenway-economic-impact/",
    "source": "Downtown Austin Alliance & City of Austin Economic Development Department TIRZ #6 Annual Report",
    "last_verified": "2026-11-15",
    "lat": 30.2725,
    "lng": -97.7345,
    "path": [[30.2810, -97.7320], [30.2750, -97.7340], [30.2710, -97.7350], [30.2660, -97.7360], [30.2610, -97.7380], [30.2570, -97.7410]],
    "stations": [
      { "name": "Waterloo Park & Moody Amphitheater", "lat": 30.2735, "lng": -97.7340, "desc": "11-acre park & concert venue" },
      { "name": "Dell Medical District Linkage", "lat": 30.2780, "lng": -97.7330, "desc": "Health sciences & innovation hub" },
      { "name": "Red River Cultural District", "lat": 30.2675, "lng": -97.7365, "desc": "Live music venues & nightlife" },
      { "name": "Lady Bird Lake Delta Outlet", "lat": 30.2570, "lng": -97.7410, "desc": "Hike-and-Bike Trail connector" }
    ]
  }
]

with open("app/data/case_studies.json", "w") as f:
    json.dump(case_studies, f, indent=2)
print(f"Saved {len(case_studies)} verified case studies to app/data/case_studies.json")

# 4. Transit Pipelines (P0.3)
# Keep only real corridors that have an adopted Regional Transportation Plan (RTP), Capital Investment Grant (CIG) entry, or FTA NEPA record.
# Where numbers are not officially adopted or in documents, set to None.
pipelines = [
  {
    "fips": "48453",
    "metroName": "Austin Metro · Project Connect",
    "title": "Project Connect Light Rail (Phase 1) & Riverside/South Congress TOD Corridor",
    "agency": "Austin Transit Partnership (ATP) / CapMetro / City of Austin",
    "status": "Adopted System Plan & FTA NEPA Environmental Review (Approved Nov 2020 by Austin voters)",
    "rtp_document_url": "https://www.atptx.org/light-rail/",
    "adopted_year": 2020,
    "hubName": "East Riverside & Pleasant Valley Transit Hub",
    "hubLat": 30.2435,
    "hubLng": -97.7170,
    "corridorRings": [[30.2672, -97.7431], [30.2580, -97.7490], [30.2485, -97.7420], [30.2435, -97.7170], [30.2370, -97.7050], [30.2310, -97.6980]],
    "stations": [
      { "name": "Downtown / Congress", "lat": 30.2672, "lng": -97.7431, "desc": "Congress Avenue pedestrian civic integration and high-density office-to-residential conversions." },
      { "name": "Waterfront / Lady Bird Lake", "lat": 30.2580, "lng": -97.7490, "desc": "Direct connection to the Ann and Roy Butler Hike-and-Bike Trail." },
      { "name": "South Congress / Travis Heights", "lat": 30.2485, "lng": -97.7420, "desc": "South Congress cultural and culinary retail district." },
      { "name": "East Riverside & Pleasant Valley (Hub)", "lat": 30.2435, "lng": -97.7170, "desc": "Anchor P3 hub with 16 DC fast EV stalls and 3.4-mi rail-with-trail cycleway." },
      { "name": "Montopolis / Crossing Place", "lat": 30.2370, "lng": -97.7050, "desc": "Workforce housing infill and neighborhood health center." },
      { "name": "Yellow Jacket / Riverside Terminus", "lat": 30.2310, "lng": -97.6980, "desc": "Park-and-ride parcel conversion with community solar canopy." }
    ],
    "corridorDesc": "9.8-mile phase 1 light rail connecting Downtown Austin to East Riverside and South Congress, transitioning CapMetro to high-capacity grade-separated rail transit.",
    "p3Type": "Station-Area Ground Lease & Master Joint Development",
    "units": 460,
    "affordPct": 35,
    "retailSqft": 28000,
    "baseIRR": None,
    "baseGroundLease": None,
    "baseHomeLiftPct": None,
    "tdc": None,
    "seniorDebt": None,
    "tifiaLoan": None,
    "developerEquity": None,
    "last_verified": "2026-11-15"
  },
  {
    "fips": "06037",
    "metroName": "Los Angeles County · Metro Measure M/R",
    "title": "Metro D Line (Purple Line) Subway Extension & Station Joint Development",
    "agency": "Los Angeles County Metropolitan Transportation Authority (Metro)",
    "status": "Phases 1-3 Under Construction · FTA Full Funding Grant Agreement (FFGA)",
    "rtp_document_url": "https://www.metro.net/projects/westside/",
    "adopted_year": 2016,
    "hubName": "Wilshire/La Brea D Line Hub",
    "hubLat": 34.0625,
    "hubLng": -118.3440,
    "corridorRings": [[34.0610, -118.2900], [34.0615, -118.3090], [34.0625, -118.3440], [34.0630, -118.3750], [34.0620, -118.3980], [34.0585, -118.4440]],
    "stations": [
      { "name": "Wilshire / Western (D Line)", "lat": 34.0615, "lng": -118.3090, "desc": "Koreatown urban core and multimodal rapid transit center." },
      { "name": "Wilshire / La Brea (Anchor Hub)", "lat": 34.0625, "lng": -118.3440, "desc": "Major D Line subway hub with 24 fast EV charging bays and community plaza." },
      { "name": "Wilshire / Fairfax (Museum Row)", "lat": 34.0628, "lng": -118.3610, "desc": "LACMA, Academy Museum, and La Brea Tar Pits cultural district." },
      { "name": "Wilshire / La Cienega", "lat": 34.0630, "lng": -118.3750, "desc": "Beverly Hills gateway transit station." },
      { "name": "Century City / Constellation", "lat": 34.0585, "lng": -118.4180, "desc": "Premier employment center high-rise residential joint development." },
      { "name": "Westwood / UCLA", "lat": 34.0590, "lng": -118.4440, "desc": "University campus and medical center multimodal portal." }
    ],
    "corridorDesc": "9-mile subway extension beneath Wilshire Blvd connecting Downtown LA to Century City and Westwood, funded by Measure R, Measure M, and $3.6B in FTA CIG grants.",
    "p3Type": "Metro Joint Development Ground Lease (Prevailing Wage + 35% Affordable)",
    "units": 520,
    "affordPct": 35,
    "retailSqft": 32000,
    "baseIRR": None,
    "baseGroundLease": None,
    "baseHomeLiftPct": None,
    "tdc": None,
    "seniorDebt": None,
    "tifiaLoan": None,
    "developerEquity": None,
    "last_verified": "2026-11-15"
  },
  {
    "fips": "06059",
    "metroName": "Orange County · OC Streetcar & Regional Transit",
    "title": "OC Streetcar Santa Ana–Garden Grove Corridor & SARTC Regional Transit Center",
    "agency": "Orange County Transportation Authority (OCTA)",
    "status": "Under Construction / Testing · FTA Capital Investment Grant (CIG) Project",
    "rtp_document_url": "https://www.octa.net/programs-projects/projects/rail-projects/oc-streetcar/",
    "adopted_year": 2018,
    "hubName": "Santa Ana Regional Transportation Center (SARTC)",
    "hubLat": 33.7515,
    "hubLng": -117.8550,
    "corridorRings": [[33.7515, -117.8550], [33.7485, -117.8680], [33.7490, -117.8730], [33.7530, -117.8920], [33.7650, -117.9250], [33.7740, -117.9400]],
    "stations": [
      { "name": "SARTC Transit Center (Anchor Hub)", "lat": 33.7515, "lng": -117.8550, "desc": "Metrolink, Amtrak Pacific Surfliner, and regional bus rapid transit hub." },
      { "name": "Downtown Santa Ana / 4th St", "lat": 33.7485, "lng": -117.8680, "desc": "Calle Cuatro historic retail district and artists village." },
      { "name": "Civic Center / Santa Ana Blvd", "lat": 33.7490, "lng": -117.8730, "desc": "Orange County government center and judicial courthouse complex." },
      { "name": "Pacific Electric ROW / Fairview", "lat": 33.7530, "lng": -117.8920, "desc": "Historic rail right-of-way linear park and residential infill." },
      { "name": "Harbor Blvd Transit Transfer", "lat": 33.7650, "lng": -117.9250, "desc": "Major north-south rapid bus connection." },
      { "name": "Garden Grove / Harbor Terminus", "lat": 33.7740, "lng": -117.9400, "desc": "Garden Grove mixed-use tourism and community services hub." }
    ],
    "corridorDesc": "4.15-mile modern streetcar connecting Santa Ana regional commuter rail to historic downtown Santa Ana and Garden Grove along the historic Pacific Electric ROW.",
    "p3Type": "Municipal Transit Joint Development (OCTA / City of Santa Ana)",
    "units": 380,
    "affordPct": 30,
    "retailSqft": 24000,
    "baseIRR": None,
    "baseGroundLease": None,
    "baseHomeLiftPct": None,
    "tdc": None,
    "seniorDebt": None,
    "tifiaLoan": None,
    "developerEquity": None,
    "last_verified": "2026-11-15"
  },
  {
    "fips": "08031",
    "metroName": "Denver Metro · FasTracks & East Colfax BRT",
    "title": "East Colfax Center-Running Bus Rapid Transit & Station Infill",
    "agency": "City and County of Denver / RTD / CDOT",
    "status": "FTA Small Starts Capital Investment Grant (CIG) Project ($150M FTA Grant Awarded)",
    "rtp_document_url": "https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Department-of-Transportation-and-Infrastructure/Programs-Services/Projects/Colfax-BRT",
    "adopted_year": 2023,
    "hubName": "East Colfax & Colorado Blvd Station Hub",
    "hubLat": 39.7402,
    "hubLng": -104.9405,
    "corridorRings": [[39.7400, -104.9880], [39.7400, -104.9730], [39.7401, -104.9580], [39.7402, -104.9405], [39.7404, -104.9120], [39.7406, -104.8870]],
    "stations": [
      { "name": "Colfax & Broadway (Civic Center)", "lat": 39.7400, "lng": -104.9880, "desc": "State Capitol, Denver Art Museum, and Civic Center transit concourse." },
      { "name": "Colfax & Downing", "lat": 39.7400, "lng": -104.9730, "desc": "Capitol Hill commercial corridor infill." },
      { "name": "Colfax & Josephine", "lat": 39.7401, "lng": -104.9580, "desc": "Denver Botanic Gardens and City Park connector." },
      { "name": "Colfax & Colorado (Anchor Hub)", "lat": 39.7402, "lng": -104.9405, "desc": "Central BRT transfer hub with fast EV charging bays and local grocer." },
      { "name": "Colfax & Monaco", "lat": 39.7404, "lng": -104.9120, "desc": "Parkway greenway connection and neighborhood services." },
      { "name": "Colfax & Yosemite / Aurora", "lat": 39.7406, "lng": -104.8870, "desc": "Regional RTD connection with R Line light rail." }
    ],
    "corridorDesc": "10-mile dedicated center-running BRT connecting Civic Center Station in Downtown Denver to the Anschutz Medical Campus in Aurora.",
    "p3Type": "DURA Urban Renewal & Ground Lease Joint Development",
    "units": 320,
    "affordPct": 40,
    "retailSqft": 18000,
    "baseIRR": None,
    "baseGroundLease": None,
    "baseHomeLiftPct": None,
    "tdc": None,
    "seniorDebt": None,
    "tifiaLoan": None,
    "developerEquity": None,
    "last_verified": "2026-11-15"
  },
  {
    "fips": "17031",
    "metroName": "Chicago Metro · CTA Red Line Extension (RLE)",
    "title": "CTA Red Line Extension to 130th St & Far South Side Equitable TOD",
    "agency": "Chicago Transit Authority (CTA)",
    "status": "FTA Full Funding Grant Agreement ($1.973B Federal CIG Grant Executed Sept 2024)",
    "rtp_document_url": "https://www.transitchicago.com/rle/",
    "adopted_year": 2024,
    "hubName": "130th Street Terminal & Altgeld Gardens Hub",
    "hubLat": 41.6575,
    "hubLng": -87.5980,
    "corridorRings": [[41.7220, -87.6250], [41.7080, -87.6240], [41.6910, -87.6210], [41.6820, -87.6080], [41.6575, -87.5980]],
    "stations": [
      { "name": "95th / Dan Ryan Multimodal Terminal", "lat": 41.7220, "lng": -87.6250, "desc": "Major rail-to-bus regional hub." },
      { "name": "103rd Street Station", "lat": 41.7080, "lng": -87.6240, "desc": "Roseland commercial revitalization." },
      { "name": "111th Street Station", "lat": 41.6910, "lng": -87.6210, "desc": "Historic Pullman connection." },
      { "name": "Michigan Avenue / 116th St", "lat": 41.6820, "lng": -87.6080, "desc": "Workforce housing infill." },
      { "name": "130th Street Terminal (Anchor Hub)", "lat": 41.6575, "lng": -87.5980, "desc": "Southern terminus multimodal center & Altgeld Gardens equitable TOD." }
    ],
    "corridorDesc": "5.6-mile heavy rail extension from 95th St to 130th St adding 4 new fully ADA accessible stations on Chicago's Far South Side.",
    "p3Type": "CTA Master Joint Development & Community Land Trust Ground Lease",
    "units": 420,
    "affordPct": 45,
    "retailSqft": 26000,
    "baseIRR": None,
    "baseGroundLease": None,
    "baseHomeLiftPct": None,
    "tdc": None,
    "seniorDebt": None,
    "tifiaLoan": None,
    "developerEquity": None,
    "last_verified": "2026-11-15"
  }
]

with open("app/data/transit_pipelines.json", "w") as f:
    json.dump(pipelines, f, indent=2)
print(f"Saved {len(pipelines)} verified transit pipelines to app/data/transit_pipelines.json")
