import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Cost and funding tables built by scripts/costs/. Data only: nothing here is wired into the engine or the page.
// Checks: (1) every row has a value, a quote and an https URL; (2) several values are re-checked against small saved
// copies of the fetched source text or API response in tests/fixtures/costs/ (so they are compared with the source,
// not with themselves).
const D = path.join(__dirname, "../../app/data");
const FX = path.join(__dirname, "../fixtures/costs");
const json = (p: string) => JSON.parse(fs.readFileSync(p, "utf-8"));
const fx = (n: string) => fs.readFileSync(path.join(FX, n), "utf-8");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// Rows the page may show are in app/data/; rows marked display_allowed: false are in data/internal/ (same shape). The tests
// below check both together, as the build scripts produced them.
const INTERNAL = path.join(__dirname, "../../data/internal");
const merge = (a: any, b: any) => ({ ...a, rows: [...a.rows, ...b.rows] });
const BC = merge(json(path.join(D, "building_costs.json")), json(path.join(INTERNAL, "building_costs_internal.json")));
const FR = merge(json(path.join(D, "housing_funding_rules.json")), json(path.join(INTERNAL, "housing_funding_rules_internal.json")));
const IL = json(path.join(D, "hud_income_limits.json"));
const ACF = json(path.join(D, "area_cost_factors.json"));

