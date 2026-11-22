import { describe, expect, it } from "vitest";
import site, { stripPrefix } from "../../workers/site";

describe("site Worker path mapping", () => {
  it("maps /city-pretty/ paths onto the root files and leaves other paths alone", () => {
    expect(stripPrefix("/city-pretty/")).toBe("/");
    expect(stripPrefix("/city-pretty/app/app.js")).toBe("/app/app.js");
    expect(stripPrefix("/app/app.js")).toBe("/app/app.js");
    expect(stripPrefix("/city-prettyfoo/x")).toBe("/city-prettyfoo/x");
    expect(stripPrefix("/city-pretty")).toBeNull();
  });
  it("asks the asset store for the stripped path, and redirects the bare prefix", async () => {
    const seen: string[] = [];
    const env = { ASSETS: { fetch: async (r: Request) => { seen.push(new URL(r.url).pathname + new URL(r.url).search); return new Response("ok"); } } };
    await site.fetch(new Request("https://x.example/city-pretty/counties/sites_17031.json.gz?v=1"), env);
    expect(seen).toEqual(["/counties/sites_17031.json.gz?v=1"]);
    const redirect = await site.fetch(new Request("https://x.example/city-pretty"), env);
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get("location")).toBe("https://x.example/city-pretty/");
  });
});
