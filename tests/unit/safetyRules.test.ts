// Rules that stop the engines from inventing facts when inputs are missing.
// (Kept from the old dataAccuracy.test.ts, whose other tests asserted values that turned out to be fabricated.)
import { describe, expect, it } from "vitest";
import { auditSingleHouseParcel } from "../../src/engines/parcelHouseAuditor";
import { estimateAccurateRoofArea } from "../../src/engines/roofAreaEngine";

describe("missing inputs stay missing", () => {
  it("no lot-split claim when the lot size is unknown", () => {
    const audit = auditSingleHouseParcel({
      parcelId: "TEST-NULL-SAFETY", lat: 34.05, lng: -118.25,
      lotSqft: undefined as any, livingSqft: undefined as any,
      neighborhoodMedianHv: 800000, stateCode: "CA", countyFips: "06037",
    });
    expect(audit.statutoryZoning.lotSplitFeasible).toBe(false);
  });

  it("no roof area without a recorded living area or footprint", () => {
    const estimate = estimateAccurateRoofArea({});
    expect(estimate.estimationMethod).toBe("not_recorded");
    expect(estimate.grossRoofSqft).toBe(0);
  });
});
