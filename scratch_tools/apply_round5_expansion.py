import re

FILE_PATH = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/index.html"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

print("Original file length:", len(content))

# 1. Expand getMetroPipeline with 9 top US Metros: Chicago, Atlanta, SF Bay, Miami, DC, DFW, NYC, Boston, Philly
CHICAGO_P3 = '''  // Chicago / Cook County, IL
  if (fips === "17031" || city.includes("chicago") || city.includes("evanston") || city.includes("oak park")) {
    return {
      fips: "17031",
      metroName: "Chicago Metro · CTA Red Line Extension (RLE)",
      title: "CTA Red Line Extension to 130th St & Far South Side Equitable TOD",
      agency: "Chicago Transit Authority (CTA) & City of Chicago Dept of Planning",
      status: "FTA Full Funding Grant Agreement ($1.97B Federal CIG) · Construction 2025-2030",
      hubName: "130th Street Terminal & Multimodal Rail Yard Hub",
      hubLat: 41.6565,
      hubLng: -87.5990,
      corridorRings: [[41.7225, -87.6244], [41.7067, -87.6180], [41.6922, -87.6150], [41.6830, -87.6200], [41.6565, -87.5990]],
      stations: [
        { name: "95th / Dan Ryan Multimodal Terminal", lat: 41.7225, lng: -87.6244, units: 480, affordPct: 40, retailSqft: 32000, desc: "Anchor South Side passenger terminal and express bus interchange." },
        { name: "103rd Street Station", lat: 41.7067, lng: -87.6180, units: 340, affordPct: 40, retailSqft: 20000, desc: "Roseland neighborhood infill and small-business commercial plaza." },
        { name: "111th Street / Roseland Hub", lat: 41.6922, lng: -87.6150, units: 390, affordPct: 45, retailSqft: 24000, desc: "Equitable workforce housing and community healthcare anchor." },
        { name: "Michigan Ave & 116th Street", lat: 41.6830, lng: -87.6200, units: 320, affordPct: 40, retailSqft: 18000, desc: "Far South Side commercial district revitalisation and active retail." },
        { name: "130th Street Terminal (Anchor Hub)", lat: 41.6565, lng: -87.5990, units: 420, affordPct: 40, retailSqft: 26000, desc: "Park-and-ride conversion, bus turnaround, and Major Taylor Trail connector." }
      ],
      corridorDesc: "5.6-mile heavy rail extension with 4 new accessible stations bringing high-capacity rapid transit to historic South Side communities.",
      p3Type: "Far South Side Transit-Supportive TIF & City Surplus Land 99-Year Ground Lease",
      units: 420,
      affordPct: 40,
      retailSqft: 26000,
      baseIRR: 15.4,
      baseGroundLease: 1120000,
      baseHomeLiftPct: 7.5,
      baseBoardingBoostPct: 44,
      bikewayName: "Major Taylor Trail & 130th Street Rail-with-Trail Greenway",
      bikewayDesc: "Class I multi-use paved cycle highway connecting Dan Ryan Woods, Whispering Willow, and the Calumet River basin.",
      bikewayCost: 3400000,
      bikewayHomeLift: 3.6,
      bikewayRidership: 14,
      treeSpecies: "Swamp White Oak, Bur Oak, Freeman Maple & American Linden",
      treeCount: 1450,
      treeCost: 1180000,
      treeTempDrop: 5.4,
      treeHomeLift: 2.7,
      evStalls: 18,
      evKw: 200,
      evCost: 780000,
      evAnnualMargin: 62000,
      evCo2Tons: 260,
      plazaRetailSqft: 16000,
      plazaRetailCost: 2200000,
      plazaAnnualRent: 490000,
      localSalesTax: 380000,
      tdc: 86000000,
      seniorDebt: 47300000,
      tifiaLoan: 12900000,
      developerEquity: 25800000,
      noi: 6150000
    };
  }
'''

