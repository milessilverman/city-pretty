import { describe, expect, it } from "vitest";
import { IMPROVEMENT_CATEGORIES, makeGeoRef, makeQuantity, deriveStatus } from "../../../src/platform/schema/index.js";
import {
  FEASIBILITY_RULES, exhaustiveScreen, makeParcelEvaluator, problemFirst, assetFirst, combinations,
  SPECIALIST_ROLES, validateIdea, intake, buildPromptSpec, discover,
} from "../../../src/platform/discovery/index.js";

// FIXTURE: not real data
const J = { state: "XX", countyFips: "00000" };
const SRC = { title: "fixture source", url: "https://example.invalid/fixture", retrieved: "2000-01-01" };
const poly = (x: number, y: number) => ({ type: "Polygon", coordinates: [[[x, y], [x, y + 1], [x + 1, y + 1], [x + 1, y], [x, y]]] }) as any;
const parcelRef = (id: string, x = 0, y = 0) => makeGeoRef({ kind: "parcel", id, jurisdiction: J, geometry: poly(x, y) });
const q = (value: number, unit: string) => makeQuantity({ value, unit, low: value, high: value, jurisdiction: "XX", effectiveDate: "2000-01-01", source: SRC });
const crit = (value: number, label = "fixture threshold") => ({ label, value, status: "assumed", provenance: "fixture: https://example.invalid/threshold" });
const PARCEL_CATS = IMPROVEMENT_CATEGORIES.filter((c) => c.family === "parcel_development");
const STREET_CAT = IMPROVEMENT_CATEGORIES.find((c) => c.family === "street")!;

// every attribute a parcel rule can ask for, with fixture numbers
const FULL_ATTRS: Record<string, any> = {
  parcel_area: q(10, "acre"), zoning_district: "ZZ", current_use: "lot", assessed_land_value: q(100, "USD"), assessed_improvement_value: q(10, "USD"),
  parking_surface_area: q(10, "acre"), vacancy_status: true, year_built: q(1900, "year"), retail_vacancy: q(5, "ratio"), contamination_status: true,
  remediation_cost: q(1, "USD"), combined_parcel_area: q(10, "acre"), existing_structures: q(1, "count"), built_floor_area: q(1, "sqft"),
  permitted_floor_area: q(10, "sqft"), office_vacancy: q(5, "ratio"), unused_development_rights: q(5, "sqft"), parking_occupancy: q(1, "ratio"),
  public_ownership: true, open_space_deficit: q(5, "acre"), industrial_vacancy: q(5, "ratio"), commercial_vacancy: q(5, "ratio"), adjacent_parcels: q(3, "count"),
};
const ALL_CRITERIA: Record<string, any> = {
  max_improvement_to_land_ratio: crit(0.5), min_parking_surface_area: crit(1), max_year_built: crit(2000), min_retail_vacancy: crit(1),
  max_remediation_cost: crit(100), min_assembled_area: crit(1), min_splittable_area: crit(1), min_adu_lot_area: crit(1), max_existing_structures: crit(5),
  max_built_to_permitted_ratio: crit(0.5), min_office_vacancy: crit(1), min_mixed_use_floor_area: crit(1), min_unused_rights: crit(1),
  max_parking_occupancy: crit(2), min_p3_floor_area: crit(1), min_open_space_deficit: crit(1), min_industrial_vacancy: crit(1),
  min_commercial_vacancy: crit(1), min_public_space_area: crit(1), min_coordination_partners: crit(1),
};
const PASS = () => ({ result: "pass" });
const ALL_PASS = { regulatory: PASS, financial: PASS, engineering: PASS };
const fullParcel = (id: string, over: Record<string, any> = {}) => ({ ref: parcelRef(id), attributes: { ...FULL_ATTRS, ...over }, labels: {} });

