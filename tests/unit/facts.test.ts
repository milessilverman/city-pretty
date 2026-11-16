// The page's live-records module (app/facts.js), against real responses captured 2026-11-16 (Austin, TX).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
// @ts-ignore plain ES module
import { liveSiteFacts, fromWorker } from "../../app/facts.js";
import { siteFacts } from "../../workers/sources";

const fx = (n: string) => fs.readFileSync(path.join(__dirname, "../fixtures/sources", n), "utf8");
const routes: Array<[RegExp, string]> = [
  [/MapServer\/10\/query/, fx("tiger_bg_austin.json")],
  [/MapServer\/82\/query/, fx("tiger_county_austin.json")],
  [/Fair_Market_Rents/, fx("hud_fmr_austin.json")],
  [/NFHL\/MapServer\/28/, fx("fema_flood_austin.json")],
  [/epqs\.nationalmap\.gov/, fx("usgs_elev_austin.json")],
  [/geocoder\/geographies/, fx("census_geographies_austin.json")],
];
const fake = async (url: string) => {
  for (const [re, body] of routes) if (re.test(url)) return new Response(body, { status: 200 });
  throw new Error("network unreachable");
};

describe("app/facts.js live public records", () => {
  it("shows each agency's value with a link to the exact query", async () => {
    const rows = await liveSiteFacts(30.3005, -97.724, { fetcher: fake });
    const by = Object.fromEntries(rows.map((r: any) => [r.label.split(" (")[0], r]));
    expect(by["Census area"].value).toBe("Travis County · block group 484530003023");
    expect(by["HUD Fair Market Rent"].value).toContain("2 bed $1,852");
    expect(by["FEMA flood zone"].value).toContain("Zone AE");
    expect(by["Ground elevation"].value).toBe("581 ft");
    for (const r of rows) expect(r.url).toMatch(/^https:\/\//);
  });

  it("a failed or empty service says not available, with no number", async () => {
    const rows = await liveSiteFacts(30.3005, -97.724, { fetcher: async () => new Response(JSON.stringify({ features: [] })) });
    for (const r of rows) {
      expect(r.ok).toBe(false);
      expect(r.value).toBeNull();
    }
    expect(rows.find((r: any) => r.label === "FEMA flood zone").reason).toMatch(/unmapped, not 'no risk'/);
    const dead = await liveSiteFacts(30.3005, -97.724, { fetcher: async () => { throw new Error("offline"); } });
    expect(dead.every((r: any) => !r.ok && /offline/.test(r.reason))).toBe(true);
  });

  it("the Worker's /api/facts payload renders the same rows", async () => {
    const f = await siteFacts(30.3005, -97.724, { fetcher: fake as any });
    const rows = fromWorker(JSON.parse(JSON.stringify(f)));
    expect(rows.find((r: any) => r.label.startsWith("HUD")).value).toContain("$1,852");
    expect(rows.find((r: any) => r.label === "FEMA flood zone").value).toContain("Zone AE");
  });
});
