// Advisor tools over City Pretty's own audited tables (app/data/*.json).
//
// Every record goes to the model with its `verification` block (status, unverified_fields, evidence), so the
// advisor can say "verified", "partly verified (these fields unconfirmed)" or "couldn't check" instead of
// presenting the table as fact. A table that has no matching record means "not in our table", never "no such law
// or program exists". The JSON is bundled into the Worker at deploy time, so it is the audited repository copy.

import statutes from "../app/data/statutes.json" with { type: "json" };
import funding from "../app/data/funding_programs.json" with { type: "json" };
import research from "../app/data/research.json" with { type: "json" };
import unitCosts from "../app/data/unit_costs.json" with { type: "json" };
import transitProjects from "../app/data/transit_pipelines.json" with { type: "json" };
import intercity from "../app/data/intercity_transit_corridors.json" with { type: "json" };
import counties from "../app/data/county_completeness.json" with { type: "json" };
import interventions from "../app/data/intervention_verification.json" with { type: "json" };
import type { SourceRef } from "./sources.ts";

type Rec = Record<string, any>;

const TABLE_NOTE =
  "From City Pretty's audited table. Use each record's verification.status: 'verified' = checked against its source; " +
  "'partially_verified' = fields in verification.unverified_fields are NOT confirmed; 'could_not_check' / 'unverified' = " +
  "not confirmed at all, say so. No matching record means this table doesn't cover it, not that it doesn't exist.";

function tableSource(file: string, name: string): SourceRef {
  return {
    name,
    publisher: "City Pretty audited data (each record cites its own primary source)",
    url: `repo://app/data/${file}`,
    retrieved_at: new Date().toISOString(),
  };
}

// Strip fields that were found fabricated or that the UI withholds, so the model never sees them as data.
const WITHHELD = new Set(["vpd", "baseIRR", "baseGroundLease", "baseHomeLiftPct", "developerEquity", "seniorDebt", "tifiaLoan", "tdc", "corridorRings", "path", "trajectory"]);
// The audit kept removed claims inside verification (removed_unverified_claims, original_claimed_citation) as a
// record of what was wrong; the model must not see them as data.
const AUDIT_TRAIL = new Set(["removed_unverified_claims", "original_claimed_citation"]);
const clean = (r: Rec): Rec =>
  Object.fromEntries(
    Object.entries(r)
      .filter(([k, v]) => !WITHHELD.has(k) && v !== null && v !== undefined && !(Array.isArray(v) && !v.length))
      .map(([k, v]) => (k === "verification" && v && typeof v === "object" ? [k, Object.fromEntries(Object.entries(v).filter(([vk]) => !AUDIT_TRAIL.has(vk)))] : [k, v])),
  );

const result = (file: string, name: string, records: Rec[], extraNotes: string[] = []) => ({
  ok: true as const,
  source: tableSource(file, name),
  value: { count: records.length, records: records.map(clean) },
  notes: [TABLE_NOTE, ...extraNotes],
});

const upper = (s: unknown) => (typeof s === "string" ? s.trim().toUpperCase() : "");
const fips5 = (s: unknown) => (typeof s === "string" && /^\d{1,5}$/.test(s.trim()) ? s.trim().padStart(5, "0") : "");

export function stateHousingLaws(state: string) {
  const st = upper(state);
  const recs = (statutes as Rec[]).filter((r) => r.state_code === st);
  return result("statutes.json", `State housing laws (${st})`, recs, recs.length ? [] : [`No ${st} laws in the table yet.`]);
}

const STATE_OF_FIPS: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA",
  "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA",
  "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY",
  "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX",
  "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY", "72": "PR",
};

export function fundingPrograms(countyFips?: string, state?: string) {
  const f = fips5(countyFips);
  const st = upper(state) || (f ? STATE_OF_FIPS[f.slice(0, 2)] || "" : "");
  const recs = (funding as Rec[]).filter((r) => {
    if (f && r.jurisdiction_fips === f) return true; // county program
    if (r.state_code && (r.state_code === st || r.state_code === "US")) return true; // state-wide or federal
    return false;
  });
  return result("funding_programs.json", "Funding programs", recs, ["The table covers few jurisdictions so far; most places have programs that are not in it."]);
}