ATLANTA_P3 = '''  // Atlanta / Fulton & DeKalb County, GA
  if (fips === "13121" || fips === "13089" || city.includes("atlanta")) {
    return {
      fips: "13121",
      metroName: "Metro Atlanta · BeltLine Streetcar & Rail-with-Trail",
      title: "Atlanta BeltLine Streetcar & Rail-with-Trail Multi-Use Loop P3 Corridor",
      agency: "Atlanta BeltLine Inc. (ABI) & MARTA",
      status: "Final Design & Engineering · BeltLine TAD & Federal RAISE Grant Pipeline",
      hubName: "Ponce City Market / Historic Fourth Ward BeltLine Hub",
      hubLat: 33.7725,
      hubLng: -84.3655,
      corridorRings: [[33.7725, -84.3655], [33.7580, -84.3638], [33.7485, -84.3630], [33.7410, -84.3680], [33.7250, -84.3980]],
      stations: [
        { name: "Ponce City Market / 4th Ward (Anchor)", lat: 33.7725, lng: -84.3655, units: 510, affordPct: 35, retailSqft: 34000, desc: "Premier adaptive reuse hub with 20 fast EV charging stalls and cycle pavilion." },
        { name: "Inman Park / Krog Street Market", lat: 33.7580, lng: -84.3638, units: 380, affordPct: 35, retailSqft: 24000, desc: "Culinary arts and creative office transit integration." },
        { name: "Memorial Drive / Cabbagetown", lat: 33.7485, lng: -84.3630, units: 360, affordPct: 35, retailSqft: 22000, desc: "Historic mill village infill and neighborhood grocer." },
        { name: "Glenwood Park / D.H. Stanton", lat: 33.7410, lng: -84.3680, units: 330, affordPct: 40, retailSqft: 19000, desc: "Solar-powered park connection and community recreation pavilion." },
        { name: "University Ave / Southside BeltLine Hub", lat: 33.7250, lng: -84.3980, units: 420, affordPct: 45, retailSqft: 25000, desc: "Southside equity anchor with workforce vocational center and health clinic." }
      ],
      corridorDesc: "22-mile continuous transit and active trail loop repurposing historic rail corridors into Atlanta's public realm spine.",
      p3Type: "BeltLine Tax Allocation District (TAD) Surplus Parcel Public-Private Partnership",
      units: 510,
      affordPct: 35,
      retailSqft: 34000,
      baseIRR: 16.2,
      baseGroundLease: 1450000,
      baseHomeLiftPct: 8.2,
      baseBoardingBoostPct: 48,
      bikewayName: "Atlanta BeltLine Continuous Multi-Use Trail Highway",
      bikewayDesc: "14-ft wide concrete dual-direction shared path completely grade-separated from automobile traffic with pedestrian lighting.",
      bikewayCost: 4200000,
      bikewayHomeLift: 4.1,
      bikewayRidership: 18,
      treeSpecies: "Southern Red Oak, Tulip Poplar, Loblolly Pine & Sweetgum",
      treeCount: 1800,
      treeCost: 1450000,
      treeTempDrop: 6.8,
      treeHomeLift: 3.1,
      evStalls: 20,
      evKw: 250,
      evCost: 920000,
      evAnnualMargin: 74000,
      evCo2Tons: 320,
      plazaRetailSqft: 22000,
      plazaRetailCost: 2900000,
      plazaAnnualRent: 710000,
      localSalesTax: 540000,
      tdc: 108000000,
      seniorDebt: 59400000,
      tifiaLoan: 16200000,
      developerEquity: 32400000,
      noi: 7850000
    };
  }
'''