describe("exhaustive screening", () => {
  it("evaluation count equals applicable categories x locations; none skipped; every ledger finalized", () => {
    const locs = [parcelRef("a"), parcelRef("b"), parcelRef("c"),
      makeGeoRef({ kind: "street_segment", id: "s", jurisdiction: J, geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } })];
    const seen: string[] = [];
    const r = exhaustiveScreen({
      locations: locs, asOf: "2000-01-01",
      evaluate: (loc: any, cat: any) => { seen.push(`${loc.id}|${cat.id}`); return { status: "needs_info", missing: ["x"] }; },
    });
    const expected = 3 * IMPROVEMENT_CATEGORIES.filter((c) => (c.appliesTo as readonly string[]).includes("parcel")).length + IMPROVEMENT_CATEGORIES.filter((c) => (c.appliesTo as readonly string[]).includes("street_segment")).length;
    expect(r.counts.evaluations).toBe(expected);
    expect(seen.length).toBe(expected);
    expect(new Set(seen).size).toBe(expected);
    expect(r.ledgers).toHaveLength(4);
    expect(r.counts.needsInfo + r.counts.found + r.counts.rejected + r.counts.notEvaluated).toBe(expected);
  });
  it("viable only through all three passing checks; rejected goes to the ledger with a basis", () => {
    const parcels = [fullParcel("ok"), fullParcel("bad", { parcel_area: q(0.01, "acre"), assessed_improvement_value: q(1000, "USD"), adjacent_parcels: q(0, "count") })];
    const ev = makeParcelEvaluator({ parcels, criteria: ALL_CRITERIA, checks: ALL_PASS });
    const r = exhaustiveScreen({ locations: parcels.map((p) => p.ref), evaluate: ev, asOf: "2000-01-01" });
    const ok = r.opportunities.filter((o: any) => o.location.id === "ok");
    expect(ok.length).toBe(PARCEL_CATS.length);  // the other parcel-kind categories have no rule set and are notEvaluated
    expect(ok.every((o: any) => o.status === "viable" && deriveStatus(o.checks) === "viable")).toBe(true);
    const bad = r.ledgers.find((l: any) => l.location.id === "bad")!;
    expect(bad.rejected.length).toBeGreaterThan(0);
    expect(bad.notEvaluated.length).toBeGreaterThan(0);
    expect(bad.rejected.every((x: any) => x.basis === "physical")).toBe(true);
  });
  it("missing data is needs_info with the missing names, never rejected", () => {
    const p = { ref: parcelRef("m"), attributes: {}, labels: {} };
    const r = exhaustiveScreen({ locations: [p.ref], asOf: "2000-01-01", evaluate: makeParcelEvaluator({ parcels: [p], criteria: {}, checks: ALL_PASS }) });
    expect(r.counts.rejected).toBe(0);
    expect(r.ledgers[0].needsInfo).toHaveLength(PARCEL_CATS.length);
    expect(r.ledgers[0].needsInfo[0].missing.length).toBeGreaterThan(0);
  });
  it("locations without a valid GeoRef are reported, not dropped silently", () => {
    const r = exhaustiveScreen({ locations: [{ ref: null }, parcelRef("a")], asOf: "2000-01-01", evaluate: () => ({ status: "needs_info", missing: ["x"] }) });
    expect(r.counts.unlocated).toBe(1);
    expect(r.unlocated).toHaveLength(1);
  });
});

