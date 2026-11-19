// Live smoke test of workers/sources.ts against the real public services.
// Run: NODE_USE_ENV_PROXY=1 node --experimental-strip-types scripts/smoke_sources.mts [lat lng]
import { siteFacts, geocodeAddress, osmNearby } from "../workers/sources.ts";
const lat = Number(process.argv[2] ?? 30.3005), lng = Number(process.argv[3] ?? -97.724);
const show = (k: string, r: any) => console.log(k.padEnd(22), r ? (r.ok ? "OK   " + JSON.stringify(r.value).slice(0, 220) : "NULL " + r.error) : "skipped");
const addr = await geocodeAddress("811 E 41st St, Austin, TX");
show("geocodeAddress", addr);
const f = await siteFacts(lat, lng, { censusApiKey: process.env.CENSUS_API_KEY });
for (const [k, v] of Object.entries(f)) if (typeof v === "object") show(k, v);
show("osm buildings", await osmNearby(lat, lng, 150, "buildings"));