SF_BAY_P3 = '''  // San Francisco & Silicon Valley / San Francisco & Santa Clara County, CA
  if (fips === "06075" || fips === "06085" || city.includes("san francisco") || city.includes("san jose") || city.includes("palo alto")) {
    return {
      fips: fips === "06085" ? "06085" : "06075",
      metroName: "San Francisco Bay Area · The Portal (DTX) & Diridon Hub",
      title: "Transbay Downtown Rail Extension (The Portal) & Diridon Station Master Plan",
      agency: "Transbay Joint Powers Authority (TJPA), Caltrain & VTA",
      status: "FTA Engineering Phase & CIG Core Capacity Pipeline · CA High-Speed Rail Integration",
      hubName: fips === "06085" ? "San Jose Diridon Integrated Station Hub" : "Salesforce Transit Center / Grand Central West",
      hubLat: fips === "06085" ? 37.3300 : 37.7895,
      hubLng: fips === "06085" ? -121.9030 : -122.3970,
      corridorRings: fips === "06085" ?
        [[37.3300, -121.9030], [37.3400, -121.9150], [37.3530, -121.9360], [37.3750, -121.9600]] :
        [[37.7895, -122.3970], [37.7765, -122.3945], [37.7570, -122.3925], [37.7270, -122.4010]],
      stations: fips === "06085" ? [
        { name: "San Jose Diridon Integrated Hub (Anchor)", lat: 37.3300, lng: -121.9030, units: 620, affordPct: 35, retailSqft: 45000, desc: "28-acre master P3 transit village connecting BART, Caltrain, Amtrak, and ACE." },
        { name: "Alameda / SAP Center Gateway", lat: 37.3400, lng: -121.9150, units: 410, affordPct: 30, retailSqft: 28000, desc: "Sports and entertainment district active transportation connection." },
        { name: "Santa Clara Transit Center / University", lat: 37.3530, lng: -121.9360, units: 480, affordPct: 35, retailSqft: 32000, desc: "Santa Clara University and regional employment center connector." }
      ] : [
        { name: "Salesforce Transit Center (Anchor Hub)", lat: 37.7895, lng: -122.3970, units: 650, affordPct: 35, retailSqft: 52000, desc: "5.4-acre rooftop park over premier multimodal underground rail terminal." },
        { name: "4th & King Caltrain Terminal", lat: 37.7765, lng: -122.3945, units: 540, affordPct: 35, retailSqft: 38000, desc: "Mission Bay life sciences and regional commuter rail interchange." },
        { name: "22nd Street / Dogpatch", lat: 37.7570, lng: -122.3925, units: 390, affordPct: 35, retailSqft: 26000, desc: "Historic industrial arts and waterfront TOD infill." }
      ],
      corridorDesc: "Brings Caltrain electrified passenger rail and future CA High-Speed Rail into downtown transit hubs with high-density air-rights TOD.",
      p3Type: "Public Agency Air-Rights 99-Year Ground Lease with Prevailing Wage & Mass Timber Accord",
      units: 620,
      affordPct: 35,
      retailSqft: 45000,
      baseIRR: 15.8,
      baseGroundLease: 2400000,
      baseHomeLiftPct: 8.5,
      baseBoardingBoostPct: 52,
      bikewayName: "Embarcadero & Guadalupe River Trail Grade-Separated Cycle Track",
      bikewayDesc: "Class I cycleway linking regional transit terminals directly to waterfront and urban tech corridors.",
      bikewayCost: 5200000,
      bikewayHomeLift: 3.8,
      bikewayRidership: 19,
      treeSpecies: "Coast Live Oak, Ginkgo Biloba, Arbutus 'Marina' & Monterey Cypress",
      treeCount: 2100,
      treeCost: 1850000,
      treeTempDrop: 4.8,
      treeHomeLift: 2.9,
      evStalls: 28,
      evKw: 300,
      evCost: 1350000,
      evAnnualMargin: 112000,
      evCo2Tons: 460,
      plazaRetailSqft: 28000,
      plazaRetailCost: 3800000,
      plazaAnnualRent: 950000,
      localSalesTax: 720000,
      tdc: 138000000,
      seniorDebt: 75900000,
      tifiaLoan: 20700000,
      developerEquity: 41400000,
      noi: 10200000
    };
  }
'''