describe("parcel feasibility", () => {
  it("all 17 parcel categories have a rule set with required attributes", () => {
    expect(PARCEL_CATS).toHaveLength(17);
    expect(Object.keys(FEASIBILITY_RULES).sort()).toEqual(PARCEL_CATS.map((c) => c.id).sort());
    for (const c of PARCEL_CATS) expect(FEASIBILITY_RULES[c.id].requiredAttributes.length).toBeGreaterThan(0);
  });
  it("each returns four separate use options", () => {
    for (const c of PARCEL_CATS) {
      const r = FEASIBILITY_RULES[c.id].evaluate(fullParcel("p"), ALL_CRITERIA, ALL_PASS);
      expect(r.uses.map((u) => u.use)).toEqual(["develop", "preserve", "public_space", "coordinated_development"]);
      expect(r.status).toBe("viable");
    }
  });
  it("uses are evaluated separately: a small parcel can fail public space yet pass preserve", () => {
    const r = FEASIBILITY_RULES.lot_split.evaluate(fullParcel("p", { parcel_area: q(0.5, "acre") }), { ...ALL_CRITERIA, min_public_space_area: crit(1) }, ALL_PASS);
    const by = Object.fromEntries(r.uses.map((u) => [u.use, u.status]));
    expect(by.public_space).toBe("rejected");
    expect(by.preserve).toBe("viable");
    expect(r.status).toBe("viable");
  });
  it("missing attribute or criterion gives needs_info naming it; absent checks are unknown with a missing list", () => {
    const noAttr = FEASIBILITY_RULES.surface_parking.evaluate({ attributes: {} }, ALL_CRITERIA, ALL_PASS);
    expect(noAttr.status).toBe("needs_info");
    expect(noAttr.missing).toContain("parking_surface_area");
    const noCrit = FEASIBILITY_RULES.surface_parking.evaluate(fullParcel("p"), {}, ALL_PASS);
    expect(noCrit.uses[0].status).toBe("needs_info");
    expect(noCrit.missing).toContain("criterion:min_parking_surface_area");
    const noChecks = FEASIBILITY_RULES.surface_parking.evaluate(fullParcel("p"), ALL_CRITERIA);
    expect(noChecks.status).toBe("needs_info");
    expect(noChecks.uses[0].checks.regulatory).toEqual({ result: "unknown", missing: ["check:regulatory"] });
    expect(noChecks.uses[0].checks.financial?.result).toBe("unknown");
  });
  it("criteria without provenance or non-assumed plain objects are not accepted", () => {
    const r = FEASIBILITY_RULES.surface_parking.evaluate(fullParcel("p"), { ...ALL_CRITERIA, min_parking_surface_area: { value: 1 } }, ALL_PASS);
    expect(r.missing).toContain("criterion:min_parking_surface_area");
  });
  it("injected checks are called with their documented arguments and a fail rejects with its basis", () => {
    const calls: any[] = [];
    const r = FEASIBILITY_RULES.adu.evaluate(fullParcel("p"), ALL_CRITERIA, {
      regulatory: (p: any, c: any) => { calls.push(["reg", c.id]); return { result: "fail", reason: "fixture rule forbids", basis: "regulatory" }; },
      financial: (p: any, c: any, u: string) => { calls.push(["fin", c.id, u]); return { result: "pass" }; },
      engineering: (p: any, c: any) => { calls.push(["eng", c.id]); return { result: "pass" }; },
    });
    expect(r.status).toBe("rejected");
    expect(r.rejection?.basis).toBe("regulatory");
    expect(calls.filter((c) => c[0] === "fin").map((c) => c[2])).toEqual(["develop", "preserve", "public_space", "coordinated_development"]);
  });
});

describe("problem-first", () => {
  const loc = (id: string) => parcelRef(id);
  const map = [{ indicator: "crashes", direction: "above", threshold: crit(3), categoryIds: ["adu"] }];
  it("deficit above threshold gives a candidate; no deficit gives no opportunity; no value gives needs_info", () => {
    const r = problemFirst({
      locations: [loc("hi"), loc("lo"), loc("none")], problemMap: map as any,
      indicators: { hi: { crashes: q(9, "count") }, lo: { crashes: q(1, "count") } },
    });
    const by = Object.fromEntries(r.opportunities.map((o: any) => [o.location.id, o.status]));
    expect(by).toEqual({ hi: "candidate", none: "needs_info" });
    expect(r.noDeficit).toEqual([{ locationId: "lo", indicator: "crashes" }]);
    expect(r.opportunities.find((o: any) => o.location.id === "none").missingInputs).toContain("indicator:crashes");
  });
  it("missing threshold is needs_info, not a verdict", () => {
    const r = problemFirst({ locations: [loc("a")], problemMap: [{ ...map[0], threshold: null }] as any, indicators: { a: { crashes: q(9, "count") } } });
    expect(r.opportunities[0].status).toBe("needs_info");
  });
});