export function researchStudies(topic: string) {
  const words = String(topic || "").toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const scored = (research as Rec[])
    .map((r) => {
      const hay = `${r.title} ${r.category} ${r.takeaway || ""} ${r.impact || ""}`.toLowerCase();
      return { r, s: words.filter((w) => hay.includes(w)).length };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map((x) => x.r);
  return result("research.json", `Research studies matching "${topic}"`, scored, [
    "Only 7 studies in this library are fully verified. An effect size ('impact') is usable only when verification.status is 'verified' or 'impact' is not in unverified_fields.",
  ]);
}

export function constructionUnitCosts(item?: string, state?: string) {
  const it = String(item || "").toLowerCase().replace(/\s+/g, "_");
  const st = upper(state);
  const recs = (unitCosts as Rec[]).filter((r) => (!it || String(r.item).includes(it)) && (!st || r.state === st));
  return result("unit_costs.json", "Public bid-item unit costs", recs, [
    "These are single awarded bid items for one contract each, not regional averages. Quote them with their contract, place and year.",
  ]);
}

export function transitProjectsFor(countyFips?: string, state?: string) {
  const f = fips5(countyFips);
  const st = upper(state);
  const local = (transitProjects as Rec[]).filter((r) => f && r.fips === f);
  const inter = (intercity as Rec[]).filter((r) => st && Array.isArray(r.states) && r.states.includes(st));
  return result("transit_pipelines.json + intercity_transit_corridors.json", "Transit projects", [...local, ...inter], [
    "Station coordinates flagged in coordinate_basis as city centroids are not station locations.",
  ]);
}

export function countyDataCoverage(countyFips: string) {
  const f = fips5(countyFips);
  const r = (counties as Record<string, Rec>)[f];
  return result("county_completeness.json", `Data coverage for county ${f}`, r ? [r] : [], [
    "Tier is computed from what this county's data file and live services actually contain (A best, D least, none = no data file).",
  ]);
}

export function improvementEvidence(id?: string) {
  const all = interventions as Record<string, Rec>;
  const recs = id && all[id] ? [{ id, ...all[id] }] : Object.entries(all).filter(([, v]) => v.status !== "unverified").map(([k, v]) => ({ id: k, ...v }));
  return result("intervention_verification.json", "Evidence status of improvement estimates", recs, [
    "Dollar estimates exist only for verified or partially_verified improvements; unverified ones have no sourced effect.",
  ]);
}

// Tool definitions for the model ------------------------------------------------------------------------------

const obj = (properties: Record<string, unknown>, required: string[]) => ({ type: "object" as const, properties, required, additionalProperties: false });

export const LOCAL_DATA_TOOLS = [
  {
    name: "state_housing_laws",
    description: "State housing / zoning preemption laws in City Pretty's audited table for one state (e.g. CA SB 79, TX SB 840): citation, effective date, conditions, limits, and each record's verification status. Use before saying anything about by-right building.",
    input_schema: obj({ state: { type: "string", description: "Two-letter state code" } }, ["state"]),
  },
  {
    name: "funding_programs",
    description: "Public funding programs and tax measures in the audited table (e.g. LA County Measure W) for a county or state: eligible improvements, funding share, how to apply, with verification status.",
    input_schema: obj({ county_fips: { type: "string" }, state: { type: "string" } }, []),
  },
  {
    name: "research_studies",
    description: "Search City Pretty's audited research library by topic (e.g. 'street trees home value', 'light rail'). Returns citations, DOIs and verification status; most effect sizes are not verified.",
    input_schema: obj({ topic: { type: "string" } }, ["topic"]),
  },
  {
    name: "construction_unit_costs",
    description: "Awarded public bid-item unit prices (sidewalk, curb ramp, streetlight, bus shelter, etc.) with contract, place, year and verification status.",
    input_schema: obj({ item: { type: "string" }, state: { type: "string" } }, []),
  },
  {
    name: "transit_projects",
    description: "Planned or under-construction transit projects for a county, and intercity rail corridors for a state, with status and verification. Financing figures are withheld unless the agency published them.",
    input_schema: obj({ county_fips: { type: "string" }, state: { type: "string" } }, []),
  },
  {
    name: "county_data_coverage",
    description: "What data City Pretty actually has for a county (parcels, zoning, transit feeds, crime/crash records) and its computed data tier. Use to explain why something is not on file.",
    input_schema: obj({ county_fips: { type: "string" } }, ["county_fips"]),
  },
  {
    name: "improvement_evidence",
    description: "Evidence status of City Pretty's improvement estimates (traffic calming, undergrounding, parks...): whether the effect and cost were checked against sources. Omit id to list all with any sourced side.",
    input_schema: obj({ id: { type: "string" } }, []),
  },
];

export function runLocalDataTool(name: string, i: Rec): unknown | undefined {
  switch (name) {
    case "state_housing_laws": return stateHousingLaws(i.state);
    case "funding_programs": return fundingPrograms(i.county_fips, i.state);
    case "research_studies": return researchStudies(i.topic);
    case "construction_unit_costs": return constructionUnitCosts(i.item, i.state);
    case "transit_projects": return transitProjectsFor(i.county_fips, i.state);
    case "county_data_coverage": return countyDataCoverage(i.county_fips);
    case "improvement_evidence": return improvementEvidence(i.id);
    default: return undefined;
  }
}