MIAMI_P3 = '''  // Miami-Dade County, FL
  if (fips === "12086" || city.includes("miami") || city.includes("coral gables") || city.includes("hialeah")) {
    return {
      fips: "12086",
      metroName: "Miami-Dade · SMART Program South Dade TransitWay",
      title: "South Dade TransitWay Bus Rapid Transit (BRT) & Station P3 Mixed-Use Village",
      agency: "Miami-Dade Dept of Transportation and Public Works (DTPW)",
      status: "Active Construction & Testing (Opening 2025) · 14 Full BRT Stations with Level Boarding",
      hubName: "Dadeland South Multimodal Transit Hub",
      hubLat: 25.6840,
      hubLng: -80.3150,
      corridorRings: [[25.6840, -80.3150], [25.6260, -80.3540], [25.5820, -80.3510], [25.5560, -80.3620], [25.4480, -80.4780]],
      stations: [
        { name: "Dadeland South Hub (Anchor)", lat: 25.6840, lng: -80.3150, units: 580, affordPct: 30, retailSqft: 36000, desc: "Metrorail terminus connection and high-density suburban-to-urban transition." },
        { name: "Richmond Heights / Coral Reef", lat: 25.6260, lng: -80.3540, units: 360, affordPct: 35, retailSqft: 22000, desc: "Historic neighborhood commercial center and community health clinic." },
        { name: "Cutler Bay / Marlin Road", lat: 25.5820, lng: -80.3510, units: 410, affordPct: 30, retailSqft: 26000, desc: "Municipal center and shopping corridor redevelopment." },
        { name: "South Miami Heights / SW 200th", lat: 25.5560, lng: -80.3620, units: 340, affordPct: 35, retailSqft: 20000, desc: "Workforce infill housing and daycare facility." },
        { name: "Florida City / Homestead Gateway", lat: 25.4480, lng: -80.4780, units: 380, affordPct: 30, retailSqft: 24000, desc: "Southern terminus and Everglades agricultural gateway." }
      ],
      corridorDesc: "20-mile dedicated transitway connecting Dadeland Metrorail to Florida City with gold-standard center stations and signal preemption.",
      p3Type: "County Transit-Supportive Joint Development Ground Lease (Florida Live Local Act SB 102 Infill)",
      units: 580,
      affordPct: 30,
      retailSqft: 36000,
      baseIRR: 16.5,
      baseGroundLease: 1650000,
      baseHomeLiftPct: 7.0,
      baseBoardingBoostPct: 45,
      bikewayName: "South Dade Rail Trail (Flanking TransitWay)",
      bikewayDesc: "20.5-mile continuous paved Class I shared-use path running directly parallel to the transitway from Kendall to Florida City.",
      bikewayCost: 3800000,
      bikewayHomeLift: 3.4,
      bikewayRidership: 15,
      treeSpecies: "Southern Live Oak, Gumbo Limbo, Royal Palm & Paradise Tree (Hurricane Resilient)",
      treeCount: 1650,
      treeCost: 1350000,
      treeTempDrop: 6.2,
      treeHomeLift: 2.8,
      evStalls: 24,
      evKw: 250,
      evCost: 1050000,
      evAnnualMargin: 82000,
      evCo2Tons: 360,
      plazaRetailSqft: 24000,
      plazaRetailCost: 3200000,
      plazaAnnualRent: 760000,
      localSalesTax: 580000,
      tdc: 112000000,
      seniorDebt: 61600000,
      tifiaLoan: 16800000,
      developerEquity: 33600000,
      noi: 8400000
    };
  }
'''

DC_P3 = '''  // Washington DC / National Capital Region (DC, Montgomery MD, Fairfax VA)
  if (fips === "11001" || fips === "24031" || fips === "51059" || city.includes("washington") || city.includes("bethesda") || city.includes("silver spring") || city.includes("arlington")) {
    return {
      fips: fips === "24031" ? "24031" : fips === "51059" ? "51059" : "11001",
      metroName: "National Capital Region · Purple Line Light Rail",
      title: "Purple Line 16-Mile Light Rail & Capital Crescent Trail P3 Corridor",
      agency: "Maryland Transit Administration (MTA) & WMATA",
      status: "Active Construction (Opening 2027) · Design-Build-Finance-Operate-Maintain (DBFOM) P3",
      hubName: "Bethesda South Multi-Modal Station Hub",
      hubLat: 38.9840,
      hubLng: -77.0940,
      corridorRings: [[38.9840, -77.0940], [38.9940, -77.0310], [38.9920, -76.9880], [38.9780, -76.9280], [38.9480, -76.8720]],
      stations: [
        { name: "Bethesda South Multi-Modal Hub (Anchor)", lat: 38.9840, lng: -77.0940, units: 520, affordPct: 35, retailSqft: 34000, desc: "Direct underground connection to Red Line Metro and Capital Crescent Trail tunnel." },
        { name: "Silver Spring Transit Center", lat: 38.9940, lng: -77.0310, units: 480, affordPct: 35, retailSqft: 30000, desc: "Regional rail MARC, Metro Red Line, and county bus interchange." },
        { name: "Takoma Langley Crossroads", lat: 38.9920, lng: -76.9880, units: 390, affordPct: 40, retailSqft: 24000, desc: "Multicultural commercial core and small-business market hall." },
        { name: "College Park / University of MD", lat: 38.9780, lng: -76.9280, units: 550, affordPct: 35, retailSqft: 36000, desc: "University research discovery district and student housing." },
        { name: "New Carrollton Amtrak/MARC/Orange Hub", lat: 38.9480, lng: -76.8720, units: 620, affordPct: 35, retailSqft: 40000, desc: "Major regional TOD master plan and high-speed rail portal." }
      ],
      corridorDesc: "16-mile 21-station orbital light rail connecting major Maryland suburbs, five Metrorail stations, and two MARC commuter rail lines.",
      p3Type: "Full Public-Private Partnership Concession with Station Joint Development Rights",
      units: 520,
      affordPct: 35,
      retailSqft: 34000,
      baseIRR: 15.5,
      baseGroundLease: 1750000,
      baseHomeLiftPct: 7.8,
      baseBoardingBoostPct: 46,
      bikewayName: "Capital Crescent Trail (Rebuilt Paved Rail-with-Trail)",
      bikewayDesc: "Rebuilt 12-ft paved off-street rail-with-trail extending continuously from Georgetown and Bethesda to Silver Spring.",
      bikewayCost: 4600000,
      bikewayHomeLift: 3.7,
      bikewayRidership: 16,
      treeSpecies: "Willow Oak, Red Maple, Eastern Redbud & White Oak",
      treeCount: 1750,
      treeCost: 1400000,
      treeTempDrop: 5.6,
      treeHomeLift: 2.8,
      evStalls: 22,
      evKw: 250,
      evCost: 980000,
      evAnnualMargin: 78000,
      evCo2Tons: 340,
      plazaRetailSqft: 24000,
      plazaRetailCost: 3100000,
      plazaAnnualRent: 740000,
      localSalesTax: 560000,
      tdc: 116000000,
      seniorDebt: 63800000,
      tifiaLoan: 17400000,
      developerEquity: 34800000,
      noi: 8650000
    };
  }
'''