describe("asset-first", () => {
  const criteria = { max_improvement_to_land_ratio: crit(0.5), min_parking_surface_area: crit(1), min_unused_floor_area: crit(5) };
  it("flags underused, surface parking, vacant building and unused rights; missing attributes give needs_info", () => {
    const flagged = { ref: parcelRef("f"), attributes: { assessed_land_value: q(100, "USD"), assessed_improvement_value: q(10, "USD"), parking_surface_area: q(4, "acre"),
      permitted_floor_area: q(20, "sqft"), built_floor_area: q(5, "sqft") }, labels: {}, };
    const vacant = { ref: parcelRef("v"), attributes: { building_vacant: true }, labels: {} };
    const bare = { ref: parcelRef("b"), attributes: {}, labels: {} };
    const r = assetFirst({ parcels: [flagged, vacant, bare], criteria });
    const st = (id: string, cat: string) => r.opportunities.find((o: any) => o.location.id === id && o.categoryId === cat)?.status;
    expect(st("f", "underused_land")).toBe("candidate");
    expect(st("f", "surface_parking")).toBe("candidate");
    expect(st("f", "air_rights")).toBe("candidate");
    expect(st("v", "commercial_revitalisation")).toBe("candidate");
    expect(st("b", "underused_land")).toBe("needs_info");
    expect(st("b", "air_rights")).toBe("needs_info");
  });
  it("a well-used parcel is simply not flagged; thresholds come from criteria", () => {
    const p = { ref: parcelRef("w"), attributes: { assessed_land_value: q(100, "USD"), assessed_improvement_value: q(900, "USD") }, labels: {} };
    expect(assetFirst({ parcels: [p], criteria }).opportunities.find((o: any) => o.categoryId === "underused_land")).toBeUndefined();
    expect(assetFirst({ parcels: [p], criteria: {} }).opportunities.find((o: any) => o.categoryId === "underused_land")?.status).toBe("needs_info");
  });
  it("parcels without a location are counted as unlocated", () => {
    const r = assetFirst({ parcels: [{ ref: null, attributes: {}, labels: {} }], criteria });
    expect(r.counts.unlocated).toBe(1);
  });
});

describe("combination", () => {
  const row = [0, 1, 2, 3, 4].map((i) => ({ ref: parcelRef(`r${i}`, i, 0), attributes: {}, labels: {} }));
  it("finds adjacent pairs by shared edge and from an adjacency list", () => {
    const a = combinations({ parcels: row, bound: 100 });
    expect(a.generated).toBe(4);
    expect(a.truncated).toBe(false);
    expect(a.opportunities.every((o: any) => o.categoryId === "assembly" && o.status === "candidate")).toBe(true);
    const b = combinations({ parcels: row, adjacency: [["r0", "r2"]], bound: 100 });
    expect(b.generated).toBe(1);
  });
  it("reports truncation and the number not generated when the bound is hit", () => {
    const r = combinations({ parcels: row, bound: 2 });
    expect(r.generated).toBe(2);
    expect(r.truncated).toBe(true);
    expect(r.notGenerated).toBe(2);
  });
  it("cross-category pairs and triples come from caller rules; the bound covers them too", () => {
    const opps = ["adu", "lot_split", "densification"].flatMap((c) => ["r0", "r1"].map((id) => ({
      id: `${c}:${id}`, categoryId: c, location: { id }, status: "candidate" })));
    const rules = [{ id: "r-pair", categoryIds: ["adu", "lot_split"], relation: "same_location", basis: "fixture" },
      { id: "r-triple", categoryIds: ["adu", "lot_split", "densification"], relation: "same_location", basis: "fixture" }];
    const all = combinations({ opportunities: opps, parcels: [], pairRules: rules, bound: 100 });
    expect(all.combinations).toHaveLength(4);
    const cut = combinations({ opportunities: opps, parcels: [], pairRules: rules, bound: 3 });
    expect(cut.truncated).toBe(true);
    expect(cut.notGenerated).toBe(1);
  });
});

