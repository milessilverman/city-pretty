import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { isQuantity } from "../../../src/platform/schema/index.js";
import { parcelsFromUnderSites, fieldMap } from "../../../src/platform/pilot/laBundle.js";
import { FEASIBILITY_RULES } from "../../../src/platform/discovery/index.js";

const bundle = JSON.parse(gunzipSync(Buffer.from(readFileSync("app/data/bundle-la.b64.txt", "utf8").trim(), "base64")).toString("utf8"));
const out = parcelsFromUnderSites(bundle);

describe("Los Angeles bundle adapter", () => {
  it("maps every under.sites record", () => {
    expect(out.recordCount).toBe(bundle.under.sites.length);
    expect(out.parcels).toHaveLength(bundle.under.sites.length);
  });
  it("no attribute value differs from the bundle's own value; only present fields appear", () => {
    let checked = 0;
    out.parcels.forEach((p, idx) => {
      const rec = bundle.under.sites[idx];
      for (const [key, spec] of Object.entries(fieldMap)) {
        const present = rec[key] !== null && rec[key] !== undefined && rec[key] !== "";
        if (spec.type === "label") {
          expect(p.labels[spec.attribute]).toBe(present ? String(rec[key]) : undefined);
        } else if (present) {
          const a = p.attributes[spec.attribute];
          expect(isQuantity(a)).toBe(true);
          expect(a.value).toBe(rec[key]);
          expect(a.status).toBe("assumed");
          checked++;
        } else expect(p.attributes[spec.attribute]).toBeUndefined();
      }
      expect(Object.keys(p.attributes).length + Object.keys(p.labels).length).toBeLessThanOrEqual(Object.keys(fieldMap).length);
    });
    expect(checked).toBeGreaterThan(0);
  });
  it("does not use under.assumptions numbers and invents no fields", () => {
    const names = new Set(Object.values(fieldMap).map((f) => f.attribute));
    for (const p of out.parcels.slice(0, 200)) for (const k of [...Object.keys(p.attributes), ...Object.keys(p.labels)]) expect(names.has(k)).toBe(true);
    const text = JSON.stringify(out.parcels.slice(0, 50));
    expect(text).not.toMatch(/density_homes_per_acre|cap_rate|hard_cost/);
  });
  it("limits state truthfully that the records carry no coordinates", () => {
    const keys = new Set(bundle.under.sites.flatMap((r: any) => Object.keys(r)));
    for (const k of ["lat", "lon", "lng", "latitude", "longitude", "geometry", "coordinates", "x", "y"]) expect(keys.has(k)).toBe(false);
    expect(out.parcels.every((p) => p.ref === null)).toBe(true);
    expect(out.limits.length).toBeGreaterThan(0);
    expect(out.limits[0]).toMatch(/No record has coordinates/);
  });
  it("feasibility on these parcels gives needs_info naming missing inputs, never a rejection", () => {
    const p = out.parcels.find((x) => x.attributes.parcel_area && x.labels.zoning_district && x.labels.current_use)!;
    const r = FEASIBILITY_RULES.underused_land.evaluate(p, {}, {});
    expect(r.status).toBe("needs_info");
    expect(r.missing).toContain("assessed_improvement_value");
  });
});
