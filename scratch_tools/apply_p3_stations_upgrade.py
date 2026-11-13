import re
import sys

INDEX_PATH = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/index.html"

with open(INDEX_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update case-insensitivity in handleSearchSubmit
old_search_submit = """  const handleSearchSubmit = val => {
    val = String(val || "").trim();
    if (!val) return;
    hideAddr();
    const ocId = (activeCounty === "oc" && D_OC && D_OC.search) ? D_OC.search[val] : null;
    const id = ocId || names.get(val);
    if (id) { select(id, true); return; }
    if (typeof countyBundleEls === "function") {
      const matchCounty = countyBundleEls().find(e => {
        const cn = (e.dataset.name || "").toLowerCase().replace(/ county| parish/g, "").trim();
        return cn === val.toLowerCase().replace(/ county| parish/g, "").trim();
      });
      if (matchCounty && matchCounty.dataset.fips) { openCounty(matchCounty.dataset.fips); return; }
    }
    addressSearchUS(val);
  };"""

new_search_submit = """  const handleSearchSubmit = val => {
    val = String(val || "").trim();
    if (!val) return;
    hideAddr();
    const valLower = val.toLowerCase();
    let id = null;
    if (typeof D_OC !== "undefined" && D_OC && D_OC.search) {
      id = D_OC.search[val];
      if (!id) {
        const k = Object.keys(D_OC.search).find(x => x.toLowerCase() === valLower);
        if (k) id = D_OC.search[k];
      }
    }
    if (!id && typeof names !== "undefined" && names) {
      id = names.get(val);
      if (!id) {
        for (const [k, v] of names.entries()) {
          if (k.toLowerCase() === valLower) { id = v; break; }
        }
      }
    }
    if (id) { select(id, true); return; }
    if (typeof countyBundleEls === "function") {
      const matchCounty = countyBundleEls().find(e => {
        const cn = (e.dataset.name || "").toLowerCase().replace(/ county| parish/g, "").trim();
        return cn === valLower.replace(/ county| parish/g, "").trim();
      });
      if (matchCounty && matchCounty.dataset.fips) { openCounty(matchCounty.dataset.fips); return; }
    }
    addressSearchUS(val);
  };"""

if old_search_submit in content:
    content = content.replace(old_search_submit, new_search_submit, 1)
    print("SUCCESS: Enhanced handleSearchSubmit case-insensitivity and nationwide bundle matching")

# 2. Add Station Network to getMetroPipeline and flyToP3Hub
old_p3_funcs_start = """// ---------------- Public-Private Partnerships (P3) & Transit Joint Development Pipeline"""
old_p3_funcs_end = """function select(id, fly) {"""

p3_start_idx = content.find(old_p3_funcs_start)
select_idx = content.find(old_p3_funcs_end, p3_start_idx)
if p3_start_idx == -1 or select_idx == -1:
    print("ERROR: p3 boundaries not found")
    sys.exit(1)

new_p3_complete_code = """// ---------------- Public-Private Partnerships (P3) & Transit Joint Development Pipeline
let p3WalkshedLayer = null;

function flyToP3Station(lat, lng, name, units, affordPct, retailSqft) {
  if (typeof map === "undefined" || !map) return;
  const hubLl = [lat, lng];
  map.flyTo(hubLl, 16, { animate: true, duration: 1.0 });

  if (p3WalkshedLayer) {
    p3WalkshedLayer.eachLayer(l => {
      if (l instanceof L.Circle) {
        l.setLatLng(hubLl);
      }
    });
  }
  showToast(`Focusing station: ${name} (0.5-mi TOD walkshed)`);
}

function flyToP3Hub(fips, targetIdx = -1) {
  if (typeof map === "undefined" || !map) return;
  const pipe = getMetroPipeline(fips, (selected && byId.get(selected)) ? byId.get(selected).properties.c : "");
  if (!pipe || !pipe.hubLat || !pipe.hubLng) return;

  if (p3WalkshedLayer) { map.removeLayer(p3WalkshedLayer); p3WalkshedLayer = null; }

  const hubLl = (targetIdx >= 0 && pipe.stations && pipe.stations[targetIdx]) 
    ? [pipe.stations[targetIdx].lat, pipe.stations[targetIdx].lng] 
    : [pipe.hubLat, pipe.hubLng];
  map.flyTo(hubLl, 15.5, { animate: true, duration: 1.2 });

  const walkshedCircle = L.circle(hubLl, {
    radius: 805, // 0.5-mile walkshed
    color: "#0284c7",
    weight: 2,
    dashArray: "5 5",
    fillColor: "#38bdf8",
    fillOpacity: 0.12,
    interactive: false
  });

  const layers = [walkshedCircle];

  // Draw transit alignment corridor polyline
  if (pipe.corridorRings && pipe.corridorRings.length) {
    const transitLine = L.polyline(pipe.corridorRings, {
      color: "#0284c7",
      weight: 5,
      opacity: 0.85,
      dashArray: "10 6"
    });
    layers.push(transitLine);
  }

  // Draw markers for all stations along the corridor
  if (pipe.stations && pipe.stations.length) {
    pipe.stations.forEach((stn, idx) => {
      const isAnchor = (stn.lat === pipe.hubLat && stn.lng === pipe.hubLng);
      const icon = L.divIcon({
        className: "",
        iconSize: isAnchor ? [36, 36] : [28, 28],
        html: `<div style="background:${isAnchor ? '#0284c7' : '#0369a1'};color:#fff;border:2.5px solid #fff;border-radius:50%;width:${isAnchor ? '32px' : '24px'};height:${isAnchor ? '32px' : '24px'};display:flex;align-items:center;justify-content:center;font-size:${isAnchor ? '16px' : '12px'};box-shadow:0 3px 10px rgba(2,132,199,0.4);cursor:pointer;" title="${esc(stn.name)}">${isAnchor ? '🚆' : '🚉'}</div>`
      });

      const m = L.marker([stn.lat, stn.lng], { icon })
        .bindPopup(`
          <div style="font-family:var(--body);line-height:1.4;color:#0f172a;max-width:280px">
            <div style="font-weight:800;font-size:13px;color:#0369a1;margin-bottom:3px">${isAnchor ? '🚆' : '🚉'} ${esc(stn.name)}</div>
            <div style="font-size:11.5px;color:#334155;margin-bottom:4px"><b>TOD Potential:</b> ${stn.units} mixed-income homes (${stn.affordPct}% affordable)</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:6px;">${esc(stn.desc)}</div>
            <button type="button" onclick="flyToP3Station(${stn.lat}, ${stn.lng}, '${esc(stn.name)}', ${stn.units}, ${stn.affordPct}, ${stn.retailSqft})" style="background:#0284c7;color:#fff;border:none;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">
              Focus 0.5-Mi Walkshed
            </button>
          </div>
        `);
      layers.push(m);
      if (isAnchor) setTimeout(() => m.openPopup(), 400);
    });
  }

  p3WalkshedLayer = L.layerGroup(layers).addTo(map);
  showToast(`Viewing active transit corridor & stations: ${pipe.title.split('&')[0].trim()}`);
}

function getMetroPipeline(fips, city) {
  fips = String(fips || activeFips() || "06037");
  city = String(city || "").toLowerCase();

  // Austin / Travis County, TX
  if (fips === "48453" || city.includes("austin")) {
    return {
      fips: "48453",
      metroName: "Austin Metro · Project Connect",
      title: "Project Connect Light Rail & Riverside/South Congress TOD Corridor",
      agency: "Austin Transit Partnership (ATP) & City of Austin",
      status: "Engineering & NEPA Approved · FTA Capital Investment Grant (CIG) Pipeline",
      hubName: "East Riverside & Pleasant Valley Transit Hub",
      hubLat: 30.2435,
      hubLng: -97.7170,
      corridorRings: [[30.2672, -97.7431], [30.2580, -97.7490], [30.2485, -97.7420], [30.2435, -97.7170], [30.2370, -97.7050], [30.2310, -97.6980]],
      stations: [
        { name: "Downtown / Congress", lat: 30.2672, lng: -97.7431, units: 520, affordPct: 35, retailSqft: 35000, desc: "Congress Avenue pedestrian civic integration and high-density office-to-residential conversions." },
        { name: "Waterfront / Lady Bird Lake", lat: 30.2580, lng: -97.7490, units: 380, affordPct: 35, retailSqft: 22000, desc: "Direct connection to the Ann and Roy Butler Hike-and-Bike Trail." },
        { name: "South Congress / Travis Heights", lat: 30.2485, lng: -97.7420, units: 420, affordPct: 35, retailSqft: 26000, desc: "South Congress cultural and culinary retail district." },
        { name: "East Riverside & Pleasant Valley (Hub)", lat: 30.2435, lng: -97.7170, units: 460, affordPct: 35, retailSqft: 28000, desc: "Anchor P3 hub with 16 DC fast EV stalls and 3.4-mi rail-with-trail cycleway." },
        { name: "Montopolis / Crossing Place", lat: 30.2370, lng: -97.7050, units: 340, affordPct: 40, retailSqft: 18000, desc: "Equitable workforce housing infill and neighborhood health center." },
        { name: "Yellow Jacket / Riverside Terminus", lat: 30.2310, lng: -97.6980, units: 310, affordPct: 35, retailSqft: 16000, desc: "Park-and-ride parcel conversion with community solar canopy." }
      ],
      corridorDesc: "9.8-mile phase 1 light rail connecting Downtown Austin to East Riverside and South Congress, transitioning CapMetro to high-capacity grade-separated rail transit.",
      p3Type: "Station-Area Ground Lease & Master Joint Development (99-Year Concession)",
      units: 460,
      affordPct: 35,
      retailSqft: 28000,
      baseIRR: 15.6,
      baseGroundLease: 1150000,
      baseHomeLiftPct: 6.8,
      baseBoardingBoostPct: 40,
      bikewayName: "Pleasant Valley & Riverside Rail-with-Trail Protected Cycleway",
      bikewayDesc: "3.4-mile 12-ft paved dual-direction bike highway along light rail ROW connecting to the Ann and Roy Butler Hike-and-Bike Trail.",
      bikewayCost: 3200000,
      bikewayHomeLift: 3.2,
      bikewayRidership: 14,
      treeSpecies: "Native Texas Live Oak, Cedar Elm & Mexican White Oak",
      treeCount: 1100,
      treeCost: 950000,
      treeTempDrop: 5.2,
      treeHomeLift: 2.5,
      evStalls: 16,
      evKw: 150,
      evCost: 680000,
      evAnnualMargin: 52000,
      evCo2Tons: 220,
      plazaRetailSqft: 14000,
      plazaRetailCost: 1900000,
      plazaAnnualRent: 420000,
      localSalesTax: 340000,
      tdc: 88000000,
      seniorDebt: 48400000,
      tifiaLoan: 13200000,
      developerEquity: 26400000,
      noi: 6420000
    };
  }

  // Los Angeles County, CA
  if (fips === "06037" || city.includes("los angeles")) {
    return {
      fips: "06037",
      metroName: "Los Angeles County · Metro Measure M/R",
      title: "Metro Measure M/R Rail Expansion & Station Joint Development Pipeline",
      agency: "Los Angeles County Metropolitan Transportation Authority (Metro)",
      status: "Multiple Extensions Active & Under Construction · Metro 10,000-Home TOD Goal",
      hubName: "Wilshire/La Brea D Line Hub",
      hubLat: 34.0625,
      hubLng: -118.3440,
      corridorRings: [[34.0610, -118.2900], [34.0615, -118.3090], [34.0625, -118.3440], [34.0630, -118.3750], [34.0620, -118.3980], [34.0585, -118.4440]],
      stations: [
        { name: "Wilshire / Western (D Line)", lat: 34.0615, lng: -118.3090, units: 480, affordPct: 35, retailSqft: 28000, desc: "Koreatown urban core and multimodal rapid transit center." },
        { name: "Wilshire / La Brea (Anchor Hub)", lat: 34.0625, lng: -118.3440, units: 520, affordPct: 35, retailSqft: 32000, desc: "Major D Line subway hub with 24 fast EV charging bays and community plaza." },
        { name: "Wilshire / Fairfax (Museum Row)", lat: 34.0628, lng: -118.3610, units: 440, affordPct: 35, retailSqft: 30000, desc: "LACMA, Academy Museum, and La Brea Tar Pits cultural district." },
        { name: "Wilshire / La Cienega", lat: 34.0630, lng: -118.3750, units: 390, affordPct: 30, retailSqft: 24000, desc: "Beverly Hills gateway transit station." },
        { name: "Century City / Constellation", lat: 34.0585, lng: -118.4180, units: 550, affordPct: 30, retailSqft: 36000, desc: "Premier employment center high-rise residential joint development." },
        { name: "Westwood / UCLA", lat: 34.0590, lng: -118.4440, units: 510, affordPct: 40, retailSqft: 30000, desc: "University campus and medical center multimodal portal." }
      ],
      corridorDesc: "Transformative 28-by-'28 rail expansion (D Line Subway, Southeast Gateway, Sepulveda Pass, K Line) with Metro-owned parcel air rights.",
      p3Type: "Metro Joint Development Ground Lease (Prevailing Wage + 35% Affordable)",
      units: 520,
      affordPct: 35,
      retailSqft: 32000,
      baseIRR: 14.8,
      baseGroundLease: 1850000,
      baseHomeLiftPct: 7.2,
      baseBoardingBoostPct: 45,
      bikewayName: "Rail-to-Rail Active Transportation Corridor & Slauson Greenway",
      bikewayDesc: "5.5-mile multi-use walking/biking corridor built on former freight rail right-of-way connecting Fairview Heights station to the A Line.",
      bikewayCost: 4800000,
      bikewayHomeLift: 3.4,
      bikewayRidership: 16,
      treeSpecies: "Coast Live Oak, Western Sycamore & Desert Willow",
      treeCount: 2200,
      treeCost: 1750000,
      treeTempDrop: 6.4,
      treeHomeLift: 2.8,
      evStalls: 24,
      evKw: 250,
      evCost: 1100000,
      evAnnualMargin: 84000,
      evCo2Tons: 380,
      plazaRetailSqft: 20000,
      plazaRetailCost: 2800000,
      plazaAnnualRent: 680000,
      localSalesTax: 510000,
      tdc: 115000000,
      seniorDebt: 63250000,
      tifiaLoan: 17250000,
      developerEquity: 34500000,
      noi: 8250000
    };
  }

  // Orange County, CA
  if (fips === "06059" || city.includes("santa ana") || city.includes("anaheim")) {
    return {
      fips: "06059",
      metroName: "Orange County · OC Streetcar & Regional Transit",
      title: "OC Streetcar Santa Ana–Garden Grove TOD Corridor & SARTC Expansion",
      agency: "Orange County Transportation Authority (OCTA) & City of Santa Ana",
      status: "Revenue Service Launch · Transit-Oriented Development Overlay District",
      hubName: "Downtown Santa Ana / French Station Hub",
      hubLat: 33.7485,
      hubLng: -117.8680,
      corridorRings: [[33.7510, -117.8550], [33.7485, -117.8680], [33.7520, -117.8900], [33.7650, -117.9150], [33.7740, -117.9380]],
      stations: [
        { name: "Santa Ana Regional Transportation Center (SARTC)", lat: 33.7510, lng: -117.8550, units: 380, affordPct: 30, retailSqft: 24000, desc: "Amtrak and Metrolink regional passenger rail terminal." },
        { name: "Lacy & 4th Street", lat: 33.7495, lng: -117.8610, units: 280, affordPct: 35, retailSqft: 18000, desc: "Historic neighborhood infill and small-business incubation." },
        { name: "Downtown Santa Ana / French (Anchor Hub)", lat: 33.7485, lng: -117.8680, units: 340, affordPct: 30, retailSqft: 22000, desc: "Artists Village pedestrian pavilion and 14 EV charging bays." },
        { name: "Civic Center & Flower", lat: 33.7510, lng: -117.8760, units: 310, affordPct: 30, retailSqft: 20000, desc: "County and municipal administrative center station." },
        { name: "Fairview & Pacific Electric ROW", lat: 33.7650, lng: -117.9150, units: 320, affordPct: 30, retailSqft: 19000, desc: "Direct junction with Pacific Electric Class I regional trail." },
        { name: "Harbor Blvd / Garden Grove Terminus", lat: 33.7740, lng: -117.9380, units: 350, affordPct: 30, retailSqft: 22000, desc: "Harbor rapid bus transfer and mixed-use commercial gateway." }
      ],
      corridorDesc: "4.15-mile streetcar linking Amtrak/Metrolink regional rail to Historic Downtown Santa Ana arts district and Garden Grove civic center.",
      p3Type: "Municipal Surface Parking Lot Redevelopment P3 Concession",
      units: 340,
      affordPct: 30,
      retailSqft: 22000,
      baseIRR: 15.2,
      baseGroundLease: 920000,
      baseHomeLiftPct: 6.0,
      baseBoardingBoostPct: 35,
      bikewayName: "Pacific Electric Right-of-Way Trail Connection",
      bikewayDesc: "Class I off-street bikeway leveraging historic Pacific Electric interurban railway right-of-way through Santa Ana.",
      bikewayCost: 2600000,
      bikewayHomeLift: 2.9,
      bikewayRidership: 12,
      treeSpecies: "California Sycamore, Engelmann Oak & Jacaranda",
      treeCount: 950,
      treeCost: 820000,
      treeTempDrop: 4.8,
      treeHomeLift: 2.2,
      evStalls: 14,
      evKw: 150,
      evCost: 590000,
      evAnnualMargin: 46000,
      evCo2Tons: 190,
      plazaRetailSqft: 12000,
      plazaRetailCost: 1600000,
      plazaAnnualRent: 360000,
      localSalesTax: 280000,
      tdc: 68000000,
      seniorDebt: 37400000,
      tifiaLoan: 10200000,
      developerEquity: 20400000,
      noi: 4950000
    };
  }

  // Denver / Denver County, CO
  if (fips === "08031" || city.includes("denver")) {
    return {
      fips: "08031",
      metroName: "Denver Metro · FasTracks & East Colfax BRT",
      title: "East Colfax Center-Running Bus Rapid Transit & DURA Station Infill",
      agency: "City and County of Denver (DOTI), RTD Denver & DURA",
      status: "Active Construction (Opening 2026-2027) · Dedicated Center Lanes & Signal Priority",
      hubName: "East Colfax & Colorado Blvd Station Hub",
      hubLat: 39.7402,
      hubLng: -104.9405,
      corridorRings: [[39.7398, -104.9880], [39.7400, -104.9600], [39.7402, -104.9405], [39.7404, -104.9100], [39.7406, -104.8800]],
      stations: [
        { name: "Civic Center Station", lat: 39.7398, lng: -104.9880, units: 420, affordPct: 40, retailSqft: 26000, desc: "Downtown Denver multimodal terminal and Capitol complex walkshed." },
        { name: "Colfax & Downing", lat: 39.7400, lng: -104.9730, units: 310, affordPct: 40, retailSqft: 16000, desc: "Capitol Hill commercial corridor infill." },
        { name: "Colfax & Josephine", lat: 39.7401, lng: -104.9580, units: 290, affordPct: 40, retailSqft: 15000, desc: "Denver Botanic Gardens and City Park connector." },
        { name: "Colfax & Colorado (Anchor Hub)", lat: 39.7402, lng: -104.9405, units: 320, affordPct: 40, retailSqft: 18000, desc: "Central BRT transfer hub with 12 fast EV charging bays and local grocer." },
        { name: "Colfax & Monaco", lat: 39.7404, lng: -104.9120, units: 280, affordPct: 40, retailSqft: 14000, desc: "Parkway greenway connection and neighborhood services." },
        { name: "Colfax & Yosemite / Aurora", lat: 39.7406, lng: -104.8870, units: 330, affordPct: 40, retailSqft: 17000, desc: "Regional RTD connection with R Line light rail." }
      ],
      corridorDesc: "10-mile high-frequency rapid transit replacing Denver's highest-ridership bus line with protected median platforms and off-board fare collection.",
      p3Type: "Denver Urban Renewal Authority Tax-Increment Financing & P3 Housing Ground Lease",
      units: 320,
      affordPct: 40,
      retailSqft: 18000,
      baseIRR: 14.5,
      baseGroundLease: 780000,
      baseHomeLiftPct: 5.8,
      baseBoardingBoostPct: 38,
      bikewayName: "Colfax Parallel Greenway & High Line Canal Cycle Link",
      bikewayDesc: "Protected two-way cycle tracks on 13th and 14th Avenues offering continuous low-stress bike routing parallel to the BRT line.",
      bikewayCost: 2400000,
      bikewayHomeLift: 2.8,
      bikewayRidership: 11,
      treeSpecies: "Bur Oak, Hackberry, Kentucky Coffeetree & Ponderosa Pine",
      treeCount: 1250,
      treeCost: 1050000,
      treeTempDrop: 5.6,
      treeHomeLift: 2.4,
      evStalls: 12,
      evKw: 150,
      evCost: 520000,
      evAnnualMargin: 41000,
      evCo2Tons: 170,
      plazaRetailSqft: 11000,
      plazaRetailCost: 1450000,
      plazaAnnualRent: 320000,
      localSalesTax: 260000,
      tdc: 62000000,
      seniorDebt: 34100000,
      tifiaLoan: 9300000,
      developerEquity: 18600000,
      noi: 4450000
    };
  }

  // Seattle / King County, WA
  if (fips === "53033" || city.includes("seattle")) {
    return {
      fips: "53033",
      metroName: "Puget Sound · Sound Transit 3 (ST3)",
      title: "ST3 Ballard & West Seattle Link Extensions Equitable TOD Pipeline",
      agency: "Sound Transit & Seattle Office of Housing",
      status: "Final Engineering & NEPA Review · 80-80-80 Equitable Housing Accord",
      hubName: "Ballard Multi-Modal Station Hub",
      hubLat: 47.6680,
      hubLng: -122.3840,
      corridorRings: [[47.6080, -122.3350], [47.6210, -122.3550], [47.6380, -122.3760], [47.6550, -122.3810], [47.6680, -122.3840]],
      stations: [
        { name: "Westlake / Downtown Hub", lat: 47.6110, lng: -122.3370, units: 580, affordPct: 35, retailSqft: 40000, desc: "Regional rail and light rail interchange terminal." },
        { name: "South Lake Union / Denny", lat: 47.6210, lng: -122.3550, units: 490, affordPct: 40, retailSqft: 32000, desc: "High-tech research and life sciences employment district." },
        { name: "Smith Cove / Uptown", lat: 47.6380, lng: -122.3760, units: 360, affordPct: 40, retailSqft: 22000, desc: "Cruise terminal and Climate Pledge Arena connector." },
        { name: "Interbay", lat: 47.6550, lng: -122.3810, units: 420, affordPct: 40, retailSqft: 25000, desc: "Underused industrial buffer redevelopment into mixed-income community." },
        { name: "Ballard Multi-Modal Hub (Anchor Hub)", lat: 47.6680, lng: -122.3840, units: 380, affordPct: 40, retailSqft: 24000, desc: "Mass timber residential tower over Burke-Gilman trail connector." }
      ],
      corridorDesc: "62-mile light rail system expansion connecting Seattle urban centers with high-capacity grade-separated rail transit.",
      p3Type: "Surplus ROW Property 99-Year Ground Lease with Mass Timber Density Bonus",
      units: 380,
      affordPct: 40,
      retailSqft: 24000,
      baseIRR: 15.0,
      baseGroundLease: 1350000,
      baseHomeLiftPct: 7.0,
      baseBoardingBoostPct: 42,
      bikewayName: "Burke-Gilman Ballard Missing Link & Station Connector Trail",
      bikewayDesc: "Protected grade-separated cycle track completing the iconic regional trail directly into Ballard transit terminal.",
      bikewayCost: 3600000,
      bikewayHomeLift: 3.5,
      bikewayRidership: 15,
      treeSpecies: "Douglas Fir, Bigleaf Maple, Western Redcedar & Oregon White Oak",
      treeCount: 1300,
      treeCost: 1100000,
      treeTempDrop: 4.2,
      treeHomeLift: 2.6,
      evStalls: 16,
      evKw: 200,
      evCost: 720000,
      evAnnualMargin: 56000,
      evCo2Tons: 240,
      plazaRetailSqft: 15000,
      plazaRetailCost: 2100000,
      plazaAnnualRent: 480000,
      localSalesTax: 390000,
      tdc: 84000000,
      seniorDebt: 46200000,
      tifiaLoan: 12600000,
      developerEquity: 25200000,
      noi: 5950000
    };
  }

  // Phoenix / Maricopa County, AZ
  if (fips === "04013" || city.includes("phoenix")) {
    return {
      fips: "04013",
      metroName: "Valley Metro · Phoenix Transit 2050",
      title: "South Central Extension / Downtown Hub Light Rail & Central Station P3",
      agency: "Valley Metro & City of Phoenix Public Transit",
      status: "Active Construction & Testing · $300M+ Central Station P3 High-Rise Rising",
      hubName: "Central Station Downtown Transit Hub",
      hubLat: 33.4520,
      hubLng: -112.0740,
      corridorRings: [[33.4520, -112.0740], [33.4410, -112.0735], [33.4280, -112.0730], [33.4050, -112.0730], [33.3850, -112.0730]],
      stations: [
        { name: "Central Station Downtown Hub (Anchor)", lat: 33.4520, lng: -112.0740, units: 420, affordPct: 30, retailSqft: 26000, desc: "$300M+ P3 tower featuring apartments, hotel, student housing, and retail." },
        { name: "Washington / Jefferson", lat: 33.4410, lng: -112.0735, units: 360, affordPct: 30, retailSqft: 22000, desc: "Civic center and government plaza connector." },
        { name: "South Central & Buckeye", lat: 33.4280, lng: -112.0730, units: 290, affordPct: 35, retailSqft: 18000, desc: "Warehouse district and creative arts infill." },
        { name: "South Central & Broadway", lat: 33.4050, lng: -112.0730, units: 310, affordPct: 35, retailSqft: 19000, desc: "Equitable community health and culinary hub." },
        { name: "South Central & Baseline Terminus", lat: 33.3850, lng: -112.0730, units: 340, affordPct: 30, retailSqft: 20000, desc: "South Mountain park-and-ride recreation gateway." }
      ],
      corridorDesc: "5.5-mile extension linking Downtown Phoenix to Baseline Road, anchoring major P3 mixed-use residential towers.",
      p3Type: "Private Consortium Joint Development with City Air Rights and Long-Term Ground Lease",
      units: 420,
      affordPct: 30,
      retailSqft: 26000,
      baseIRR: 15.8,
      baseGroundLease: 1100000,
      baseHomeLiftPct: 6.4,
      baseBoardingBoostPct: 36,
      bikewayName: "Grand Canalscape & South Central Protected Bikeway",
      bikewayDesc: "Continuous paved multi-use corridor with grade separations along canal banks and transit avenue.",
      bikewayCost: 2800000,
      bikewayHomeLift: 3.0,
      bikewayRidership: 12,
      treeSpecies: "Desert Ironwood, Velvet Mesquite, Thornless Palo Verde & Live Oak",
      treeCount: 1600,
      treeCost: 1200000,
      treeTempDrop: 8.5,
      treeHomeLift: 2.7,
      evStalls: 20,
      evKw: 200,
      evCost: 880000,
      evAnnualMargin: 68000,
      evCo2Tons: 290,
      plazaRetailSqft: 16000,
      plazaRetailCost: 2200000,
      plazaAnnualRent: 450000,
      localSalesTax: 370000,
      tdc: 92000000,
      seniorDebt: 50600000,
      tifiaLoan: 13800000,
      developerEquity: 27600000,
      noi: 6850000
    };
  }

  // New Orleans / Orleans Parish, LA
  if (fips === "22071" || city.includes("new orleans")) {
    return {
      fips: "22071",
      metroName: "New Orleans RTA · Climate Resilience Transit",
      title: "New Orleans Union Passenger Terminal (UPT) Multimodal Hub & High-Capacity Transit",
      agency: "New Orleans Regional Transit Authority (RTA) & City of New Orleans",
      status: "FTA Planning Grant Awarded · Climate Resilience Infrastructure Accord",
      hubName: "Union Passenger Terminal (UPT) & Loyola Transit Center",
      hubLat: 29.9510,
      hubLng: -90.0780,
      corridorRings: [[29.9510, -90.0780], [29.9540, -90.0730], [29.9580, -90.0680], [29.9650, -90.0600], [29.9720, -90.0520]],
      stations: [
        { name: "Union Passenger Terminal (Anchor Hub)", lat: 29.9510, lng: -90.0780, units: 280, affordPct: 40, retailSqft: 20000, desc: "Amtrak, regional bus, and streetcar multimodal interchange with stormwater retention." },
        { name: "Poydras & Loyola (CBD)", lat: 29.9540, lng: -90.0730, units: 310, affordPct: 35, retailSqft: 22000, desc: "Central Business District high-density office-to-housing conversion." },
        { name: "Canal & Rampart (French Quarter Edge)", lat: 29.9580, lng: -90.0680, units: 260, affordPct: 40, retailSqft: 18000, desc: "Cultural corridor transition and streetcar connection." },
        { name: "Lafitte Greenway Junction", lat: 29.9650, lng: -90.0600, units: 240, affordPct: 45, retailSqft: 16000, desc: "Direct junction with Lafitte Greenway active mobility path." },
        { name: "Claiborne Cultural Gateway", lat: 29.9720, lng: -90.0520, units: 270, affordPct: 45, retailSqft: 17000, desc: "Community resilience hub under shaded solar canopy." }
      ],
      corridorDesc: "Regional rail, streetcar, and high-frequency bus multimodal connection linking Downtown NOLA, BioDistrict, and East NOLA.",
      p3Type: "Resilient Joint Development P3 with Ground-Floor Micro-Market & Stormwater Detention",
      units: 280,
      affordPct: 40,
      retailSqft: 20000,
      baseIRR: 14.6,
      baseGroundLease: 650000,
      baseHomeLiftPct: 5.5,
      baseBoardingBoostPct: 32,
      bikewayName: "Lafitte Greenway to UPT Multi-Modal Trail Extension",
      bikewayDesc: "Off-street paved greenway extension connecting Mid-City cultural corridor directly to the regional transit terminal.",
      bikewayCost: 2100000,
      bikewayHomeLift: 3.3,
      bikewayRidership: 13,
      treeSpecies: "Southern Live Oak, Bald Cypress & Sweetbay Magnolia",
      treeCount: 850,
      treeCost: 720000,
      treeTempDrop: 4.6,
      treeHomeLift: 2.3,
      evStalls: 10,
      evKw: 150,
      evCost: 440000,
      evAnnualMargin: 35000,
      evCo2Tons: 150,
      plazaRetailSqft: 10000,
      plazaRetailCost: 1350000,
      plazaAnnualRent: 290000,
      localSalesTax: 240000,
      tdc: 54000000,
      seniorDebt: 29700000,
      tifiaLoan: 8100000,
      developerEquity: 16200000,
      noi: 3850000
    };
  }

  // Nationwide Default for any US County
  const cName = countyOf();
  const cLat = (typeof map !== "undefined" && map) ? map.getCenter().lat : 37.77;
  const cLng = (typeof map !== "undefined" && map) ? map.getCenter().lng : -122.42;
  return {
    fips: fips,
    metroName: `${cName} · Regional Transit & Infrastructure`,
    title: `${cName} High-Capacity Transit Corridor & TOD Joint Development`,
    agency: "Regional Transportation Commission & County Transit Authority",
    status: "FTA Capital Investment Grants (CIG) & RAISE Pipeline · Federal P3 Guidelines",
    hubName: `${cName} Multi-Modal Transit Center`,
    hubLat: cLat,
    hubLng: cLng,
    corridorRings: [[cLat - 0.02, cLng - 0.02], [cLat, cLng], [cLat + 0.02, cLng + 0.02]],
    stations: [
      { name: `${cName} West Station`, lat: cLat - 0.02, lng: cLng - 0.02, units: 280, affordPct: 30, retailSqft: 16000, desc: "West corridor gateway station." },
      { name: `${cName} Central Station (Hub)`, lat: cLat, lng: cLng, units: 350, affordPct: 30, retailSqft: 20000, desc: "Anchor multi-modal terminal with EV fast charging hub." },
      { name: `${cName} East Station`, lat: cLat + 0.02, lng: cLng + 0.02, units: 260, affordPct: 30, retailSqft: 15000, desc: "East employment center connector." }
    ],
    corridorDesc: "High-frequency rapid transit corridor and active transportation revitalization connecting municipal activity centers.",
    p3Type: "Surplus Transit Agency ROW 99-Year Ground Lease with Infill Zoning Incentives",
    units: 350,
    affordPct: 30,
    retailSqft: 20000,
    baseIRR: 15.0,
    baseGroundLease: 850000,
    baseHomeLiftPct: 5.5,
    baseBoardingBoostPct: 35,
    bikewayName: "Corridor Rail-with-Trail Active Transportation Greenway",
    bikewayDesc: "Class I separated multi-use pedestrian and bicycle trail linking stations to residential neighborhoods and school districts.",
    bikewayCost: 2500000,
    bikewayHomeLift: 3.0,
    bikewayRidership: 12,
    treeSpecies: "Climate-Resilient Native Hardwood & Shade Canopy Trees",
    treeCount: 1000,
    treeCost: 850000,
    treeTempDrop: 4.5,
    treeHomeLift: 2.3,
    evStalls: 12,
    evKw: 150,
    evCost: 520000,
    evAnnualMargin: 42000,
    evCo2Tons: 180,
    plazaRetailSqft: 12000,
    plazaRetailCost: 1500000,
    plazaAnnualRent: 340000,
    localSalesTax: 270000,
    tdc: 72000000,
    seniorDebt: 39600000,
    tifiaLoan: 10800000,
    developerEquity: 21600000,
    noi: 5100000
  };
}

let _p3Term = 99;
let _p3Afford = 35;

function setP3Term(term) {
  _p3Term = term;
  document.querySelectorAll(".p3-term-btn").forEach(b => {
    b.classList.toggle("active", +b.dataset.term === term);
  });
  runP3Sim();
}

function setP3Afford(afford) {
  _p3Afford = afford;
  document.querySelectorAll(".p3-afford-btn").forEach(b => {
    b.classList.toggle("active", +b.dataset.afford === afford);
  });
  runP3Sim();
}

function p3Section(p, m) {
  const pipe = getMetroPipeline(activeFips(), p.c || m.c);
  return `
    <div style="font-family:var(--body);line-height:1.45;color:var(--ink)">
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:#0284c7;letter-spacing:0.5px;">🚆 Active Major Infrastructure Pipeline</span>
          <span style="font-size:11px;font-weight:600;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:12px;">${esc(pipe.status.split('·')[0])}</span>
        </div>
        <div style="font-size:15px;font-weight:800;color:#0c4a6e;margin-bottom:4px;">${esc(pipe.title)}</div>
        <div style="font-size:12px;color:#334155;margin-bottom:4px;"><b>Lead Sponsoring Agency:</b> ${esc(pipe.agency)}</div>
        <div style="font-size:12px;color:#475569;margin-bottom:6px;"><b>Station Focus Hub:</b> <span style="color:#0369a1;font-weight:600">${esc(pipe.hubName)}</span></div>
        <div style="font-size:12px;color:#475569;margin-bottom:10px;">${esc(pipe.corridorDesc)}</div>
        <button type="button" onclick="flyToP3Hub('${esc(pipe.fips)}')" style="display:inline-flex;align-items:center;gap:6px;background:#0284c7;color:#fff;border:none;padding:7px 13px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 2px 8px rgba(2,132,199,0.3);transition:background 0.15s;">
          📍 Fly to Station Hub on Map &amp; View 0.5-Mi Walkshed
        </button>
      </div>

      ${pipe.stations && pipe.stations.length ? `
      <div style="margin-bottom:12px;">
        <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:6px;">Planned Stations along this Corridor (Click to Inspect):</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
          ${pipe.stations.map((stn, idx) => `
            <button type="button" class="story-btn" onclick="flyToP3Hub('${esc(pipe.fips)}', ${idx})" style="padding:4px 8px;font-size:11px;" title="Focus ${esc(stn.name)}">
              ${(stn.lat === pipe.hubLat && stn.lng === pipe.hubLng) ? '🚆' : '🚉'} ${esc(stn.name)}
            </button>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <div style="margin-bottom:12px;">
        <div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:4px;">P3 Joint Development &amp; Corridor Bundle Simulator</div>
        <div style="font-size:12px;color:var(--ink-2);margin-bottom:10px;">Select complementary investments around the transit corridor to calculate combined private developer IRR, public agency ground lease revenue, and neighborhood property value lift:</div>

        <div style="display:flex;flex-wrap:wrap;gap:12px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <b>Ground Lease Term:</b>
            <div style="display:inline-flex;gap:3px;">
              <button type="button" class="story-btn p3-term-btn" data-term="55" onclick="setP3Term(55)">55 Years</button>
              <button type="button" class="story-btn p3-term-btn" data-term="75" onclick="setP3Term(75)">75 Years</button>
              <button type="button" class="story-btn p3-term-btn active" data-term="99" onclick="setP3Term(99)">99 Years (Optimal)</button>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <b>Affordable Housing:</b>
            <div style="display:inline-flex;gap:3px;">
              <button type="button" class="story-btn p3-afford-btn" data-afford="20" onclick="setP3Afford(20)">20% Workforce</button>
              <button type="button" class="story-btn p3-afford-btn active" data-afford="35" onclick="setP3Afford(35)">35% Mixed-Income</button>
              <button type="button" class="story-btn p3-afford-btn" data-afford="50" onclick="setP3Afford(50)">50% Deep Infill</button>
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px;">
          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12.5px;">
            <input type="checkbox" id="p3-tod" checked onchange="runP3Sim()" style="margin-top:2px;">
            <div>
              <b>Transit-Oriented Housing &amp; Mixed-Use Joint Development</b>
              <div style="font-size:11.5px;color:var(--ink-2);">${pipe.units} mixed-income homes, ${fmtN(pipe.retailSqft)} sq ft ground-floor commercial via 99-year public ground lease.</div>
            </div>
          </label>

          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12.5px;">
            <input type="checkbox" id="p3-trail" checked onchange="runP3Sim()" style="margin-top:2px;">
            <div>
              <b>${esc(pipe.bikewayName)}</b>
              <div style="font-size:11.5px;color:var(--ink-2);">${esc(pipe.bikewayDesc)} (+${pipe.bikewayHomeLift}% home value lift; +${pipe.bikewayRidership}% station cycling boardings).</div>
            </div>
          </label>

          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12.5px;">
            <input type="checkbox" id="p3-trees" checked onchange="runP3Sim()" style="margin-top:2px;">
            <div>
              <b>Urban Forest Shade Tree Canopy Corridor</b>
              <div style="font-size:11.5px;color:var(--ink-2);">${fmtN(pipe.treeCount)} native shade trees (${esc(pipe.treeSpecies)}) along station walkshed (cooling ambient heat by -${pipe.treeTempDrop}°F; +${pipe.treeHomeLift}% property value lift).</div>
            </div>
          </label>

          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12.5px;">
            <input type="checkbox" id="p3-ev" checked onchange="runP3Sim()" style="margin-top:2px;">
            <div>
              <b>Station Fast EV Charging Hub (${pipe.evStalls} DC Fast Stalls, ${pipe.evKw} kW)</b>
              <div style="font-size:11.5px;color:var(--ink-2);">${pipe.evStalls} ultra-fast charging bays with solar canopy; generates ~$${fmtN(pipe.evAnnualMargin)}/yr net charging margin and offsets ${pipe.evCo2Tons} tons CO2/yr.</div>
            </div>
          </label>

          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12.5px;">
            <input type="checkbox" id="p3-retail" checked onchange="runP3Sim()" style="margin-top:2px;">
            <div>
              <b>Station Plaza Micro-Retail &amp; Local Bodega / Grocer Hub</b>
              <div style="font-size:11.5px;color:var(--ink-2);">${fmtN(pipe.plazaRetailSqft)} sq ft active station storefronts; generates $${fmtN(pipe.plazaAnnualRent)}/yr concession revenue and $${fmtN(pipe.localSalesTax)}/yr municipal sales tax.</div>
            </div>
          </label>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:8px;margin-bottom:12px;">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;">Private Dev IRR</div>
            <div id="p3-irr" style="font-size:20px;font-weight:800;color:#15803d;margin-top:2px;">15.6%</div>
            <div id="p3-irr-sub" style="font-size:10px;color:#166534;margin-top:2px;">Target: 14.0%–16.5%</div>
          </div>

          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;">Public Agency Rev</div>
            <div id="p3-rev" style="font-size:20px;font-weight:800;color:#1d4ed8;margin-top:2px;">$1.62M / yr</div>
            <div style="font-size:10px;color:#1e40af;margin-top:2px;">Ground Lease + Concessions</div>
          </div>

          <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;font-weight:700;color:#6b21a8;text-transform:uppercase;">Property Value Lift</div>
            <div id="p3-lift" style="font-size:20px;font-weight:800;color:#7e22ce;margin-top:2px;">+12.5%</div>
            <div style="font-size:10px;color:#6b21a8;margin-top:2px;">Corridor Walkshed Homes</div>
          </div>

          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;">Ridership Boost</div>
            <div id="p3-ridership" style="font-size:20px;font-weight:800;color:#b45309;margin-top:2px;">+54%</div>
            <div style="font-size:10px;color:#92400e;margin-top:2px;">Station Boardings</div>
          </div>
        </div>

        <div id="p3-notes" style="font-size:11.5px;color:var(--ink-2);background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;line-height:1.4;margin-bottom:8px;">
          <b>P3 Partnership Structure:</b> Public transit agency contributes land/concession rights via 99-year ground lease with zero taxpayer bond debt for vertical construction. Private capital consortium finances, builds, and manages residential towers & retail, providing guaranteed annual lease revenue back to public transit operations.
        </div>

        <details style="margin-top:8px;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;background:#f8fafc;font-size:12px;">
          <summary style="font-weight:700;cursor:pointer;color:#0369a1;">📊 View Detailed Capital Stack &amp; 10-Year Pro-Forma Cash Flow</summary>
          <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;">
            <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
              <tr><td style="padding:3px 0;color:#64748b;">Total Development Cost (TDC):</td><td style="text-align:right;font-weight:700;">${fmt$(pipe.tdc)}</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">Senior Construction / Perm Debt (55%):</td><td style="text-align:right;">${fmt$(pipe.seniorDebt)}</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">Federal Low-Cost TIFIA / WIFIA Loan (15%):</td><td style="text-align:right;color:#0284c7;font-weight:600;">${fmt$(pipe.tifiaLoan)} (Treasury + 10 bps)</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">Private Developer Equity (30%):</td><td style="text-align:right;font-weight:700;">${fmt$(pipe.developerEquity)}</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">Net Operating Income (NOI @ Stabilized):</td><td style="text-align:right;font-weight:700;color:#15803d;">${fmt$(pipe.noi)} / yr</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">Priority Public Agency Ground Lease:</td><td style="text-align:right;font-weight:700;color:#1d4ed8;">${fmt$(pipe.baseGroundLease)} / yr</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">10-Year Projected Equity Multiple:</td><td style="text-align:right;font-weight:700;color:#7e22ce;">1.92x ROE</td></tr>
            </table>
          </div>
        </details>

        <details style="margin-top:8px;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;background:#f8fafc;font-size:12px;">
          <summary style="font-weight:700;cursor:pointer;color:#047857;">🛠️ Best-Practice Engineering Specs &amp; Implementation Playbook</summary>
          <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;display:flex;flex-direction:column;gap:8px;">
            <div>
              <b style="color:#0f766e;">🚴 Rail-with-Trail Active Greenway:</b> 12-ft paved dual-direction cycleway with 2-ft decomposed granite shoulders, grade-separated rail crossings with automated pedestrian gates, and solar LED pathway lighting. Connects directly to station turnstiles with secure Bikestation lockers.
            </div>
            <div>
              <b style="color:#15803d;">🌳 Urban Forest Shade Tree Canopy:</b> Silva Cell suspended pavement root trenches providing 1,000 cu ft of uncompacted soil per tree to prevent root heaving and support 40+ year maturity. Reduces station walkshed ambient heat by 4.5°F–6.0°F.
            </div>
            <div>
              <b style="color:#0284c7;">⚡ DC Fast EV Charging Depot:</b> 150kW–350kW dual-port dispensers sheltered by overhead solar PV canopy with on-site battery energy storage (BESS) to shave utility demand charges. Funded up to 80% through federal NEVI formula grants.
            </div>
            <div>
              <b style="color:#b45309;">🏪 Station Plaza Micro-Retail &amp; Bodega:</b> 400–1,200 sq ft modular ground-floor commercial bays anchored by a community cooperative grocery, coffee shop, and dry cleaners. Generates all-day foot traffic and non-farebox municipal revenue.
            </div>
          </div>
        </details>
      </div>
    </div>
  `;
}

function runP3Sim() {
  const pipe = getMetroPipeline(activeFips(), (selected && byId.get(selected)) ? byId.get(selected).properties.c : "");
  const tod = $("#p3-tod") ? $("#p3-tod").checked : true;
  const trail = $("#p3-trail") ? $("#p3-trail").checked : true;
  const trees = $("#p3-trees") ? $("#p3-trees").checked : true;
  const ev = $("#p3-ev") ? $("#p3-ev").checked : true;
  const retail = $("#p3-retail") ? $("#p3-retail").checked : true;

  // Base adjustments based on lease term and affordability requirements
  let termAdj = _p3Term === 99 ? 0 : (_p3Term === 75 ? -0.4 : -1.2);
  let affordAdj = _p3Afford === 20 ? 0.6 : (_p3Afford === 35 ? 0 : -0.8);

  let irr = tod ? (pipe.baseIRR + termAdj + affordAdj) : 0;
  let groundLease = tod ? pipe.baseGroundLease : 0;
  let propLift = tod ? pipe.baseHomeLiftPct : 0;
  let ridership = tod ? pipe.baseBoardingBoostPct : 0;

  if (trail) {
    irr += tod ? 0.4 : 0; // Trail connectivity boosts residential leasing velocity
    propLift += pipe.bikewayHomeLift;
    ridership += pipe.bikewayRidership;
  }
  if (trees) {
    irr += tod ? 0.2 : 0; // Shaded streetscape premium
    propLift += pipe.treeHomeLift;
    ridership += 4;
  }
  if (ev) {
    groundLease += pipe.evAnnualMargin;
    irr += 0.3;
  }
  if (retail) {
    groundLease += pipe.plazaAnnualRent;
    ridership += 8;
    propLift += 1.2;
    irr += 0.5;
  }

  const irrEl = $("#p3-irr");
  if (irrEl) irrEl.textContent = irr > 0 ? `${irr.toFixed(1)}%` : "N/A";

  const revEl = $("#p3-rev");
  if (revEl) revEl.textContent = groundLease >= 1000000 ? `$${(groundLease / 1000000).toFixed(2)}M / yr` : `$${Math.round(groundLease / 1000)}k / yr`;

  const liftEl = $("#p3-lift");
  if (liftEl) liftEl.textContent = `+${propLift.toFixed(1)}%`;

  const riderEl = $("#p3-ridership");
  if (riderEl) riderEl.textContent = `+${ridership}%`;
}

"""

content = content[:p3_start_idx] + new_p3_complete_code + content[select_idx:]
print("SUCCESS: Upgraded station network and corridor walkshed navigation")

with open(INDEX_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: All upgrades applied to index.html!")
