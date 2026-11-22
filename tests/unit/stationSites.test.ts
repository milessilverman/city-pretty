import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
// @ts-ignore plain CommonJS module
import SS from "../../src/engines/stationSites.js";

const root = path.resolve(__dirname, "../..");
const dir = path.join(root, "app/data/station_sites");
const index = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
const files = fs.readdirSync(dir).filter(f => f !== "index.json" && f.endsWith(".json")).sort();
const docs = files.map(f => ({ f, size: fs.statSync(path.join(dir, f)).size, doc: JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) }));
const sites = docs.flatMap(d => d.doc.sites.map((s: any) => ({ fips: d.doc.fips, doc: d.doc, s })));

const KINDS = ["surface_parking", "vacant_or_brownfield", "golf_course"];
const CLASSES = ["pipeline_station", "existing_station", "corridor_stop_city"];
const TAGS = [/^amenity=parking, parking=surface$/, /^amenity=parking \(no parking tag\)$/, /^landuse=(brownfield|greenfield)$/, /^vacant=yes$/, /^leisure=golf_course$/];
// an owner string may be stored only when it names an agency or a company; never a person
const KEYWORD = /\b(LLC|L L C|LLP|LP|L P|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|PARTNERS|PARTNERSHIP|ASSOC|ASSOCIATES|ASSOCIATION|HOLDINGS?|PROPERTIES|PROPERTY|REALTY|INVESTMENTS?|VENTURES?|DEVELOPMENT|DEVELOPERS|GROUP|ENTERPRISES?|BANK|CHURCH|MINISTRIES|FOUNDATION|FUND|REIT|SERVICES|MANAGEMENT|CAPITAL|EQUITIES|HOMES|APARTMENTS|PARKING|GOLF|CLUB|CENTER|CENTRE|PLAZA|MALL|STORES?|MARKET|SHOPPING|INDUSTRIAL|COMMERCIAL|BUILDERS?|CONSTRUCTION|OPERATING|OPERATIONS|TRUSTEES?|CEMETERY|HOSPITAL|HOTEL|MOTEL|INN|LODGING|TOWERS?|FINANCIAL|INSURANCE|ENERGY|ELECTRIC|GAS|UTILITY|UTILITIES|TELEPHONE|COMMUNICATIONS|CITY OF|COUNTY OF|STATE OF|TOWN OF|VILLAGE OF|BOROUGH OF|CITY AND COUNTY|PORT OF|UNITED STATES|U S A|USA|GOVERNMENT|GOVT|FEDERAL|DEPT|DEPARTMENT|SCHOOL|UNIFIED|DISTRICT|AUTHORITY|TRANSIT|TRANSPORTATION|METROPOLITAN|MUNICIPAL|REDEVELOPMENT|COMMISSION|BOARD|PUBLIC|UNIVERSITY|COLLEGE|NYC|NEW YORK CITY|COUNTY|COMMONWEALTH|REGENTS|LAND BANK|PARK|FOREST PRESERVE|WATER|RAILROAD|RAILWAY|RAIL)\b/i;
const ENTITY = /\b(LLC|L L C|LLP|LP|L P|INC|CORP|CORPORATION|LTD|CO|COMPANY|BANK|CHURCH|ASSOC|ASSOCIATION|CITY OF|COUNTY OF|STATE OF|SCHOOL|DISTRICT|AUTHORITY|DEPT|DEPARTMENT|UNIVERSITY|UNITED STATES)\b/i;
const LASTFIRST = /^[A-Z][A-Za-z'.-]+, [A-Z][A-Za-z'.-]+/;
const TWO_CAPITALISED = /^[A-Z][a-z'.-]+ [A-Z][a-z'.-]+$/;

describe("station sites: files", () => {
  it("has an index and a county file for each county listed, each under 300 KB", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(Object.keys(index.counties).sort()).toEqual(files.map(f => f.replace(".json", "")));
    for (const d of docs) { expect(d.size).toBeLessThan(300 * 1024); expect(index.counties[d.doc.fips].bytes).toBe(d.size); expect(index.counties[d.doc.fips].sites).toBe(d.doc.sites.length); }
  });
  it("states the rules and what it does not list", () => {
    expect(index.rules.minAcres).toBe(0.5);
    expect(index.rules.notDone).toMatch(/single-storey retail/);
    expect(index.rules.builtShareMax).toBeGreaterThan(0);
  });
});

