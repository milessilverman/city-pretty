// FIXTURE: not real data. Every record, study, quote, URL and number below is synthetic and exists only to check arithmetic.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { makeQuantity } from "../../../src/platform/schema/quantity.js";
import { validateDistanceEffectRecord, selectRecord, bandsInMetres, ringSummary, overlapNote, METRES_PER_UNIT } from "../../../src/platform/pilot/distanceEffects.js";

const band = (inner: number, outer: number, unit: string, effectPct: number | null, lowPct: number | null, highPct: number | null, quoteIndex = 0) => ({ inner, outer, unit, effectPct, lowPct, highPct, quoteIndex });
function rec(over: any = {}): any {
  return {
    id: "fx-1", improvementKey: "traffic_calming", target: "residential_property_value", direction: "positive",
    bands: [band(0, 1112, "m", 5, 3, 7, 0), band(1112, 2224, "m", 2, 1, 3, 1)], distanceBasis: "straight_line",
    studyArea: "Fixture City (synthetic)", propertyType: "single-family homes (synthetic)",
    study: { citation: "Fixture Author (2000) A Synthetic Study.", doi: null, url: "https://example.invalid/study", retrieved: "2026-01-01", type: "hedonic" },
    quotes: ["Fixture quote one.", "Fixture quote two."], transferability: "Synthetic; none.", status: "verified", notRepresented: ["noise (fixture)"], ...over,
  };
}
const q = (value: number, unit: string) => makeQuantity({ value, low: value, high: value, unit, status: "estimated", source: { title: "Fixture bundle", url: "https://example.invalid/bundle", retrieved: "2026-01-01" }, jurisdiction: "fixture", effectiveDate: "2026-01-01" });
const rect = (x0: number, y0: number, x1: number, y1: number) => ({ type: "Polygon", coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] });
// One degree of longitude on the equator for the Earth radius used by the platform.
const DEG_M = (2 * Math.PI * 6371008.8) / 360;

describe("unit conversion", () => {
  it("converts with exact constants", () => {
    const r = rec({ bands: [band(0, 100, "ft", 1, null, null), band(1, 2, "mile", 1, null, null), band(3, 4, "km", 1, null, null)] });
    const b = bandsInMetres(r);
    expect(b[0].outerM).toBeCloseTo(30.48, 9);
    expect(b[1].innerM).toBeCloseTo(1609.344, 9);
    expect(b[1].outerM).toBeCloseTo(3218.688, 9);
    expect(b[2].innerM).toBe(3000);
    expect(METRES_PER_UNIT.ft).toBe(0.3048);
  });
});

describe("validation and selection", () => {
  it("accepts the fixture and reports problems", () => {
    expect(validateDistanceEffectRecord(rec()).valid).toBe(true);
    expect(validateDistanceEffectRecord(rec({ quotes: [] })).valid).toBe(false);
    expect(validateDistanceEffectRecord(rec({ bands: [band(0, 10, "m", 5, null, null, 9)] })).errors.join()).toMatch(/quoteIndex/);
    expect(validateDistanceEffectRecord(rec({ bands: [band(0, 10, "m", 5, null, null), band(0, 20, "m", 1, null, null)] })).valid).toBe(true); // nested is allowed
    expect(validateDistanceEffectRecord(rec({ direction: "negative" })).errors.join()).toMatch(/negative/);
    expect(validateDistanceEffectRecord(rec({ status: "requires_investigation" })).errors.join()).toMatch(/reason/);
  });
  it("no record => no_cited_distance_effect", () => {
    expect(selectRecord([], "traffic_calming")).toEqual({ record: null, reason: "no_cited_distance_effect" });
    expect(selectRecord([rec({ improvementKey: "street_trees" })], "traffic_calming").reason).toBe("no_cited_distance_effect");
  });
  it("one verified record is returned; two are ambiguous and never averaged", () => {
    const a = rec(), b = rec({ id: "fx-2" });
    expect(selectRecord([a], "traffic_calming").record).toBe(a);
    const s = selectRecord([a, b], "traffic_calming");
    expect(s.record).toBeNull();
    expect(s.reason).toBe("ambiguous");
    expect((s as any).candidates).toHaveLength(2);
  });
  it("only requires_investigation records => requires_investigation with the reason", () => {
    const s = selectRecord([rec({ status: "requires_investigation", reason: "fixture: paywalled", bands: [] })], "traffic_calming");
    expect(s.reason).toBe("requires_investigation");
    expect((s as any).detail).toEqual(["fixture: paywalled"]);
  });
});