DFW_P3 = '''  // Dallas-Fort Worth / Dallas & Tarrant County, TX
  if (fips === "48113" || fips === "48439" || city.includes("dallas") || city.includes("fort worth") || city.includes("plano") || city.includes("irving")) {
    return {
      fips: fips === "48439" ? "48439" : "48113",
      metroName: "Dallas-Fort Worth · DART Silver Line",
      title: "DART Silver Line Regional Passenger Rail & Station TOD Pipeline",
      agency: "Dallas Area Rapid Transit (DART) & North Central Texas COG",
      status: "Revenue Service Readiness (Opening 2025-2026) · 26 Miles Across 7 Cities",
      hubName: "Cypress Waters TOD Station Hub",
      hubLat: 32.9320,
      hubLng: -96.9820,
      corridorRings: [[32.9050, -97.0400], [32.9320, -96.9820], [32.9510, -96.8900], [32.9600, -96.8280], [32.9980, -96.7080], [33.0180, -96.6650]],
      stations: [
        { name: "DFW Airport Terminal B", lat: 32.9050, lng: -97.0400, units: 340, affordPct: 30, retailSqft: 22000, desc: "Global airport connector and TEXRail commuter train interchange." },
        { name: "Cypress Waters Hub (Anchor)", lat: 32.9320, lng: -96.9820, units: 540, affordPct: 30, retailSqft: 38000, desc: "Master-planned lakeside urban mixed-use community with 18 fast EV stalls." },
        { name: "Downtown Carrollton Junction", lat: 32.9510, lng: -96.8900, units: 410, affordPct: 30, retailSqft: 28000, desc: "Interchange with DART Green Line and historic downtown square." },
        { name: "Addison Transit Center", lat: 32.9600, lng: -96.8280, units: 480, affordPct: 30, retailSqft: 32000, desc: "Culinary arts and entertainment district multimodal terminal." },
        { name: "CityLine / Bush Interchange", lat: 32.9980, lng: -96.7080, units: 580, affordPct: 30, retailSqft: 40000, desc: "State Farm regional headquarters campus and DART Red Line transfer." },
        { name: "Shiloh Road / Plano Terminus", lat: 33.0180, lng: -96.6650, units: 380, affordPct: 30, retailSqft: 24000, desc: "Eastern corridor employment center and park-and-ride facility." }
      ],
      corridorDesc: "26-mile regional passenger rail corridor connecting DFW Airport to northern suburbs and employment corridors.",
      p3Type: "Transit Agency Station Property Ground Lease & Tax-Increment Reinvestment Zone (TIRZ)",
      units: 540,
      affordPct: 30,
      retailSqft: 38000,
      baseIRR: 15.6,
      baseGroundLease: 1380000,
      baseHomeLiftPct: 6.9,
      baseBoardingBoostPct: 40,
      bikewayName: "Cotton Belt Regional Veloway Trail",
      bikewayDesc: "26-mile continuous paved trail parallel to the rail line providing off-street regional connectivity.",
      bikewayCost: 3900000,
      bikewayHomeLift: 3.2,
      bikewayRidership: 14,
      treeSpecies: "Chinquapin Oak, Cedar Elm, Shumard Oak & Bald Cypress",
      treeCount: 1500,
      treeCost: 1250000,
      treeTempDrop: 5.8,
      treeHomeLift: 2.6,
      evStalls: 18,
      evKw: 200,
      evCost: 820000,
      evAnnualMargin: 66000,
      evCo2Tons: 280,
      plazaRetailSqft: 20000,
      plazaRetailCost: 2600000,
      plazaAnnualRent: 620000,
      localSalesTax: 480000,
      tdc: 98000000,
      seniorDebt: 53900000,
      tifiaLoan: 14700000,
      developerEquity: 29400000,
      noi: 7250000
    };
  }
'''

