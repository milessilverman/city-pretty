# Ease-of-use audit, 20-22 November 2026

Who this is for: a property investor or developer, on a laptop and sometimes a phone, who picks a city or types an
address, lands on a neighborhood, and wants that neighborhood's numbers without hunting.

How it was done: the page was used through a real browser (Playwright, 1440x900 and 390x844) against the local server
with real outside services, in Los Angeles County, Travis County TX (48453) and Kent County MD (24029, loaded from
R2), plus Cook County IL for the county switch. The AI Worker was stubbed; no real question was sent. Screenshots are
in `docs/audit/usability-2026-11-20/` (`before-*` and `after-*`). A "step" is a click, a tap or an Enter press;
typing is not counted. No figure, source, withholding rule or calculation was changed.

## Steps per journey, before and after

| Journey | Before | After |
|---|---|---|
| a. Arrive cold, find a named neighborhood and its numbers | 2 steps + 1 scroll (rent 1.2 screens down); clicking a suggestion with the mouse went to the wrong place | 2 steps, 0 scrolls |
| b. Street address to its neighborhood and its lot | 2 steps; lot section sat under the "Best bet" sentence; next click was lost | 2 steps; lot section directly under the header; the panel says what was matched |
| c. Median rent | 1 scroll | 0 |
| c. Crash figures | about 4 scrolls + 1 click (closed "Area Profile" section); blank on a first visit | 0 |
| c. Nearest transit | 1 scroll | 0 |
| c. Flood status | not mentioned in the neighborhood panel; on a lot, about 4 screens down | tile says it is per lot (0); 1 click to the hint, 1 to zoom to lots, 1 on a lot: the map popup shows the FEMA zone |
| c. Zoning and what the law allows | about 3 scrolls + 1 click | most common zone in view (0); rules and state laws 1 click |
| d. Compare two neighborhoods | 8 steps (two lost clicks, then Menu, then Compare) and no cue that anything was added | 5 steps (Add, search, Enter, Add, View comparison) |
| e. "What should be built here" and back | 1 step to Invest, which showed the county's first-ranked area, not the open one (no route for most areas); 1 back | 1 step to Build for the open area; 1 step back to it on the map |
| f. Ask the advisor about the open neighborhood | 2 steps | 2 steps (unchanged; a plain data question is now answered from the page's own figures by the script layer another change added) |
| g. Switch counties mid-task | 2 steps; header could keep naming the previous county; old search text stayed | 2 steps; header correct; search box cleared |

The same counts were measured at phone width. Each journey has a test in `tests/e2e/usability.spec.ts` asserting the
"after" count.

## Findings, ranked by cost to the user

1. **Clicking a search suggestion ran the half-typed text instead, and could leave the county.** Leaving the search
   box fired a second search. Typing "Echo P" in Los Angeles and clicking a suggestion opened Echo, Oregon with an
   empty panel (`before-desk-sugg-click.jpg`). Fixed: the search runs on Enter or on a suggestion click only.
2. **The first click after any search was lost and the panel redrew.** Same cause; "Compare" needed two clicks.
   Fixed with 1.
3. **Suggestions in Los Angeles came from Orange County's name list**, so "Silver Lake" offered Silver Lake, North
   Carolina and no local match (`before-desk-a3-typed-silver-lake.jpg`). Fixed: names of the county that is open,
   best match first, under "Neighborhoods in <county>"; Enter on part of a name opens the best match. Hovering the
   list also threw a script error on every pointer move (Leaflet `closeTooltip` with no tooltip). Fixed.
4. **A search that found a place with no data stranded the map** on empty water with the old county in the header
   (`before-desk-search-zzqqx.jpg`). Fixed: the map and county stay, and a message says the place has no data.
5. **A ZIP code opened whichever lot sat at the ZIP's center.** Fixed: a ZIP or town opens the area at its center, no
   lot, and the panel says a ZIP covers several areas.
6. **The header named the wrong county after switching between two counties** (Travis then Kent showed "Travis
   County, TX" over Kent's data, `before-desk-g3-loaded-24029.jpg`; the same happened Cook to Travis). The header
   read the county from the block group still selected from the previous county. Fixed: that selection is cleared on
   switch. Checked Los Angeles to Cook to Travis to Kent.
7. **The numbers were below a screen of public-project cards.** Home value, rent and crime started 1.2 screens down;
   income, crashes, schools and zoning were in closed sections 3 to 4.5 screens down
   (`before-desk-a4-silver-lake-selected.jpg`). Fixed: the panel opens with "The numbers for this area", twelve
   tiles, each with unit, source and, where missing, "not on file" and why (`after-desk-a-silver-lake.jpg`).
8. **A name such as "Silver Lake" is one of 25 map areas with that name, and nothing said so.** The panel showed 461
   homes under the heading "Silver Lake". Fixed: a line says "One of 25 areas on this map named Silver Lake. The
   numbers below are for this one area".
9. **No route from a neighborhood to what to build there.** Invest ignored the open area. Fixed: "What to build here"
   opens Invest's Build card for it, with "Back to this area on the map"; an area outside the Where ranking says so.
10. **Compare gave no cue and was two levels away.** Fixed: the button reads "Add to compare" / "In comparison
    (remove)", and "View comparison (n)" appears beside it.
11. **Phone: the search box was about 100 px wide** (`before-phone-a4-silver-lake-selected.jpg`). Fixed: search has
    its own row. The zoning key is capped so it no longer covers most of the map.
12. **Deep in the panel there was no sign of which area was open and no way back.** Fixed: a jump row stays at the
    top (area name, Numbers, A lot, Zoning, Projects, Sites, All numbers); the name returns to the top and the map.
13. **Section names needed explaining** ("Geography-Specific Improvements (Coastal vs. Inland Trails)", "EIFD
    Tax-Increment Financing Calculator", "Technical Appendix & Data Pipeline Status"). Renamed in plain words and
    grouped: More numbers; What can be built; Public projects that could raise values here; Paying for it, and the
    data behind this page. Nothing was removed.
14. **Labels without units**: "Heat vs median", "Violent crime 4.8 per 1k / 12 mo", "Bus service 0/hr rail 1.2 mi",
    "Median rent –" with no reason. Reworded; the same words are used as in the map's color menu and Compare.
15. **A value range ran off the edge of its card.** Fixed (wraps).
16. **The lot popup opened under the map toolbar** (`before-desk-b2-address-entered.jpg`). Fixed with padding.
17. **Screen-reader and keyboard basics**: eight close buttons had no name; the suggestion list had none; the
    lightest text was 3.5:1 against the panel (now 4.8:1, same hue); focus outlines added in the panel.
18. **Invest**: rows showed catalog codes ("qol", "value", "owner"), now words; the new "Courses of action" card was
    missing from Invest's jump row, now added. Its empty and loading states read clearly and were left as they are.
19. A crash count can be a fraction (a crash on a shared boundary is split). The tile now says so.

## Left as it is, and why

- **The advisor's chat path and its quick-question buttons** (lot questions shown when only a neighborhood is open):
  another change is in that code.
- **Transit card wording** ("bus rapid transit (brt)" in the bottom line) and the statute engine: same reason.
- **The Top 3 public-project cards stay**, below the numbers: they are the page's own subject, and the Invest view
  already serves the investor reading.
- **No neighborhood-wide totals** across the 25 "Silver Lake" areas: that would be a new calculation.
- **On a phone the color legend and zoning key still overlap the lot popup**; the lot's facts are in the panel below.
- **A county switch still opens one default area**, which the user did not pick; it gives the panel something to show.

## Found, not changed (needs the owner's decision)

- The "Zoning" section falls back to whatever zones are loaded in the current map view when an area has no zoning
  shares of its own, and labels them "Predominant zoning in <city>". After visiting Austin, Kent County MD showed
  "SF-3-NP". The new Zoning tile does not use that fallback. Logged in `docs/DATA-AUDIT-AND-TRANSPARENCY.md`.
- 1200 Getty Center Dr shows "Zoning A1-1-H" in the lot table and "Zoning is not on file for this parcel" in the
  owner playbook beneath it.