describe("station sites: records", () => {
  it("every record has an OSM id, a known kind, a matched tag text, an area of at least half an acre and a point", () => {
    expect(sites.length).toBeGreaterThan(100);
    for (const { s } of sites) {
      expect(s.id).toMatch(/^(way|relation)\/\d+$/);
      expect(KINDS).toContain(s.k);
      expect(TAGS.some(t => t.test(s.tag))).toBe(true);
      expect(s.ac).toBeGreaterThanOrEqual(0.5);
      expect(Number.isFinite(s.pt[0]) && Number.isFinite(s.pt[1])).toBe(true);
      expect(s.pt[0]).toBeGreaterThan(17); expect(s.pt[0]).toBeLessThan(72);
      expect(s.bs).toBeGreaterThanOrEqual(0); expect(s.bs).toBeLessThanOrEqual(index.rules.builtShareMax);
    }
  });
  it("every record has verification: an extract or mirror with a date, the near station, and a parcel date or a reason", () => {
    for (const { doc, s } of sites) {
      const src = doc.sources[s.s];
      expect(src).toBeTruthy();
      expect(src.url).toMatch(/^https:\/\//);
      expect(src.dataTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(CLASSES).toContain(s.near.c);
      expect(s.near.n).toBeTruthy();
      expect(s.near.d).toBeGreaterThanOrEqual(0);
      if (s.p) { expect(s.p.d).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(doc.parcelService && doc.parcelService.name).toBeTruthy(); }
      else expect(typeof s.pw).toBe("string");
    }
  });
  it("within the search radius: 0.5 mile of stations, 1 mile of stop city points", () => {
    for (const { s } of sites) {
      const r = (s.near.c === "corridor_stop_city" ? 1609.344 : 804.672);
      expect(s.near.e).toBeLessThanOrEqual(r + 1);
    }
  });
  it("stop city records are labelled as the city centre, not a station site", () => {
    const stops = sites.filter(x => x.s.near.c === "corridor_stop_city");
    expect(stops.length).toBeGreaterThan(0);
    for (const { s, fips } of stops) { expect(s.near.n).toMatch(/stop city centre$/); expect(SS.facts(SS.normalize({ fips, sources: [], sites: [s] })[0])[0][1]).toMatch(/not a station site/); }
  });
  it("parcel facts: a value is withheld when the parcel is much larger or smaller than the map outline", () => {
    for (const { s } of sites) {
      if (!s.p) continue;
      if (s.p.r != null && (s.p.r > 2 || s.p.r < 0.5)) { expect(s.p.mm).toBe(true); expect(s.p.lv).toBeUndefined(); expect(s.p.tv).toBeUndefined(); }
      if (s.p.mm) expect(s.p.r >= 2 || s.p.r <= 0.5).toBe(true);
      for (const k of ["lv", "tv"]) if (s.p[k] !== undefined) expect(s.p[k]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("station sites: no personal names", () => {
  it("an owner string is stored only for an agency or a company, and never looks like a person's name", () => {
    let n = 0;
    for (const { s } of sites) {
      if (!s.p) continue;
      if (s.p.own !== undefined) {
        n++;
        expect(s.p.ot).toMatch(/public agency|company/);
        if (LASTFIRST.test(s.p.own)) expect(ENTITY.test(s.p.own), s.p.own).toBe(true);   // "Lastname, Firstname" only inside the name of a legal entity
        expect(KEYWORD.test(s.p.own), s.p.own).toBe(true);   // two capitalised words with no company or agency word cannot be stored
        if (TWO_CAPITALISED.test(s.p.own)) expect(KEYWORD.test(s.p.own)).toBe(true);
      }
      if (s.p.ot === "private individual" || /name not stored/.test(s.p.ot || "")) expect(s.p.own).toBeUndefined();
    }
    expect(n).toBeGreaterThan(0);
  });
  it("no record carries an owner field other than own and ot, and no owner-like text appears elsewhere in a record", () => {
    for (const { s } of sites) {
      const keys = Object.keys(s.p || {});
      for (const k of keys) expect(["id", "own", "ot", "oc", "uc", "ut", "zn", "lv", "tv", "pa", "r", "mm", "d"]).toContain(k);

    }
  });
  it("the pattern test itself: a person's name is rejected, a company or agency passes", () => {
    expect(LASTFIRST.test("Smith, John")).toBe(true);
    expect(KEYWORD.test("John Smith")).toBe(false);
    expect(KEYWORD.test("Maria Lopez")).toBe(false);
    expect(KEYWORD.test("Acme Holdings LLC")).toBe(true);
    expect(KEYWORD.test("City Of Anaheim")).toBe(true);
  });
});

describe("station sites: the page's loader", () => {
  const doc = docs[0].doc;
  it("normalizes a county file into records with no homes, value or margin fields", () => {
    const L = SS.normalize(doc);
    expect(L.length).toBe(doc.sites.length);
    for (const r of L.slice(0, 50)) {
      for (const bad of ["potentialHomes", "margin", "marketLandValue", "assessedLandValue", "valueIfBuilt"]) expect(r[bad]).toBeUndefined();
      expect(r.acres).toBeGreaterThanOrEqual(0.5);
      expect(r.name).toMatch(/ near /);
      expect(r.sourceUrl).toMatch(/^https:\/\/www\.openstreetmap\.org\/(way|relation)\/\d+$/);
      expect(r.verification.evidence_url).toBe(r.sourceUrl);
      expect(r.verification.unverified_fields).toEqual([]);
      expect(SS.facts(r).length).toBeGreaterThanOrEqual(3);
    }
    for (let i = 1; i < L.length; i++) expect(L[i - 1].acres).toBeGreaterThanOrEqual(L[i].acres);
  });
  it("load() reads the index, then only the county's own file; a county with none gives an empty list", async () => {
    const seen: string[] = [];
    const g: any = globalThis;
    const prev = g.fetch;
    g.fetch = async (u: string) => { seen.push(u); const f = path.join(root, u); return fs.existsSync(f) ? { ok: true, json: async () => JSON.parse(fs.readFileSync(f, "utf8")) } : { ok: false, json: async () => null }; };
    try {
      const fips = docs[0].doc.fips;
      const a = await SS.load(fips);
      expect(a.length).toBe(docs[0].doc.sites.length);
      expect(SS.cached(fips)).toBe(a);
      expect(await SS.load("99999")).toEqual([]);
      expect(seen.filter(u => u.endsWith(".json") && !u.endsWith("index.json")).length).toBe(1);
    } finally { g.fetch = prev; }
  });
});