NYC_P3 = '''  // New York City / Queens, Brooklyn, Bronx, Manhattan
  if (fips === "36081" || fips === "36047" || fips === "36005" || fips === "36061" || city.includes("new york") || city.includes("brooklyn") || city.includes("queens")) {
    return {
      fips: fips === "36047" ? "36047" : "36081",
      metroName: "New York City · MTA Interborough Express (IBX)",
      title: "MTA Interborough Express (IBX) Light Rail & Equitable Brooklyn-Queens TOD",
      agency: "Metropolitan Transportation Authority (MTA) & NYC Dept of City Planning",
      status: "FTA Environmental Review & Engineering · City of Yes for Housing Opportunity Infill",
      hubName: "Broadway Junction Regional Mega-Hub",
      hubLat: 40.6780,
      hubLng: -73.9030,
      corridorRings: [[40.7460, -73.8910], [40.7125, -73.8890], [40.6995, -73.9110], [40.6780, -73.9030], [40.6450, -74.0240]],
      stations: [
        { name: "Jackson Heights / Roosevelt Ave", lat: 40.7460, lng: -73.8910, units: 620, affordPct: 40, retailSqft: 45000, desc: "Major northern interchange with 7, E, F, M, R subway lines." },
        { name: "Middle Village / Metropolitan Ave", lat: 40.7125, lng: -73.8890, units: 410, affordPct: 35, retailSqft: 28000, desc: "M train connector and neighborhood retail revitalisation." },
        { name: "Myrtle–Wyckoff Avenues Hub", lat: 40.6995, lng: -73.9110, units: 480, affordPct: 40, retailSqft: 32000, desc: "L and M subway transfer and vibrant pedestrian plaza." },
        { name: "Broadway Junction Mega-Hub (Anchor)", lat: 40.6780, lng: -73.9030, units: 750, affordPct: 45, retailSqft: 55000, desc: "Historic transfer station overhaul connecting A, C, J, Z, L, LIRR, and IBX." },
        { name: "Brooklyn Army Terminal / Bay Ridge", lat: 40.6450, lng: -74.0240, units: 510, affordPct: 40, retailSqft: 35000, desc: "Waterfront industrial innovation campus and NYC Ferry interchange." }
      ],
      corridorDesc: "14-mile light rail operating along the Bay Ridge Branch freight ROW linking 17 subway lines between Brooklyn and Queens without entering Manhattan.",
      p3Type: "MTA Surplus Air Rights & NYC EDC Industrial-Residential Mixed P3 Concession",
      units: 750,
      affordPct: 45,
      retailSqft: 55000,
      baseIRR: 16.0,
      baseGroundLease: 2850000,
      baseHomeLiftPct: 8.8,
      baseBoardingBoostPct: 55,
      bikewayName: "Brooklyn-Queens Rail-with-Trail Active Mobility Corridor",
      bikewayDesc: "Off-street paved greenway running alongside the historic railway connecting neighborhood parks and transit stations.",
      bikewayCost: 5800000,
      bikewayHomeLift: 4.2,
      bikewayRidership: 21,
      treeSpecies: "London Planetree, Honey Locust, Swamp White Oak & Ginkgo Biloba",
      treeCount: 2400,
      treeCost: 1950000,
      treeTempDrop: 5.2,
      treeHomeLift: 3.2,
      evStalls: 30,
      evKw: 300,
      evCost: 1450000,
      evAnnualMargin: 125000,
      evCo2Tons: 520,
      plazaRetailSqft: 32000,
      plazaRetailCost: 4500000,
      plazaAnnualRent: 1100000,
      localSalesTax: 840000,
      tdc: 155000000,
      seniorDebt: 85250000,
      tifiaLoan: 23250000,
      developerEquity: 46500000,
      noi: 11800000
    };
  }
'''

