import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const scriptPath = path.join(root, "scripts/fetch_fhfa_hpi_tract.py");

describe("FHFA Tract HPI Ingest Pipeline (scripts/fetch_fhfa_hpi_tract.py)", () => {
  it("parses sample long-form CSV with blank HPI handling and correct citation metadata", () => {
    const tmpCsv = path.join(root, "tests/fixtures/sources/test_fhfa_sample.csv");
    const tmpOut = path.join(root, "tests/fixtures/sources/test_fhfa_sample_out.json");

    // Sample data including tract 06037101110 from verification supplement 3:
    // 2015: 750.00
    // 2020: 1000.00
    // 2023: . (blank / missing)
    // 2024: 1237.42
    // 2025: 1297.06, annual change 4.82
    const csvContent = [
      "tract,state,year,annual_change,hpi,hpi1990,hpi2000",
      "06037101110,CA,2015,5.12,750.00,.,150.2",
      "06037101110,CA,2020,6.50,1000.00,.,200.5",
      "06037101110,CA,2023,.,.,.,.", // missing year
      "06037101110,CA,2024,7.20,1237.42,.,245.1",
      "06037101110,CA,2025,4.82,1297.06,.,258.9",
      "48453000302,TX,2025,13.28,954.01,.,.",
    ].join("\n");

    fs.writeFileSync(tmpCsv, csvContent, "utf8");

    try {
      execSync(`python3 "${scriptPath}" --input "${tmpCsv}" --output "${tmpOut}"`, {
        cwd: root,
        encoding: "utf8",
      });

      expect(fs.existsSync(tmpOut)).toBe(true);
      const out = JSON.parse(fs.readFileSync(tmpOut, "utf8"));

      // Verification supplement 4 metadata requirements:
      expect(out._meta.citation).toBe("Source: FHFA HPI (Annual, All-Transactions)");
      expect(out._meta.status_label).toBe("developmental");
      // 19 Nov 2026: the "FHFA FAQ Q32" licence citation could not be found on FHFA's site, so the licence is marked unconfirmed.
      expect(out._meta.licence).toContain("Not confirmed");
      expect(out._meta.note).toContain("Developmental Index");

      // Verification supplement 3 sample tract:
      const laTract = out.tracts["06037101110"];
      expect(laTract).toBeDefined();
      expect(laTract.state_abbr).toBe("CA");
      expect(laTract.latest_year).toBe(2025);
      expect(laTract.latest_hpi).toBe(1297.06);
      expect(laTract.annual_change_pct).toBe(4.82);

      // 5-year CAGR: (1297.06 / 1000.00)^(1/5) - 1 = 5.34%
      expect(laTract.five_year_cagr_pct).toBeCloseTo(5.34, 1);

      // 10-year appreciation: (1297.06 - 750.00) / 750.00 = 72.94%
      expect(laTract.ten_year_appreciation_pct).toBeCloseTo(72.94, 1);

      // Blank HPI in 2023 was ignored and not zeroed:
      expect(laTract.series_count).toBe(4);
    } finally {
      if (fs.existsSync(tmpCsv)) fs.unlinkSync(tmpCsv);
      if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    }
  });

  it("filters by county FIPS when requested", () => {
    const tmpCsv = path.join(root, "tests/fixtures/sources/test_fhfa_filter.csv");
    const tmpOut = path.join(root, "tests/fixtures/sources/test_fhfa_filter_out.json");

    const csvContent = [
      "tract,state,year,annual_change,hpi",
      "06037101110,CA,2025,4.82,1297.06",
      "48453000302,TX,2025,13.28,954.01",
    ].join("\n");

    fs.writeFileSync(tmpCsv, csvContent, "utf8");

    try {
      execSync(`python3 "${scriptPath}" --county 06037 --input "${tmpCsv}" --output "${tmpOut}"`, {
        cwd: root,
        encoding: "utf8",
      });

      const out = JSON.parse(fs.readFileSync(tmpOut, "utf8"));
      expect(out.tracts["06037101110"]).toBeDefined();
      expect(out.tracts["48453000302"]).toBeUndefined();
      expect(out._meta.target_county_fips).toBe("06037");
    } finally {
      if (fs.existsSync(tmpCsv)) fs.unlinkSync(tmpCsv);
      if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    }
  });
});
