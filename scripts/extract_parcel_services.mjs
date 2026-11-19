// Generates app/data/parcel_services.json from the page's own parcel-service registry in app/app.js (PARCELS87 and
// LA County's PARCEL_URL / PARCEL_FIELDS), so the AI advisor's parcel tool queries exactly the services the page does.
// Do not edit the JSON by hand; run: node scripts/extract_parcel_services.mjs  (tests/unit/parcels.test.ts checks it matches)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function extractParcelServices(js) {
  const reg = JSON.parse(js.match(/^const PARCELS87 = (\[.*\]);?\s*$/m)[1]);
  const laUrl = js.match(/^const PARCEL_URL = "([^"]+)"/m)[1];
  const block = js.slice(js.indexOf("const PARCEL_FIELDS = "), js.indexOf('.join(",");', js.indexOf("const PARCEL_FIELDS = ")) + 11);
  const laFields = new Function(`return ${block.replace("const PARCEL_FIELDS = ", "").replace(/;\s*$/, "")}`)().split(",");
  const la = {
    url: laUrl.replace(/\/query$/, ""),
    states: ["06", "CA"],
    counties: ["06037"],
    name: "Los Angeles County Assessor parcels (LA County GIS)",
    terms: "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer",
    fields: laFields.map((f) => [f, f]),
  };
  return { _source: { generated_from: "app/app.js (PARCELS87, PARCEL_URL, PARCEL_FIELDS)", script: "scripts/extract_parcel_services.mjs" }, services: [la, ...reg] };
}

if (process.argv[1] && process.argv[1].endsWith("extract_parcel_services.mjs")) {
  const out = extractParcelServices(fs.readFileSync(path.join(root, "app/app.js"), "utf8"));
  fs.writeFileSync(path.join(root, "app/data/parcel_services.json"), JSON.stringify(out, null, 1) + "\n");
  console.log(`wrote ${out.services.length} parcel services`);
}