BOSTON_P3 = '''  // Boston / Greater Boston (Suffolk & Middlesex County, MA)
  if (fips === "25025" || fips === "25017" || city.includes("boston") || city.includes("cambridge") || city.includes("somerville")) {
    return {
      fips: fips === "25017" ? "25017" : "25025",
      metroName: "Greater Boston · MBTA GLX & Somerville Community Path",
      title: "MBTA Green Line Extension (GLX) & Community Path Life Sciences TOD",
      agency: "Massachusetts Bay Transportation Authority (MBTA) & City of Somerville",
      status: "Revenue Service Active · MBTA Communities Act Zoning Overhaul Implemented",
      hubName: "Union Square Somerville Multimodal Hub",
      hubLat: 42.3790,
      hubLng: -71.0940,
      corridorRings: [[42.3705, -71.0770], [42.3790, -71.0940], [42.3835, -71.0880], [42.3875, -71.0970], [42.4080, -71.1160]],
      stations: [
        { name: "Lechmere Multimodal Terminal", lat: 42.3705, lng: -71.0770, units: 580, affordPct: 35, retailSqft: 40000, desc: "Cambridge Crossing 45-acre life science and residential transit master plan." },
        { name: "Union Square Hub (Anchor)", lat: 42.3790, lng: -71.0940, units: 520, affordPct: 35, retailSqft: 36000, desc: "2.4M sq ft mixed-use transit district with 16 fast EV bays and civic plaza." },
        { name: "East Somerville Station", lat: 42.3835, lng: -71.0880, units: 360, affordPct: 40, retailSqft: 22000, desc: "Community preservation and workforce residential infill." },
        { name: "Gilman Square / Somerville City Hall", lat: 42.3875, lng: -71.0970, units: 380, affordPct: 40, retailSqft: 24000, desc: "Civic center and Somerville High School direct campus access." },
        { name: "Medford / Tufts University Terminus", lat: 42.4080, lng: -71.1160, units: 450, affordPct: 35, retailSqft: 28000, desc: "University research facilities and regional bus interchange." }
      ],
      corridorDesc: "4.7-mile rapid transit light rail extension connecting Downtown Boston to Somerville and Tufts University.",
      p3Type: "MBTA Communities Act By-Right Zoning Overlay & Joint Development Ground Lease",
      units: 520,
      affordPct: 35,
      retailSqft: 36000,
      baseIRR: 15.5,
      baseGroundLease: 1650000,
      baseHomeLiftPct: 8.0,
      baseBoardingBoostPct: 46,
      bikewayName: "Somerville Community Path Extension",
      bikewayDesc: "Continuous 10-ft wide off-street paved cycle track built inside the rail ROW extending the Minuteman Bikeway into Boston.",
      bikewayCost: 4100000,
      bikewayHomeLift: 3.8,
      bikewayRidership: 17,
      treeSpecies: "Red Maple, American Elm ('Princeton'), River Birch & Sweetgum",
      treeCount: 1600,
      treeCost: 1320000,
      treeTempDrop: 4.8,
      treeHomeLift: 2.8,
      evStalls: 16,
      evKw: 200,
      evCost: 750000,
      evAnnualMargin: 58000,
      evCo2Tons: 250,
      plazaRetailSqft: 22000,
      plazaRetailCost: 2800000,
      plazaAnnualRent: 690000,
      localSalesTax: 520000,
      tdc: 104000000,
      seniorDebt: 57200000,
      tifiaLoan: 15600000,
      developerEquity: 31200000,
      noi: 7700000
    };
  }
'''

