# City Pretty: plan from "scores on a map" to "what to buy, what to build"

Written 18 Nov 2026 on a smaller branch; updated 19 Nov when that branch was merged into this one. For status, read
`WORK-QUEUE.md` and `DATA-AUDIT-AND-TRANSPARENCY.md`, not this file.

## The goal

Open a county and get one decision brief:

1. **Where to invest**: neighborhoods ranked, with the reason and how much the ranking has been right in the past.
2. **What to build there**: public improvements and housing plays, ranked by return and by strength of evidence.
3. **Which properties to redevelop**: real sites (golf courses, surface parking, vacant and surplus land) with measured
   acreage, owner, zoning and a transparent homes-and-margin estimate.
4. **What to add to a given house**: ADU, lot split, added rooms or storey; what the law allows, what it costs, what it adds.
5. **Transit**: build or not, and at what scale (more buses, BRT, light rail, regional rail, HSR), with cost benchmarks.
6. **An AI advisor** that reads the same brief and can look things up, and cannot state a number the brief does not hold.

A limit to state once: no model can say *exactly* which neighborhood will rise. What this plan delivers instead is a
ranking whose past hit rate is measured and shown, so the confidence on each recommendation is earned, not asserted.

## Where it stands

This plan was written on a smaller branch on 18 Nov. On 19 Nov it was merged into the long-running accuracy branch,
whose data tables were kept (see the 19 Nov entry in `DATA-AUDIT-AND-TRANSPARENCY.md`). What is being worked on now and
next is in `WORK-QUEUE.md`; what has been checked, and every correction, is in `DATA-AUDIT-AND-TRANSPARENCY.md` and
`docs/audit/`.

## The Invest view (wired into this base 19 Nov)

- An **Invest** button beside Map and Explore (`app/invest.js`, engine `src/engines/investmentDecisionEngine.js`):
  pick a county (or search an address), get the brief in five cards: where, what to build, which sites, this house,
  transit. Each number shows its basis (measured, modelled, assumed) and opens its source. One budget control ($100k to
  $50M+) changes which plays are listed; it does no financial maths.
- It follows this base's verification: improvement ideas carry figures only where `intervention_verification.json`
  allows (the rest are named without figures), laws come from the statute engine and `statutes.json`, a corridor's
  length or cost is used only when its own record confirms it, and a site's model estimates are shown as unverified.
- `npm run brief -- <fips>` prints the same brief with no AI (`scripts/brief.mjs`).
- The page sends a compact form of the brief to the AI advisor (`context.decision_brief`, at most 20,000 characters;
  `src/ai/advisorGroundingContract.ts`). The advisor itself is `workers/api-proxy.ts` and `workers/advisorAgent.ts`.

## What is still missing (depth where it pays most)

Ranked by expected gain in accuracy:

1. **Sales and assessor attributes for more counties** (free where published; ATTOM or Regrid if bought). Drives both
   the valuation error and the "what does an added bedroom or ADU add here" answer.
2. **Systematic site discovery** from OpenStreetMap and parcel services for every county, replacing the curated list.
3. **Live zoning for more cities** (National Zoning Atlas, city services); without zoning, per-lot advice stays "not determined".
4. **Building permits** (city open data; Shovels if bought) as a leading signal in the neighborhood score.
5. **Round 8.6 pipeline re-run** (stale bus schedules, 150 more counties) from `NEXT_ROUND.md`.
6. **Monthly re-verification**: the link checker (`scripts/check_sources.py`, already scheduled) and the back-tests run on a schedule and open an issue when something drifts.

## How "accurate" is measured from now on

| Claim | Measure | Shown on the page |
|---|---|---|
| Home value | Median absolute error vs recorded sales, per county, vs a naive baseline | Range from the county's own error; withheld where untested or poor |
| Neighborhood ranking | Top-minus-bottom quintile appreciation over the next 5 years, out of sample | Hit rate beside the ranking |
| Law and funding facts | Share of rows verified against the statute | "Not determined" for the rest |
| Costs and rents | Pulled from the agency's own published figures, dated | Source and year on each figure |
