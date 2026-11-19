// One-off live check (16 Nov 2026) that the parcel services fixed in this round return a parcel at a real point.
// MN and Sioux Falls points are taken from inside a parcel on each layer (the first test points fell in streets or a
// county outside the MN opt-in set).
// Run: NODE_USE_ENV_PROXY=1 node --experimental-strip-types scripts/check_fixed_parcels.mts
import { parcelAt } from "../workers/parcels.ts";

const pts: [string, number, number, string][] = [
  ["MN Clay County", 46.760993, -96.251954, "27027"], ["CRCOG Hartford", 41.7766, -72.6977, "09003"], ["Sioux Falls", 43.601044, -96.679205, "46099"],
  ["WestCOG Stamford", 41.082, -73.55, "09001"], ["St Charles", 38.7865, -90.5021, "29183"], ["NYS Buffalo", 42.9218, -78.8601, "36029"],
  ["Philadelphia", 39.9575, -75.182, "42101"], ["Detroit", 42.38, -83.07, "26163"], ["Clark NV", 36.135, -115.205, "32003"],
];
for (const [n, lat, lng, f] of pts) {
  const r = await parcelAt(lat, lng, f);
  console.log(n.padEnd(18), r.ok ? "OK " + r.value.service.slice(0, 40) + " " + JSON.stringify(r.value.fields).slice(0, 150) : "NULL " + r.error);
}