PHILLY_P3 = '''  // Philadelphia / Philadelphia County, PA
  if (fips === "42101" || city.includes("philadelphia")) {
    return {
      fips: "42101",
      metroName: "Southeastern PA · SEPTA High-Capacity Transit Pipeline",
      title: "Roosevelt Boulevard Subway & Market-Frankford Line Modernization P3",
      agency: "Southeastern Pennsylvania Transportation Authority (SEPTA) & City of Philadelphia",
      status: "Alternatives Analysis & Environmental Review · RAISE Planning Grant Recipient",
      hubName: "Roosevelt Boulevard & Cottman Ave Hub",
      hubLat: 40.0380,
      hubLng: -75.0560,
      corridorRings: [[39.9555, -75.1820], [40.0160, -75.1430], [40.0290, -75.1120], [40.0380, -75.0560], [40.0880, -74.9950]],
      stations: [
        { name: "30th Street Station Regional Mega-Hub", lat: 39.9555, lng: -75.1820, units: 680, affordPct: 35, retailSqft: 48000, desc: "Amtrak Northeast Corridor, regional rail, and trolley multimodal terminal." },
        { name: "Roosevelt Blvd & Broad / Hunting Park", lat: 40.0160, lng: -75.1430, units: 420, affordPct: 40, retailSqft: 26000, desc: "Broad Street Subway express transfer and park gateway." },
        { name: "Roosevelt & Adams / Rising Sun", lat: 40.0290, lng: -75.1120, units: 360, affordPct: 40, retailSqft: 22000, desc: "Commercial core and neighborhood health clinic integration." },
        { name: "Roosevelt & Cottman Hub (Anchor)", lat: 40.0380, lng: -75.0560, units: 490, affordPct: 40, retailSqft: 32000, desc: "Northeast Philadelphia anchor retail and fast EV charging plaza." },
        { name: "Roosevelt & Bustleton / Woodhaven Terminus", lat: 40.0880, lng: -74.9950, units: 440, affordPct: 35, retailSqft: 28000, desc: "Regional bus hub and park-and-ride facility." }
      ],
      corridorDesc: "12-mile heavy rail subway along Roosevelt Boulevard eliminating dangerous highway crossings and connecting Northeast Philly to Center City.",
      p3Type: "SEPTA Transit-Oriented Real Estate Concession & Federal Capital Investment Grant",
      units: 490,
      affordPct: 40,
      retailSqft: 32000,
      baseIRR: 15.2,
      baseGroundLease: 1350000,
      baseHomeLiftPct: 7.4,
      baseBoardingBoostPct: 42,
      bikewayName: "Pennypack Trail & Roosevelt Boulevard Active Corridor",
      bikewayDesc: "Separated multi-use active transit path connecting the riverfront and Pennypack Park to Boulevard stations.",
      bikewayCost: 3500000,
      bikewayHomeLift: 3.5,
      bikewayRidership: 15,
      treeSpecies: "London Planetree, Eastern Redbud, Willow Oak & Tulip Poplar",
      treeCount: 1700,
      treeCost: 1380000,
      treeTempDrop: 5.7,
      treeHomeLift: 2.7,
      evStalls: 18,
      evKw: 200,
      evCost: 800000,
      evAnnualMargin: 64000,
      evCo2Tons: 270,
      plazaRetailSqft: 20000,
      plazaRetailCost: 2600000,
      plazaAnnualRent: 630000,
      localSalesTax: 490000,
      tdc: 94000000,
      seniorDebt: 51700000,
      tifiaLoan: 14100000,
      developerEquity: 28200000,
      noi: 6900000
    };
  }
'''

NEW_METROS = CHICAGO_P3 + "\n" + ATLANTA_P3 + "\n" + SF_BAY_P3 + "\n" + MIAMI_P3 + "\n" + DC_P3 + "\n" + DFW_P3 + "\n" + NYC_P3 + "\n" + BOSTON_P3 + "\n" + PHILLY_P3

# Insert into getMetroPipeline right before // Nationwide Default
target_marker = "  // Nationwide Default for any US County"
if target_marker in content:
    content = content.replace(target_marker, NEW_METROS + "\n" + target_marker, 1)
    print("Successfully inserted 9 new metro pipelines into getMetroPipeline")
else:
    print("WARNING: target_marker for getMetroPipeline not found")

# Write out the intermediate result
with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated file size after adding pipelines:", len(content))
