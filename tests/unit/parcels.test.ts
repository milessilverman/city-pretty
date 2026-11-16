// The advisor's parcel tool (workers/parcels.ts). Fixtures are real responses captured 2026-11-16 from LA County's
// and North Carolina's public parcel services.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parcelAt, parcelServicesFor } from "../../workers/parcels";
// @ts-ignore plain ES module
import { extractParcelServices } from "../../scripts/extract_parcel_services.mjs";

const root = path.resolve(__dirname, "../..");
const fx = (n: string) => fs.readFileSync(path.join(root, "tests/fixtures/sources", n), "utf8");
const serve = (body: string) => async () => new Response(body, { status: 200 });

describe("parcel lookup", () => {
  it("the advisor's registry is exactly the page's (regenerate with scripts/extract_parcel_services.mjs)", () => {
    const fromPage = extractParcelServices(fs.readFileSync(path.join(root, "app/app.js"), "utf8"));
    expect(JSON.parse(fs.readFileSync(path.join(root, "app/data/parcel_services.json"), "utf8"))).toEqual(fromPage);
  });

  it("tries the county's own service first, then a statewide one", () => {
    expect(parcelServicesFor("06037")[0].name).toMatch(/Los Angeles County Assessor/);
    expect(parcelServicesFor("37183").some((s) => /NC OneMap/.test(s.name))).toBe(true);
    expect(parcelServicesFor("99999")).toEqual([]);
  });

  it("returns the agency's fields under the page's labels, with the exact query URL", async () => {
    const la = await parcelAt(34.0537, -118.2428, "06037", serve(fx("parcel_la_city_hall.json")));
    expect(la.ok && la.value.fields.SitusFullAddress).toBe("200 N SPRING ST LOS ANGELES CA 90012");
    expect(la.ok && la.source.url).toContain("public.gis.lacounty.gov");
    const nc = await parcelAt(35.7804, -78.6391, "37183", serve(fx("parcel_nc_capitol.json")));
    expect(nc.ok && nc.value.fields["Full Site Address"]).toBe("1 E EDENTON ST");
  });

  it("no service, no parcel or an error gives ok:false with the reason, never a guess", async () => {
    expect((await parcelAt(0, 0, "99999")).ok).toBe(false);
    const empty = await parcelAt(30.2672, -97.7431, "48453", serve(JSON.stringify({ features: [] })));
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toMatch(/right-of-way/);
    const err = await parcelAt(34.05, -118.24, "06037", serve(JSON.stringify({ error: { message: "Service unavailable" } })));
    expect(err.ok).toBe(false);
  });
});
