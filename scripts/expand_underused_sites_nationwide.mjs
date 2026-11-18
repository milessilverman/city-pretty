/**
 * DISABLED. This script used to append hand-typed "verified" sites (acreage, assessed values, block
 * groups, home counts and margins typed from memory) to app/data/underused_sites.json. An audit on
 * 2026-11-18 found those values did not match the real places, so it must not run again.
 *
 * To add sites: put county FIPS + OpenStreetMap object id + kind in scripts/underused_site_seeds.json
 * and run `node scripts/build_underused_sites.mjs`, which fetches every attribute from its source.
 */
console.error("expand_underused_sites_nationwide.mjs is disabled: it injected typed data. Use scripts/build_underused_sites.mjs with scripts/underused_site_seeds.json instead.");
process.exit(1);