describe("AI exploration", () => {
  const good = () => ({ role: "development", categoryId: "adu", location: parcelRef("p"), rationale: "Rear space looks usable.", claims: [] as any[] });
  it("defines eight specialist roles with briefs and families", () => {
    expect(Object.keys(SPECIALIST_ROLES).sort()).toEqual(["civil", "commercial", "development", "environmental", "municipal_finance", "planning", "transportation", "underwriting"]);
    for (const r of Object.values(SPECIALIST_ROLES)) { expect(r.brief.length).toBeGreaterThan(10); expect(r.families.length).toBeGreaterThan(0); }
  });
  it("rejects malformed, unknown-category, wrong-family, unlocated and unsourced ideas with reasons", () => {
    const bad: any[] = [
      null, { ...good(), role: "wizard" }, { ...good(), categoryId: "teleporter" }, { ...good(), categoryId: "bike_lane" },
      { ...good(), location: { kind: "parcel" } }, { ...good(), rationale: "" }, { ...good(), claims: undefined }, { ...good(), extra: 1 },
      { ...good(), claims: [{ name: "lot size", value: 12, unit: "acre" }] },
      { ...good(), claims: [{ name: "lot size", value: 12, unit: "acre", source: { title: "t" } }] },
      { ...good(), rationale: "This lot is 12 acres and could hold 40 homes." },
      { ...good(), rationale: "Worth $5 million." },
    ];
    for (const i of bad) { const v = validateIdea(i); expect(v.valid).toBe(false); expect(v.reasons.length).toBeGreaterThan(0); }
  });
  it("accepts a sourced idea; accepted ideas become candidate opportunities only", () => {
    const withClaim = { ...good(), claims: [{ name: "lot size", value: 12, unit: "acre", source: SRC }] };
    const r = intake([good(), withClaim, { ...good(), role: "x" }], { maxIdeas: 10 });
    expect(r.accepted).toHaveLength(2);
    expect(r.rejected).toHaveLength(1);
    for (const o of r.accepted) {
      expect(o.status).toBe("candidate");
      expect(o.discoveredBy).toBe("ai_exploration");
      expect(o.checks).toEqual({});
    }
  });
  it("is bounded", () => {
    const r = intake([good(), good(), good()], { maxIdeas: 2 });
    expect(r.accepted).toHaveLength(2);
    expect(r.notProcessed).toBe(1);
    expect(r.truncated).toBe(true);
    expect(() => intake([good()], {} as any)).toThrow();
  });
  it("prompt spec states candidates only and limits categories to the role's families", () => {
    const s = buildPromptSpec("transportation", { note: "ctx" });
    expect(s.status).toBe("candidate_only");
    expect(s.instructions.join(" ")).toMatch(/candidates only/i);
    expect(s.allowedCategoryIds).toContain("bike_lane");
    expect(s.allowedCategoryIds).not.toContain("adu");
    expect(() => buildPromptSpec("nobody", {})).toThrow();
  });
});

describe("discover", () => {
  it("runs the methods, de-duplicates and keeps the methods that found each opportunity", () => {
    const p = fullParcel("p", { building_vacant: true });
    const parcels = [p, fullParcel("q")];
    const r = discover({
      locations: parcels.map((x) => x.ref), asOf: "2000-01-01", evaluate: makeParcelEvaluator({ parcels, criteria: ALL_CRITERIA, checks: ALL_PASS }),
      parcels, criteria: ALL_CRITERIA, indicators: { p: { crashes: q(9, "count") } },
      problemMap: [{ indicator: "crashes", direction: "above", threshold: crit(3), categoryIds: ["adu"] }] as any,
      adjacency: [["p", "q"]], bound: 10,
    });
    expect(r.methodsRun).toEqual(["exhaustive", "problem_first", "asset_first", "combination"]);
    const ids = r.opportunities.map((o: any) => o.categoryId + "|" + o.location.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(r.duplicatesMerged).toBeGreaterThan(0);
    const adu = r.opportunities.find((o: any) => o.categoryId === "adu" && o.location.id === "p")!;
    expect(r.foundBy[adu.id]).toEqual(["exhaustive", "problem_first"]);
    expect(adu.status).toBe("viable");
    expect(r.perMethod.combination).toBe(1);
    expect(r.ledgers).toHaveLength(2);
  });
});

describe("benchmark", () => {
  it("10,000 parcels x all parcel categories within 5 s", () => {
    const parcels = Array.from({ length: 10000 }, (_, i) => fullParcel(`b${i}`));
    const ev = makeParcelEvaluator({ parcels, criteria: ALL_CRITERIA, checks: ALL_PASS });
    const t0 = performance.now();
    const r = exhaustiveScreen({ locations: parcels.map((p) => p.ref), categories: PARCEL_CATS, evaluate: ev, asOf: "2000-01-01" });
    const ms = performance.now() - t0;
    expect(r.counts.evaluations).toBe(10000 * 17);
    expect(ms).toBeLessThan(5000);
  });
});