describe("ringSummary", () => {
  // Line site along the meridian lon=0. A block group 0..0.04 deg wide: columns of 0.001 deg, bands end at 0.01 and 0.02 deg.
  const line = { type: "LineString", coordinates: [[0, -1], [0, 1]] } as const;
  const wide = { id: "bgA", homes: q(1000, "homes"), medianHomeValue: q(500000, "USD"), polygon: rect(0, -0.01, 0.04, 0.01) };

  it("line site: homes in each ring equal the hand-computed share (10 of 40 columns each)", () => {
    const s = ringSummary({ record: rec(), site: line as any, blockGroups: [wide], samplesPerBlockGroup: 800 });
    expect(s.resolution).toBe("block_group_estimate");
    expect(s.distanceBasis).toBe("straight_line");
    expect(s.bands).toHaveLength(2);
    expect(s.bands[0].homesEstimated.value).toBeCloseTo(250, 6);
    expect(s.bands[0].homesEstimated.status).toBe("estimated");
    expect(s.bands[0].homesEstimated.method).toMatch(/sample grid/);
    expect(s.bands[1].homesEstimated.value).toBeCloseTo(250, 6);
    // 250 homes x $500,000 x 5% = $6,250,000, range from 3% to 7%
    expect(s.bands[0].valueEffect.value).toBeCloseTo(6_250_000, 3);
    expect(s.bands[0].valueEffect.low).toBeCloseTo(3_750_000, 3);
    expect(s.bands[0].valueEffect.high).toBeCloseTo(8_750_000, 3);
    expect(s.bands[0].valueEffect.unit).toBe("USD");
    expect(s.bands[1].valueEffect.value).toBeCloseTo(2_500_000, 3);
    expect(s.caveats.join(" ")).toMatch(/straight-line/);
    expect(s.caveats.join(" ")).toMatch(/not investor cash flow/);
    expect(DEG_M * 0.01).toBeLessThan(1112); // sanity: the band edge sits between grid columns
  });

  it("point site: a block group wholly in one band gets all its homes there; ranges and provenance propagate", () => {
    const site = { type: "Point", coordinates: [0, 0] } as const;
    const near = { id: "near", homes: q(400, "homes"), medianHomeValue: q(300000, "USD"), polygon: rect(0.001, -0.0005, 0.002, 0.0005) }; // 111-222 m
    const far = { id: "far", homes: q(600, "homes"), medianHomeValue: q(200000, "USD"), polygon: rect(0.012, -0.0005, 0.013, 0.0005) }; // ~1334-1445 m
    const s = ringSummary({ record: rec(), site: site as any, blockGroups: [near, far], samplesPerBlockGroup: 50 });
    expect(s.bands[0].homesEstimated.value).toBeCloseTo(400, 9);
    expect(s.bands[1].homesEstimated.value).toBeCloseTo(600, 9);
    expect(s.bands[0].valueEffect.value).toBeCloseTo(400 * 300000 * 0.05, 3);
    expect(s.bands[1].valueEffect.value).toBeCloseTo(600 * 200000 * 0.02, 3);
    expect(s.bands[0].valueEffect.source).toBeNull();
    expect(s.bands[0].valueEffect.inputs.join(" ")).toMatch(/fx-1/);
    // totals are per band only: no grand total is produced
    expect((s as any).total).toBeUndefined();
  });

  it("a null median home value keeps valueEffect null (homes still estimated)", () => {
    const site = { type: "Point", coordinates: [0, 0] } as const;
    const bg = { id: "n", homes: q(100, "homes"), medianHomeValue: null, polygon: rect(0.001, -0.0005, 0.002, 0.0005) };
    const s = ringSummary({ record: rec(), site: site as any, blockGroups: [bg], samplesPerBlockGroup: 20 });
    expect(s.bands[0].homesEstimated.value).toBeCloseTo(100, 9);
    expect(s.bands[0].valueEffect.value).toBeNull();
    expect(s.bands[0].valueEffect.method).toMatch(/median home value/);
  });

  it("a band with effectPct null has no value effect; homes with no sample points in the band are unavailable, not zero", () => {
    const site = { type: "Point", coordinates: [0, 0] } as const;
    const r = rec({ bands: [band(0, 1112, "m", null, null, null, 0), band(1112, 2224, "m", 2, null, null, 1)] });
    const bg = { id: "n", homes: q(100, "homes"), medianHomeValue: q(1, "USD"), polygon: rect(0.001, -0.0005, 0.002, 0.0005) };
    const s = ringSummary({ record: r, site: site as any, blockGroups: [bg], samplesPerBlockGroup: 20 });
    expect(s.bands[0].valueEffect.value).toBeNull();
    expect(s.bands[1].homesEstimated.value).toBeNull();
    expect(s.bands[1].homesEstimated.status).toBe("unavailable");
  });

  it("negative direction keeps its sign", () => {
    const site = { type: "Point", coordinates: [0, 0] } as const;
    const r = rec({ direction: "negative", bands: [band(0, 1112, "m", -4, -6, -2, 0)] });
    const bg = { id: "n", homes: q(100, "homes"), medianHomeValue: q(250000, "USD"), polygon: rect(0.001, -0.0005, 0.002, 0.0005) };
    const s = ringSummary({ record: r, site: site as any, blockGroups: [bg], samplesPerBlockGroup: 20 });
    const v = s.bands[0].valueEffect;
    expect(v.value).toBeCloseTo(-1_000_000, 3);
    expect(v.low).toBeCloseTo(-1_500_000, 3);
    expect(v.high).toBeCloseTo(-500_000, 3);
  });

  it("refuses an unverified record (no default effect)", () => {
    expect(() => ringSummary({ record: rec({ status: "requires_investigation", reason: "x", bands: [] }), site: { type: "Point", coordinates: [0, 0] } as any, blockGroups: [], samplesPerBlockGroup: 10 })).toThrow();
  });
});

