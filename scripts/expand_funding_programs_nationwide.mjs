/**
 * Expand Funding Programs Nationwide
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const fundingPath = path.join(rootDir, "app/data/funding_programs.json");
const existingPrograms = JSON.parse(fs.readFileSync(fundingPath, "utf8"));

const NATIONWIDE_PROGRAMS = JSON.parse(`[
  {
    "id": "tx_tirz_ch311",
    "program_name": "Texas Tax Increment Reinvestment Zone (TIRZ / Chapter 311)",
    "jurisdiction_fips": null,
    "state_code": "TX",
    "administering_agency": "Texas Municipalities, Counties, and Local TIRZ Boards",
    "statutory_citation": "Tex. Tax Code § 311.001 et seq.",
    "source_url": "https://comptroller.texas.gov/economy/local/ch311/",
    "eligible_improvements": [
      "Station-area street reconstruction, sidewalk expansion, and utility undergrounding",
      "Protected bicycle lanes and multi-modal transit connector paths",
      "Stormwater detention ponds, green infrastructure, and public open space plazas"
    ],
    "funding_share_pct": 1.0,
    "funding_share_description": "Pledges 50% to 100% of incremental property tax growth in the designated zone over a 20-30 year term to service public infrastructure bonds",
    "how_to_apply": "City council or commissioners court petition and ordinance designation pursuant to Tex. Tax Code § 311.005",
    "cycle_dates": "Ongoing municipal designation",
    "last_verified": "2026-11-15"
  },
  {
    "id": "fl_cra_ch163",
    "program_name": "Florida Community Redevelopment Agency (CRA Trust Fund)",
    "jurisdiction_fips": null,
    "state_code": "FL",
    "administering_agency": "Local Municipal/County CRAs and Florida Department of Economic Opportunity",
    "statutory_citation": "Fla. Stat. § 163.387",
    "source_url": "https://floridacra.org/",
    "eligible_improvements": [
      "Transit-oriented streetscape improvements, crosswalks, and street lighting",
      "Façade and structural rehabilitation grants for commercial/residential conversions",
      "Public parking structure and greenway connections"
    ],
    "funding_share_pct": 0.95,
    "funding_share_description": "Captures 95% of incremental ad valorem tax revenues from county and city taxing authorities into the CRA redevelopment trust fund",
    "how_to_apply": "Application through local municipal CRA office; projects must align with adopted Community Redevelopment Plan",
    "cycle_dates": "Annual budgeting and grant application windows",
    "last_verified": "2026-11-15"
  },
  {
    "id": "fl_live_local_tax_exemption",
    "program_name": "Florida Live Local Act 75% Property Tax Exemption",
    "jurisdiction_fips": null,
    "state_code": "FL",
    "administering_agency": "Florida Department of Revenue and County Property Appraisers",
    "statutory_citation": "Fla. Stat. § 196.1979",
    "source_url": "https://floridarevenue.com/property/Pages/Taxpayers_Exemptions.aspx",
    "eligible_improvements": [
      "Newly constructed or substantially rehabilitated multifamily developments providing at least 40% affordable units (≤120% AMI) for 30 years"
    ],
    "funding_share_pct": 0.75,
    "funding_share_description": "Provides up to 75% statutory exemption from county, municipal, and special district ad valorem property taxes",
    "how_to_apply": "Annual Form DR-504AF filed with county property appraiser by March 1 with Florida Housing Finance Corporation certification",
    "cycle_dates": "Annual deadline March 1",
    "last_verified": "2026-11-15"
  },
  {
    "id": "co_ura_tif",
    "program_name": "Colorado Urban Renewal Authority (URA) Tax Increment Financing",
    "jurisdiction_fips": null,
    "state_code": "CO",
    "administering_agency": "Local Colorado Urban Renewal Authorities and Municipalities",
    "statutory_citation": "C.R.S. § 31-25-107",
    "source_url": "https://coloradoworks.org/urban-renewal/",
    "eligible_improvements": [
      "Transit-oriented community infrastructure, environmental remediation, and multi-modal transit hubs",
      "Utility capacity upgrades to support 40+ units/acre density near passenger rail under HB 24-1313",
      "Public plazas, street trees, and protected pedestrian paths"
    ],
    "funding_share_pct": 1.0,
    "funding_share_description": "Allocates 100% of property tax increment and optional sales tax increment generated over base assessment for up to 25 years",
    "how_to_apply": "Urban renewal plan adoption by city council with statutory blight/condition study and taxing entity agreements",
    "cycle_dates": "Ongoing municipal plan adoption",
    "last_verified": "2026-11-15"
  },
  {
    "id": "il_transit_tif",
    "program_name": "Illinois Transit Tax Increment Financing (Transit TIF)",
    "jurisdiction_fips": null,
    "state_code": "IL",
    "administering_agency": "City of Chicago Department of Planning and Development / Chicago Transit Authority",
    "statutory_citation": "65 ILCS 5/11-74.4-3.1",
    "source_url": "https://www.chicago.gov/city/en/depts/dcd/provdrs/tif/svcs/transit_tif.html",
    "eligible_improvements": [
      "Major passenger rail station modernization, track infrastructure, and Americans with Disabilities Act accessibility",
      "Direct station-adjacent transit-oriented public realm improvements"
    ],
    "funding_share_pct": 1.0,
    "funding_share_description": "Captures 100% of incremental property tax growth within a 0.5-mile corridor to fund local matching requirements for federal transit grants",
    "how_to_apply": "Intergovernmental agreement between municipality and transit authority approved by city council",
    "cycle_dates": "Dedicated 35-year transit district lifecycle",
    "last_verified": "2026-11-15"
  },
  {
    "id": "az_gplet",
    "program_name": "Arizona Government Property Lease Excise Tax (GPLET Abatement)",
    "jurisdiction_fips": null,
    "state_code": "AZ",
    "administering_agency": "Arizona Municipalities (Phoenix, Tucson, Tempe, Mesa) and County Treasurers",
    "statutory_citation": "A.R.S. § 42-6201 et seq.",
    "source_url": "https://www.phoenix.gov/econdev/gplet",
    "eligible_improvements": [
      "High-density mixed-use redevelopment and transit-oriented housing in designated central business districts (CBDs) or redevelopment areas"
    ],
    "funding_share_pct": 1.0,
    "funding_share_description": "Provides up to 8 years of 100% property tax abatement by conveying fee title to city and leasing back property, followed by reduced excise tax rates",
    "how_to_apply": "Economic development agreement approved by city council following statutory economic impact analysis",
    "cycle_dates": "Ad hoc developer proposals to municipal economic development departments",
    "last_verified": "2026-11-15"
  },
  {
    "id": "federal_fra_intercity_grant",
    "program_name": "Federal-State Partnership for Intercity Passenger Rail Grant Program",
    "jurisdiction_fips": null,
    "state_code": "US",
    "administering_agency": "Federal Railroad Administration (FRA) / U.S. Department of Transportation",
    "statutory_citation": "49 U.S.C. § 24911 (Infrastructure Investment and Jobs Act § 22307)",
    "source_url": "https://railroads.dot.gov/grants-loans/competitive-discretionary-grant-programs/federal-state-partnership-intercity-passenger-rail",
    "eligible_improvements": [
      "Capital projects to establish new intercity passenger rail corridors (e.g. Phoenix-Tucson, Austin-San Antonio, Front Range)",
      "High-speed rail guideways, passenger stations, track electrification, and vehicle maintenance facilities (railyards)",
      "Intermodal facilities and station area safety/capacity upgrades"
    ],
    "funding_share_pct": 0.8,
    "funding_share_description": "Provides up to 80% federal share of total capital project costs with 20% non-federal matching requirement",
    "how_to_apply": "Competitive Notice of Funding Opportunity (NOFO) application submitted via Grants.gov by state DOTs, regional authorities, or multi-state compacts",
    "cycle_dates": "Annual competitive NOFO solicitations",
    "last_verified": "2026-11-15"
  }
]`);

const combined = [...existingPrograms];

for (const p of NATIONWIDE_PROGRAMS) {
  if (!combined.find(x => x.id === p.id)) {
    combined.push(p);
  }
}

fs.writeFileSync(fundingPath, JSON.stringify(combined, null, 2), "utf8");
console.log(`Successfully expanded ${fundingPath} to ${combined.length} funding programs across jurisdictions:`, [...new Set(combined.map(p => p.state_code || p.jurisdiction_fips))]);