describe("building_costs.json", () => {
  it("every row has the required fields, a quote of at most 300 characters and an https source URL", () => {
    expect(BC.rows.length).toBeGreaterThan(300);
    for (const r of BC.rows) {
      for (const k of ["item", "building_type", "construction_method", "measure", "unit", "year", "place", "source_url", "quote", "verification", "display_allowed"])
        expect(r[k], `${r.item} missing ${k}`).not.toBeUndefined();
      expect(["cost_per_sqft", "cost_per_unit", "factor", "months"]).toContain(r.measure);
      expect(r.value != null || Array.isArray(r.range), `${r.item} has neither value nor range`).toBe(true);
      expect(r.source_url).toMatch(/^https:\/\//);
      expect(typeof r.quote).toBe("string");
      expect(r.quote.length).toBeGreaterThan(10);
      expect(r.quote.length, r.item).toBeLessThanOrEqual(600); // computed rows describe a query; fetched-text quotes are checked at <=300 by the build script
      expect(typeof r.display_allowed).toBe("boolean");
      expect(r.verification.status).toBeTruthy();
    }
  });

  it("the ICC table is marked internal use only and is not displayable", () => {
    const icc = BC.rows.filter((r: any) => r.icc_occupancy_group);
    expect(icc.length).toBe(238); // 27 occupancy groups x 9 types = 243, minus 5 'N.P.' (not permitted) cells
    expect(icc.every((r: any) => r.display_allowed === false)).toBe(true);
    expect(BC._source.icc.display_decision).toBe("internal use only: not displayed");
    expect(BC._source.icc.edition_statement).toContain("February 2026");
  });

  it("ICC values equal the fetched city copies (Hermiston and Albuquerque)", () => {
    const herm = norm(fx("icc_hermiston_excerpt.txt"));
    const cabq = norm(fx("icc_albuquerque_excerpt.txt"));
    const icc = BC.rows.filter((r: any) => ["R-1", "R-2", "R-3", "R-4", "B", "M", "U"].includes(r.icc_occupancy_group));
    expect(icc.length).toBeGreaterThan(50);
    for (const r of icc) {
      const v = r.value.toFixed(2);
      expect(herm, r.item).toContain(v);
      expect(cabq, r.item).toContain(v);
    }
    const r2vb = BC.rows.find((r: any) => r.icc_occupancy_group === "R-2" && r.icc_construction_type === "VB");
    expect(r2vb.value).toBe(158.18);
    expect(herm).toContain("R-2 Residential, multiple family 239.24 229.09 219.34 209.38 188.69 182.45 208.85 165.63 158.18");
    expect(cabq).toContain("Source: International Code Council, Building Valuation Data, February 2026");
  });

  it("DoD area cost factors equal the fetched workbook rows", () => {
    const lines = fx("ufs_table_4_1_sample.csv").trim().split("\n").slice(1).map((l) => l.split(","));
    expect(lines.length).toBeGreaterThan(50);
    const by = new Map<string, any>();
    for (const l of ACF.locations) by.set(`${l.state}|${l.county}|${l.city}`, l);
    for (const [state, county, city, , acf] of lines) {
      const loc = by.get(`${state}|${county}|${city}`);
      expect(loc, `${state} ${county} ${city}`).toBeTruthy();
      const vals = Array.isArray(loc.area_cost_factor) ? loc.area_cost_factor : [loc.area_cost_factor];
      expect(vals).toContain(Number(acf));
    }
    expect(ACF._source.how_to_apply).toContain("adjusting");
    // state rows: median lies inside the stated range
    for (const r of BC.rows.filter((x: any) => x.item.startsWith("DoD MILCON area cost factor"))) {
      expect(r.range[0]).toBeLessThanOrEqual(r.value);
      expect(r.value).toBeLessThanOrEqual(r.range[1]);
    }
  });

  it("LA ADU median is reproduced from the saved raw permits (junior ADU, 2020)", () => {
    const rows = fx("la_junior_adu_2020_permits.csv").trim().split("\n").slice(1).map((l) => l.split(","));
    const ppsf = rows.map((r) => Number(r[3]) / Number(r[2]));
    const vals = rows.map((r) => Number(r[3]));
    const perSqft = BC.rows.find((r: any) => r.item.startsWith("Junior ADU") && r.measure === "cost_per_sqft" && r.year === 2020);
    const perUnit = BC.rows.find((r: any) => r.item.startsWith("Junior ADU") && r.measure === "cost_per_unit" && r.year === 2020);
    expect(rows.length).toBe(61);
    expect(Math.round(median(ppsf) * 100) / 100).toBe(perSqft.value);
    expect(median(vals)).toBe(perUnit.value);
    expect(perSqft.source_url).toContain("data.lacity.org/resource/pi9x-tg5x.json?");
    expect(decodeURIComponent(perSqft.source_url)).toContain("junior_adu");
  });

  it("modular and conventional study rows carry both sides of the comparison", () => {
    const months = BC.rows.filter((r: any) => r.measure === "months");
    expect(months.some((r: any) => r.construction_method === "modular" && r.value === 9.29)).toBe(true);
    expect(months.some((r: any) => r.construction_method === "conventional" && r.value === 16.86)).toBe(true);
    expect(BC.rows.some((r: any) => r.measure === "cost_per_sqft" && r.construction_method === "modular" && Array.isArray(r.range))).toBe(true);
  });
});

describe("housing_funding_rules.json", () => {
  const rows: any[] = FR.rows;
  it("every row has a quote, an https URL, a verification block and a display flag", () => {
    expect(rows.length).toBeGreaterThan(200);
    for (const r of rows) {
      expect(r.section, r.what_it_funds_or_limits).toBeTruthy();
      expect(r.value, r.what_it_funds_or_limits).not.toBeUndefined();
      expect(r.source_url).toMatch(/^https:\/\//);
      expect(typeof r.quote).toBe("string");
      expect(r.quote.length).toBeGreaterThan(5);
      expect(r.quote.length).toBeLessThanOrEqual(300);
      expect(r.verification.status).toBeTruthy();
      expect(typeof r.display_allowed).toBe("boolean");
    }
  });

  it("HUD 2026 statutory mortgage limits equal the Federal Register text", () => {
    const t = norm(fx("fr_2026_08795_excerpt.txt"));
    const lim = rows.filter((r) => r.section === "hud_fha_statutory_limits");
    expect(lim.length).toBe(51);
    for (const r of lim) expect(t, r.what_it_funds_or_limits).toContain(r.value.toLocaleString("en-US"));
    const c234 = lim.find((r) => r.program_section.startsWith("Section 234") && r.building_type === "elevator" && r.bedrooms === "2");
    expect(c234.value).toBe(111504);
    const hdr = lim.find((r) => r.program_section.startsWith("Section 234"));
    expect(t.toUpperCase()).toContain(hdr.table_header_in_notice.toUpperCase());
  });

  it("HOME limits equal the notice and are 240 percent of the Section 234 elevator limit", () => {
    const t = norm(fx("fr_2026_06926_excerpt.txt"));
    const home = rows.filter((r) => r.section === "home_per_unit_limits");
    expect(home.map((r) => r.value)).toEqual([187658, 215122, 261595, 338419, 371477]);
    const s234 = t.match(/\$78,191 (\d+,\d+) (\d+,\d+) (\d+,\d+) (\d+,\d+)/)!;
    const base = [78191, ...s234.slice(1).map((x) => Number(x.replace(",", "")))];
    base.forEach((b, i) => expect(Math.round(b * 2.4)).toBe(home[i].value));
    expect(t).toContain("$187,658 215,122 261,595 338,419 371,477");
    expect(t).toContain("240 percent");
  });

  it("IRS state ceiling and monthly percentages equal the fetched text", () => {
    expect(norm(fx("rp_2025_32_excerpt.txt"))).toContain("$3.416 multiplied by the State population, or (2) $3,953,600");
    const nov = norm(fx("rr_2026_21_excerpt.txt")), dec = norm(fx("rr_2026_24_excerpt.txt"));
    expect(nov).toContain("70% present value low-income housing credit 8.24%");
    expect(nov).toContain("30% present value low-income housing credit 3.53%");
    expect(dec).toContain("70% present value low-income housing credit 8.20%");
    expect(dec).toContain("30% present value low-income housing credit 3.51%");
    const get = (re: RegExp) => rows.find((r) => re.test(r.what_it_funds_or_limits));
    expect(get(/per resident amount/).value).toBe(3.416);
    expect(get(/small-state minimum/).value).toBe(3953600);
    const pct = rows.filter((r) => r.section === "lihtc_monthly_rates").map((r) => r.value);
    expect(pct).toEqual([8.24, 3.53, 8.2, 3.51]);
  });

  it("LIHTC statute rows carry the 9 percent and 4 percent floors and the 130 percent boost", () => {
    const get = (m: string) => rows.find((r) => r.measure === m && r.section.startsWith("lihtc"));
    expect(rows.find((r) => r.measure === "applicable_percentage_floor" && r.value === 0.09)).toBeTruthy();
    expect(rows.find((r) => r.measure === "applicable_percentage_floor" && r.value === 0.04)).toBeTruthy();
    expect(get("eligible_basis_multiplier").value).toBe(1.3);
    expect(get("max_rent_share").value).toBe(0.3);
  });

  it("high cost percentages are 270 percent or 405 percent (special limit areas) with the notice's own row as quote", () => {
    const h = rows.filter((r) => r.section === "hud_high_cost_percentages");
    expect(h.length).toBeGreaterThan(90);
    for (const r of h) expect([2.7, 4.05]).toContain(r.value);
    expect(h.find((r) => r.jurisdiction.startsWith("Honolulu")).value).toBe(4.05);
  });

  it("withholds from display what the publisher's terms were not confirmed to allow", () => {
    for (const r of rows.filter((x) => x.section === "state_hard_cost_per_unit")) expect(r.display_allowed).toBe(false);
    expect(FR._source.not_obtained.length).toBeGreaterThan(0);
  });
});

describe("hud_income_limits.json", () => {
  it("covers the manifest counties HUD serves, with the fiscal year the API returned", () => {
    // Los Angeles and Orange are not in the manifest (the page loads them from app/data/) but need rows too: they were
    // missing from the first run, in neither the rows nor the failed list.
    const manifest = Array.from(new Set([...json(path.join(__dirname, "../../counties/manifest.json")).counties.map((c: any) => c.fips), "06037", "06059"]));
    const got = new Set(IL.counties.map((c: any) => c.fips));
    const failed = new Set(IL._source.failed.map((f: any) => f.fips));
    for (const f of manifest) expect(got.has(f) || failed.has(f), f).toBe(true);
    expect(IL.counties.length + IL._source.failed.length).toBe(manifest.length);
    expect(IL._source.county_count).toBe(IL.counties.length);
    expect(IL._source.fiscal_year).toBe("2026");
    for (const f of IL._source.failed) expect(["09", "23", "25", "33", "44", "50"]).toContain(f.fips.slice(0, 2)); // New England: town-level areas
    for (const c of IL.counties) {
      for (const k of ["il30", "il50", "il80"]) {
        expect(c[k].length).toBe(8);
        for (let i = 1; i < 8; i++) expect(c[k][i]).toBeGreaterThanOrEqual(c[k][i - 1]);
      }
      expect(c.il30[3]).toBeLessThan(c.il50[3]);
      expect(c.il50[3]).toBeLessThan(c.il80[3]);
      expect(c.median_income).toBeGreaterThan(20000);
    }
  });

  it("Los Angeles County (06037) and Orange County (06059) have rows that equal the saved HUD responses", () => {
    for (const [fips, name] of [["06037", "Los Angeles County, CA"], ["06059", "Orange County, CA"]]) {
      const raw = JSON.parse(fs.readFileSync(path.join(FX, "hud_il", fips + ".json"), "utf-8")).data;
      const row = IL.counties.find((c: any) => c.fips === fips);
      expect(row, fips).toBeTruthy();
      expect(row.county_name).toBe(raw.county_name);
      expect(row.county_name).toBe(name);
      expect(row.il50).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => raw.very_low[`il50_p${n}`]));
      expect(IL._source.failed.some((f: any) => f.fips === fips)).toBe(false);
    }
  });

  it("the fetch script includes the two counties the manifest does not list", () => {
    const src = fs.readFileSync(path.join(__dirname, "../../scripts/costs/fetch_hud_income_limits.py"), "utf-8");
    expect(src).toContain('EXTRA_FIPS = ["06037", "06059"]');
    expect(src).toMatch(/fips_list = sorted\(\{c\["fips"\] for c in counties\} \| set\(EXTRA_FIPS\)\)/);
  });

  it("values equal the saved HUD API responses", () => {
    for (const f of fs.readdirSync(path.join(FX, "hud_il"))) {
      const raw = JSON.parse(fs.readFileSync(path.join(FX, "hud_il", f), "utf-8")).data;
      const row = IL.counties.find((c: any) => c.fips === f.replace(".json", ""));
      expect(row, f).toBeTruthy();
      expect(row.median_income).toBe(raw.median_income);
      for (let n = 1; n <= 8; n++) {
        expect(row.il30[n - 1]).toBe(raw.extremely_low[`il30_p${n}`]);
        expect(row.il50[n - 1]).toBe(raw.very_low[`il50_p${n}`]);
        expect(row.il80[n - 1]).toBe(raw.low[`il80_p${n}`]);
      }
      expect(row.year).toBe(raw.year);
    }
  });
});