describe("nested bands, null effect, transferability", () => {
  const site = { type: "Point", coordinates: [0, 0] } as const;
  const bg = { id: "n", homes: q(100, "homes"), medianHomeValue: q(200000, "USD"), polygon: rect(0.001, -0.0005, 0.002, 0.0005) };
  it("bands that both start at 0 are kind 'within'; disjoint bands are 'ring'; no cross-band total exists", () => {
    const nested = ringSummary({ record: rec({ bands: [band(0, 1112, "m", 5, null, null), band(0, 2224, "m", 6, null, null)] }), site: site as any, blockGroups: [bg], samplesPerBlockGroup: 20 });
    expect(nested.bands.map((b: any) => b.kind)).toEqual(["within", "within"]);
    expect(nested.bands[0].homesEstimated.value).toBeCloseTo(100, 9);
    expect(nested.bands[1].homesEstimated.value).toBeCloseTo(100, 9); // same homes, not 200
    expect(nested.caveats.join(" ")).toMatch(/never added together/);
    expect(ringSummary({ record: rec(), site: site as any, blockGroups: [bg], samplesPerBlockGroup: 20 }).bands.map((b: any) => b.kind)).toEqual(["ring", "ring"]);
  });
  it("overlapNote does not add a site's nested bands", () => {
    const r = rec({ bands: [band(0, 1112, "m", 5, null, null), band(0, 2224, "m", 6, null, null)] });
    const mkS = (key: string) => ringSummary({ record: r, site: site as any, blockGroups: [bg], samplesPerBlockGroup: 20, siteKey: key });
    const n = overlapNote([mkS("a"), mkS("b")], { rule: "max" });
    expect((n.combined as any).combined[0].value.value).toBeCloseTo(100 * 200000 * 0.06, 3); // widest band once
  });
  it("effectPct null: band kept, no computed value effect", () => {
    const s = ringSummary({ record: rec({ bands: [band(0, 1112, "m", null, null, null)] }), site: site as any, blockGroups: [bg], samplesPerBlockGroup: 20 });
    expect(s.bands[0].effectPct.value).toBeNull();
    expect(s.bands[0].valueEffect.value).toBeNull();
    expect(s.bands[0].valueEffect.method).toMatch(/no percentage/);
  });
  it("transferability and notRepresented travel with the record into the summary", () => {
    const s = ringSummary({ record: rec(), site: site as any, blockGroups: [bg], samplesPerBlockGroup: 20 });
    expect(s.caveats.join(" ")).toContain("Synthetic; none.");
    expect(s.caveats.join(" ")).toContain("noise (fixture)");
  });
});

describe("overlapNote", () => {
  const bgs = [{ id: "bgA", homes: q(1000, "homes"), medianHomeValue: q(500000, "USD"), polygon: rect(-0.02, -0.01, 0.02, 0.01) }];
  const mk = (lon: number, key: string) => ringSummary({ record: rec(), site: { type: "Point", coordinates: [lon, 0] } as any, blockGroups: bgs, samplesPerBlockGroup: 400, siteKey: key });
  it("overlapping rings, no guard: values stay per site and the flag is returned", () => {
    const n = overlapNote([mk(-0.005, "s1"), mk(0.005, "s2")]);
    expect(n.overlapping).toBe(true);
    expect(n.flags).toEqual(["overlap_not_combined"]);
    expect(n.combined).toBeNull();
    expect(n.perSite).toHaveLength(2);
    expect(n.pairs[0].sharedBlockGroups).toEqual(["bgA"]);
  });
  it("with a guard the combined view comes from combine.js", () => {
    const n = overlapNote([mk(-0.005, "s1"), mk(0.005, "s2")], { rule: "max" });
    expect(n.flags).toContain("overlap_combined");
    expect((n.combined as any).combined).toHaveLength(1);
  });
  it("distant sites do not overlap", () => {
    expect(overlapNote([mk(-0.03, "s1"), mk(0.03, "s2")]).overlapping).toBe(false);
  });
});

describe("real evidence file", () => {
  const file = new URL("../../../app/data/impact_distance_effects.json", import.meta.url);
  const present = existsSync(file);
  it.skipIf(!present)("every record passes the validator", () => {
    const j = JSON.parse(readFileSync(file, "utf8"));
    expect(j.schemaVersion).toBe(1);
    for (const r of j.records) {
      const v = r.status === "verified" ? validateDistanceEffectRecord(r) : validateDistanceEffectRecord({ ...r });
      expect(v.errors, r.id).toEqual([]);
    }
  });
  if (!present) it("skipped: app/data/impact_distance_effects.json is not present yet", () => { expect(present).toBe(false); });
});
