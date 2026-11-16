// Explore mode: the same county data as the map, laid out as cards and plain-language stories for people who would
// rather not read a map. It reads the globals app.js sets up (D, D_OC, activeCounty, byId, select, map, ...) and
// never changes the data; "See it on the map" hands off to the map view with the same neighborhood selected.
// Explanations here describe what each idea is in everyday words; every number shown comes from the county's data.
(() => {
"use strict";

// One plain sentence per improvement idea: what it is, no figures.
const PLAIN = {
  street_trees: "Plant young trees in the empty tree spots along sidewalks. Trees shade streets and homes, cool the block on hot days and make walks nicer.",
  schoolyard_green: "Pull up asphalt at a school and put in trees, grass and gardens, so kids have a cooler, greener place to play.",
  vacant_lot_green: "Clear trash from empty lots, plant grass and trees and put up a low fence, so the lot stops dragging the block down.",
  community_garden: "Turn a piece of land into garden plots that neighbors can rent to grow their own food and flowers.",
  green_alley: "Repave an alley with surfaces that soak up rain, and add plants and lights, so it is cleaner and safer to walk.",
  cool_pavement: "Coat hot streets with a light-colored layer that reflects sunlight, so the pavement and the air above it stay cooler.",
  pocket_park: "Buy a small lot and turn it into a tiny neighborhood park with benches, shade and a little play space.",
  park_upgrade: "Fix up the park that is already nearby: a new playground, better paths, lights and seating.",
  pickleball: "Restripe an old tennis court so it fits several pickleball courts, a fast-growing sport for all ages.",
  tennis: "Build public tennis courts that anyone can use for free.",
  basketball: "Build a public basketball court, one of the most-used things a park can have.",
  dog_park: "Fence off an area where dogs can run off-leash and owners can meet.",
  pool: "Build a public swimming pool, a place to cool off and learn to swim for families without their own.",
  splash_pad: "Put in a water-play area with fountains and sprays for young kids, with no deep water.",
  skate_park: "Build a concrete skate park for skateboards, scooters and bikes.",
  sports_field: "Build a grass field for soccer, baseball and other team sports.",
  rec_center: "Build a recreation center with rooms for classes, after-school programs and community events.",
  restroom: "Add clean restrooms and drinking fountains to a park so people can stay longer.",
  bus_lane: "Paint lanes that only buses can use on a busy street, so buses stop getting stuck in traffic.",
  brt: "Run fast, frequent buses that act like a train: their own lanes, real stations and green lights when they arrive.",
  rail_station: "Build a new light-rail line with a station nearby. A big regional project; this counts the local share.",
  bus_shelters: "Put up shelters with shade and seats at busy bus stops, so waiting is not miserable in the sun or rain.",
  traffic_calming: "Add speed humps and other street changes that make drivers slow down on neighborhood streets.",
  crosswalks: "Make crossings safer: wider curbs at corners, ramps, and islands in the middle of wide streets.",
  road_diet: "Turn an extra car lane into protected bike lanes and a turn lane, which slows speeding and makes the street calmer.",
  sidewalks: "Fix cracked and lifted sidewalks so they are safe for strollers, wheelchairs and everyone else.",
  street_lighting: "Add brighter, people-height street lights so sidewalks feel safer after dark.",
  cameras: "Put security cameras at spots with repeated crime.",
  foot_patrol: "Have officers walk the blocks where crime is concentrated, rather than only drive through.",
  violence_interruption: "Fund trusted community workers who step in to stop fights and retaliation before someone gets hurt.",
  bid: "Local businesses pay a small fee for extra street cleaning and on-street helpers in their shopping district.",
  litter: "Pick up litter and illegally dumped furniture every week.",
  graffiti: "Paint over graffiti quickly, which tends to keep more from appearing.",
  encampment: "Offer people living on the street a place to stay first, then help with health care and jobs.",
  blight_rehab: "Fix up or rebuild run-down, empty houses so they become homes again.",
  affordable_housing: "Build homes with rents kept affordable for lower-income households, on land that is sitting underused.",
  adu: "A homeowner adds a small second home in the backyard or garage, to rent out or house family.",
  solar: "A homeowner puts solar panels on the roof to cut their electric bill.",
  undergrounding: "Bury the overhead power lines, which clears the view, frees room for trees and lowers fire risk.",
  ev_hub: "Build a cluster of fast chargers where electric-car drivers can top up.",
  microgrid: "Add solar panels and batteries to a community building so it keeps the power on during blackouts.",
  noise_wall: "Build a tall wall along the freeway to block traffic noise for the homes behind it.",
  freeway_cap: "Build a park on a deck over a sunken freeway, reconnecting the neighborhoods on either side. A big regional project; this counts the local share.",
  school_filters: "Put strong air filters in classrooms near freeways, so kids breathe less traffic pollution.",
  school_bond: "Modernize the local public school with money from a voter-approved school bond: new classrooms, labs and air conditioning.",
  library: "Upgrade the local library and keep it open longer.",
  clinic: "Open a community health clinic that charges based on what people can pay.",
  grocery: "Bring a full grocery store to a neighborhood that has to travel far for fresh food.",
  main_street: "Help the shops on the local main street with grants for new storefronts and small-business advice.",
  outdoor_dining: "Let restaurants put tables on the sidewalk or in a parking space (a parklet).",
  farmers_market: "Hold a weekly farmers market where local growers sell fresh food.",
  upzone_transit: "Change the rules so more homes, like apartments, can be built close to train and bus stations.",
  protected_bike: "Build bike lanes separated from cars by a curb, so people of all ages feel safe riding.",
  corridor_trail: "Build a walking and biking path along a power-line strip, old rail line or creek.",
  transit_priority: "Give buses early green lights and boarding platforms at the curb, so trips are quicker.",
  speed_cameras: "Use cameras that ticket drivers going well over the limit, where state law allows them.",
  roundabout: "Replace a stop-sign intersection with a small traffic circle that slows cars without stopping them.",
  ped_signals: "Give people walking a head start at crosswalks before cars can turn, and keep corners clear of parked cars so everyone can see.",
  school_street: "Close the street in front of a school to cars at drop-off and pick-up times.",
  murals: "Commission local artists to paint murals and public art.",
  tiny_forest: "Plant a small, very dense patch of native trees and shrubs that grows quickly into a mini forest.",
  fiber_5g: "Bring fast fiber internet to homes and better cell coverage to the area.",
  green_street: "Build planted strips and rain gardens along the curb that soak up storm water and add greenery.",
  stormwater_park: "Rebuild a park with a big underground tank that catches storm water, and new fields on top.",
  corner_store: "Change the rules and offer grants so small corner stores and cafés can open within neighborhoods.",
  food_hall: "Open a shared food hall where new small food businesses can get started.",
  park_cafe: "Add a small café stand in the park.",
  new_school: "Build a new public elementary school where nearby schools are crowded.",
  plaza: "Close a quiet commercial block to cars and turn it into a public square with seats and shade.",
  slow_streets: "Mark quiet streets as slow routes for walking and biking, with signs and small changes that keep cars slow.",
  transit_shade: "Put solar-panel roofs over busy bus stops: shade for riders and clean power.",
  bike_share: "Add a station of e-bikes anyone can rent for short trips.",
  ebike_library: "Lend e-bikes to residents for weeks at a time, so they can try riding instead of driving.",
  microtransit: "Run small on-demand electric shuttles that you book with an app or phone call.",
  alley_gating: "Gate, pave and light alleys where dumping and crime keep happening.",
  cooling_center: "Fit a library or rec center to serve as a cool, safe place to go during heat waves.",
  wayfinding: "Put up signs and maps that point people to transit, parks and local landmarks.",
  box_art: "Wrap the gray traffic-signal boxes on street corners in local art.",
  vending_zone: "Set up a spot for street vendors with power, water and shade.",
  night_market: "Hold a weekend evening market with food stalls and local sellers.",
  clt: "A nonprofit land trust buys a small apartment building and keeps its rents affordable for good.",
};

// What each kind of estimate means, in plain words
const KIND_TXT = {
  value: "Estimated to raise nearby home values",
  regional: "Big regional project; the local share is estimated",
  qol: "Makes daily life better (no home-value estimate)",
  owner: "Something a homeowner does on their own lot",
  policy: "A rule change, not a building project",
};
// (Catalog A-D grade descriptions removed 16 Nov 2026: labels now come from the verification audit; see gradeOf.)
const CAT_BLURB = {
  "Greening": "Trees, gardens and green space",
  "Parks & recreation": "Parks, courts, pools and places to play",
  "Transit": "Buses, trains and getting around",
  "Streets & safety": "Safer streets and fewer crashes",
  "Clean streets": "Cleaner, cared-for blocks",
  "Housing": "More and better homes",
  "Energy": "Power, charging and wires",
  "Environment": "Cleaner air and less noise",
  "Schools & services": "Schools, libraries and clinics",
  "Amenities & economy": "Shops, food and things to do",
  "Zoning": "Rules about what can be built",
};

const ex = { view: "map", tab: "ideas", cat: "All", q: "", hq: "", city: "", sort: "pay", shown: 24, idea: null, hood: null, area: null, fips: null };
const $ = s => document.querySelector(s);
const host = () => document.getElementById("explore");

function feats() {
  if (typeof activeCounty !== "undefined" && activeCounty === "oc" && typeof D_OC !== "undefined" && D_OC && D_OC.features) return D_OC.features;
  return (typeof D !== "undefined" && D && D.bgs && D.bgs.features) ? D.bgs.features : [];
}
const ready = () => typeof D !== "undefined" && D && D.catalog && feats().length > 0;
const countyLabel = () => { const el = $("#county-pick-label"); return el ? el.textContent.trim() : "this county"; };
const countyShort = () => countyLabel().replace(/,\s*[A-Z]{2}$/, "");
const catColor = c => css((CAT_COLOR[c] || "--ink-3"));
const ideaName = c => isCAActive() ? c.name : String(c.name).replace(" (SB 79 / TOC zoning)", " (transit-oriented zoning)");
// "How sure we are" comes from the 16 Nov 2026 verification audit (app/data/intervention_verification.json); the
// catalog's own A-D grade is only mentioned next to it.
const gradeOf = c => {
  const st = typeof ivStatus === "function" ? ivStatus(c.id) : "unverified";
  const gr = c.grade && c.grade !== "none" ? ` Catalog grade ${c.grade} (the build's own rating).` : "";
  if (st === "verified") return ["Sourced inputs", "The effect size and the cost were both found in their cited sources. The dollar return applies them to this place with a model that has not been checked against real outcomes." + gr, 4];
  if (st === "partially_verified") return ["Partly verified", ivLabel(c.id).replace(/^Partly verified: /, "Checked one side; ") + "." + gr, 2];
  return ["Effect not sourced yet", "Its effect size or cost could not be confirmed against a source, so no dollar figures are shown." + gr, 0];
};
const showIdea = c => c && (typeof ivStatus !== "function" || ivStatus(c.id) !== "unverified") && (c.grade === "none" || !c.grade || allowed(c.id));
const lc = t => /^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;   // keeps "EV", "ADU"
const rangeTxt = r => String(r.str).replace(/\s*\/\s*\$1.*$/, "").replace(/\s*\(model range\)/, "");
const plural = (n, one, many) => `${fmtN(n)} ${n === 1 ? one : (many || one + "s")}`;

// Same ranking as the map panel (select() in app.js): value ideas the evidence filter allows, best return per $1 first
function rankedRecs(id) {
  const d = (D.details && D.details[id]) || {}, m = d.m || {};
  const { recs, other } = gateRecs(recsOf(d), m);   // verification gate (app.js): unverified ideas carry no numbers
  const kind = r => (D.catalog[r.id] && D.catalog[r.id].kind) || "value";
  const eff = r => {
    if (typeof roiMode !== "undefined" && roiMode === "adj") { const cal = calibrateVpd(r.vpd, (D.catalog[r.id] || {}).grade, r.id, m); return cal.adj != null ? cal.adj : r.vpd; }
    return r.vpd;
  };
  const score = r => (r.id === "farmers_market" || r.id === "night_market") ? eff(r) * 0.4 : eff(r);
  const val = recs.filter(r => D.catalog[r.id] && (kind(r) === "value" || kind(r) === "regional") && allowed(r.id)).sort((a, b) => score(b) - score(a));
  const qol = recs.filter(r => D.catalog[r.id] && kind(r) === "qol").sort((a, b) => b.qol - a.qol || a.cost - b.cost);
  return { m, val, qol, other: [...new Set(other.map(r => r.id))] };
}

// Per-county summary, rebuilt when the county or the evidence filter changes
let _sumKey = null, _sum = null;
function summary() {
  const fs = feats(), key = (typeof activeFips === "function" ? activeFips() : "") + "|" + fs.length + "|" + ($("#evid") || {}).value + "|" + (typeof roiMode !== "undefined" ? roiMode : "") + "|" + (typeof IV_LA_SCANNED !== "undefined" && IV_LA_SCANNED ? 1 : 0) + (typeof INTERVENTION_VERIFICATION !== "undefined" && INTERVENTION_VERIFICATION ? 1 : 0);
  if (key === _sumKey && _sum) return _sum;
  const best = {}, groups = new Map(), cities = new Set();
  let pays = 0, homes = 0;
  for (const f of fs) {
    const p = f.properties || {}; if (!p.id) continue;
    if (p.c) cities.add(p.c);
    homes += +p.h || 0;
    if (p.t && p.v >= 1) { pays++; (best[p.t] = best[p.t] || []).push(p); }
    const gk = (p.n || "Unnamed area") + "|" + (p.c || "");
    let g = groups.get(gk);
    if (!g) groups.set(gk, g = { key: gk, n: p.n || "Unnamed area", c: p.c || "", areas: [], homes: 0, top: null });
    g.areas.push(p); g.homes += +p.h || 0;
    if (p.t && p.v >= 1 && (!g.top || p.v > g.top.v)) g.top = p;
  }
  for (const k in best) best[k].sort((a, b) => b.v - a.v);
  _sumKey = key;
  _sum = { n: fs.length, pays, homes, best, groups: [...groups.values()], cities: [...cities].sort() };
  return _sum;
}

// ---------------------------------------------------------------- view switching
function setView(v, opts) {
  opts = opts || {};
  ex.view = v === "explore" ? "explore" : "map";
  document.body.classList.toggle("explore-mode", ex.view === "explore");
  document.querySelectorAll("#view-switch [data-view]").forEach(b => {
    const on = b.dataset.view === ex.view;
    b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  try { localStorage.setItem("cp_view", ex.view); } catch (e) {}
  if (ex.view === "explore") {
    if (typeof hideWelcome === "function" && !opts.keepWelcome) { const w = $("#welcome"); if (w && !w.hidden) hideWelcome(); }
    render();
    if (!opts.keepScroll) window.scrollTo(0, 0);
  } else if (typeof map !== "undefined" && map && map.invalidateSize) {
    setTimeout(() => map.invalidateSize(), 0);
  }
}

function openOnMap(id) {
  setView("map");
  window.scrollTo(0, 0);
  setTimeout(() => { if (typeof select === "function" && byId.has(id)) select(id, true); }, 30);
}

// ---------------------------------------------------------------- rendering
function render() {
  const el = host(); if (!el || ex.view !== "explore") return;
  if (!ready()) {
    el.innerHTML = `<div class="ex-wrap"><p class="ex-loading"><span class="spin"></span> Loading ${esc(countyShort())}…</p></div>`;
    clearTimeout(render._t); render._t = setTimeout(render, 600);
    return;
  }
  const fips = typeof activeFips === "function" ? activeFips() : "";
  if (ex.fips !== fips) { ex.fips = fips; ex.idea = null; ex.hood = null; ex.area = null; ex.city = ""; ex.hq = ""; ex.shown = 24; }
  let body;
  if (ex.idea) body = ideaPage(ex.idea);
  else if (ex.hood) body = hoodPage(ex.hood, ex.area);
  else body = home();
  el.innerHTML = `<div class="ex-wrap">${body}</div>`;
  const q = el.querySelector("#ex-q"); if (q && render._focus === "q") { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  const hq = el.querySelector("#ex-hq"); if (hq && render._focus === "hq") { hq.focus(); hq.setSelectionRange(hq.value.length, hq.value.length); }
  render._focus = null;
}

function home() {
  const s = summary(), ideas = Object.values(D.catalog).filter(showIdea);
  const topIdea = Object.entries(s.best).sort((a, b) => b[1].length - a[1].length)[0];
  const tc = topIdea && D.catalog[topIdea[0]];
  const stats = [
    [fmtN(s.n), "areas studied", "Small pieces of the county, each a few hundred homes"],
    [fmtN(ideas.length), "ideas tested in each", "From street trees to bus lanes"],
    [fmtN(s.pays), "areas with a clear win", "At least one idea adds more home value than it costs"],
  ];
  const tabs = [["ideas", "Ideas"], ["places", "Neighborhoods"], ["how", "How it works"]];
  return `<section class="ex-hero">
      <div class="ex-eyebrow">Explore · ${esc(countyLabel())}</div>
      <h2 class="ex-title">What could make ${esc(countyShort())} better?</h2>
      <p class="ex-lede">City Pretty looked at every neighborhood here, checked what each one has and lacks, and tested dozens of public improvements in each. Browse the ideas, read a neighborhood's story, or let us pick one for you. No map reading needed.</p>
      <div class="ex-stats">${stats.map(([v, k, s2]) => `<div class="ex-stat"><div class="ex-stat-v">${v}</div><div class="ex-stat-k">${k}</div><div class="ex-stat-s">${s2}</div></div>`).join("")}</div>
      <div class="ex-hero-actions">
        <button type="button" class="tool-btn fun" data-ex="surprise"><svg class="ic" aria-hidden="true"><use href="#i-dice"/></svg><span>Surprise me with a neighborhood</span></button>
        ${tc ? `<button type="button" class="tool-btn" data-ex-idea="${esc(tc.id)}">The most common winner here: ${esc(lc(ideaName(tc)))}</button>` : ""}
      </div>
    </section>
    <div class="ex-tabs" role="tablist" aria-label="What to explore">${tabs.map(([k, l]) => `<button type="button" role="tab" id="ex-tab-${k}" aria-controls="ex-panel" aria-selected="${ex.tab === k}" class="ex-tab${ex.tab === k ? " active" : ""}" data-ex-tab="${k}">${l}</button>`).join("")}</div>
    <div id="ex-panel" role="tabpanel" aria-labelledby="ex-tab-${ex.tab}">${ex.tab === "places" ? placesTab(s) : ex.tab === "how" ? howTab(s, ideas.length) : ideasTab(s, ideas)}</div>`;
}

function ideasTab(s, ideas) {
  const cats = CATS.filter(c => ideas.some(i => i.category === c));
  const q = ex.q.trim().toLowerCase();
  const list = ideas.filter(c => (ex.cat === "All" || c.category === ex.cat)
      && (!q || (ideaName(c) + " " + c.category + " " + (PLAIN[c.id] || "")).toLowerCase().includes(q)))
    .sort((a, b) => ((s.best[b.id] || []).length - (s.best[a.id] || []).length) || (gradeOf(b)[2] - gradeOf(a)[2]) || ideaName(a).localeCompare(ideaName(b)));
  const hiddenU = Object.values(D.catalog).filter(c => !showIdea(c)).length;
  return `<div class="ex-toolbar">
      <div class="ex-chips" role="group" aria-label="Filter ideas by topic">
        <button type="button" class="ex-chip${ex.cat === "All" ? " active" : ""}" data-ex-cat="All" aria-pressed="${ex.cat === "All"}">All ideas <span>${ideas.length}</span></button>
        ${cats.map(c => `<button type="button" class="ex-chip${ex.cat === c ? " active" : ""}" data-ex-cat="${esc(c)}" aria-pressed="${ex.cat === c}"><i style="background:${catColor(c)}"></i>${esc(c)} <span>${ideas.filter(i => i.category === c).length}</span></button>`).join("")}
      </div>
      <label class="ex-search"><span class="sr-only">Search ideas</span><svg class="ic" aria-hidden="true"><use href="#i-search"/></svg><input id="ex-q" type="search" placeholder="Search ideas, like trees or bus" value="${esc(ex.q)}" autocomplete="off"></label>
    </div>
    ${ex.cat !== "All" ? `<p class="ex-cat-blurb">${esc(CAT_BLURB[ex.cat] || "")}</p>` : ""}
    <div class="ex-grid">${list.map(c => ideaCard(c, s)).join("") || `<p class="ex-empty">No idea matches “${esc(ex.q)}”.</p>`}</div>
    ${hiddenU ? `<p class="ex-foot">${plural(hiddenU, "idea")} whose effect or cost could not be confirmed against a source ${hiddenU === 1 ? "is" : "are"} not shown here. A neighborhood's page lists ${hiddenU === 1 ? "it" : "them"} by name, without numbers.</p>` : ""}`;
}

function ideaCard(c, s) {
  const wins = (s.best[c.id] || []).length, g = gradeOf(c);
  const tag = wins ? `<span class="ex-win">Best bet in ${plural(wins, "area")}</span>` : `<span class="ex-kind">${esc(KIND_TXT[c.kind] || "")}</span>`;
  return `<button type="button" class="ex-card" data-ex-idea="${esc(c.id)}" style="--cc:${catColor(c.category)}">
      <span class="ex-card-cat"><i></i>${esc(c.category)}</span>
      <span class="ex-card-name">${esc(ideaName(c))}</span>
      <span class="ex-card-plain">${esc(PLAIN[c.id] || c.economic_nuance || "")}</span>
      <span class="ex-card-foot">${tag}<span class="ex-grade" title="${esc(g[1])}">${dots(g[2])}${esc(g[0])}</span></span>
    </button>`;
}
const dots = n => `<span class="ex-dots" aria-hidden="true">${[1, 2, 3, 4].map(i => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;

function placesTab(s) {
  const q = ex.hq.trim().toLowerCase();
  let gs = s.groups.filter(g => (!ex.city || g.c === ex.city) && (!q || (g.n + " " + g.c).toLowerCase().includes(q)));
  if (ex.sort === "az") gs.sort((a, b) => a.n.localeCompare(b.n));
  else if (ex.sort === "homes") gs.sort((a, b) => b.homes - a.homes);
  else gs.sort((a, b) => ((b.top && b.top.v) || 0) - ((a.top && a.top.v) || 0) || a.n.localeCompare(b.n));
  const maxV = Math.max(1, ...s.groups.map(g => (g.top && g.top.v) || 0));
  const shown = gs.slice(0, ex.shown);
  return `<div class="ex-toolbar">
      <label class="ex-search"><span class="sr-only">Search neighborhoods</span><svg class="ic" aria-hidden="true"><use href="#i-search"/></svg><input id="ex-hq" type="search" placeholder="Search a neighborhood or city" value="${esc(ex.hq)}" autocomplete="off"></label>
      ${s.cities.length > 1 ? `<label class="ex-select"><span>City</span><select id="ex-city"><option value="">All ${fmtN(s.cities.length)} cities and areas</option>${s.cities.map(c => `<option${c === ex.city ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>` : ""}
      <label class="ex-select"><span>Sort</span><select id="ex-sort">
        <option value="pay"${ex.sort === "pay" ? " selected" : ""}>Biggest payoff first</option>
        <option value="homes"${ex.sort === "homes" ? " selected" : ""}>Most homes first</option>
        <option value="az"${ex.sort === "az" ? " selected" : ""}>A to Z</option></select></label>
    </div>
    <p class="ex-count">${plural(gs.length, "neighborhood")}${ex.city ? " in " + esc(ex.city) : ""}${q ? ` matching “${esc(ex.hq)}”` : ""}</p>
    <div class="ex-grid places">${shown.map(g => hoodCard(g, maxV)).join("") || `<p class="ex-empty">No neighborhood matches. Try a shorter name.</p>`}</div>
    ${gs.length > shown.length ? `<div class="ex-more"><button type="button" class="tool-btn" data-ex="more">Show more (${fmtN(gs.length - shown.length)} left)</button></div>` : ""}`;
}

function hoodCard(g, maxV) {
  const t = g.top, c = t && D.catalog[t.t];
  return `<button type="button" class="ex-card ex-hood" data-ex-hood="${esc(g.key)}" style="--cc:${c ? catColor(c.category) : "var(--ink-3)"}">
      <span class="ex-card-cat">${esc(g.c || countyShort())}</span>
      <span class="ex-card-name">${esc(g.n)}</span>
      <span class="ex-card-plain">${t && c ? `Best idea: <b>${esc(lc(ideaName(c)))}</b>` : "No idea here adds more home value than it costs."}</span>
      ${t ? `<span class="ex-bar" aria-hidden="true"><i style="width:${Math.max(4, Math.min(100, 100 * Math.log1p(t.v) / Math.log1p(maxV)))}%"></i></span>` : ""}
      <span class="ex-card-foot">${t ? `<span class="ex-win">Up to ${fvpd(t.v)} back per $1</span>` : ""}<span class="ex-kind">${g.homes ? "~" + plural(g.homes, "home") : ""}${g.areas.length > 1 ? ` · ${g.areas.length} areas` : ""}</span></span>
    </button>`;
}

function howTab(s, nIdeas) {
  const steps = [
    ["Cut the county into small pieces", `We split ${esc(countyShort())} into ${fmtN(s.n)} small areas (Census block groups), each usually a few hundred homes. Each gets its own neighborhood name.`],
    ["Look at what each place has", "For every area we gather public data: tree cover and summer heat, parks within a short walk, how often buses come, crashes, crime, home values, schools, shops and more."],
    ["Compare with similar places", "Each area is compared with the neighborhoods most like it. If it is hotter, has fewer parks or more crashes than its look-alikes, that gap points to what could help."],
    ["Price out each idea", `We test ${fmtN(nIdeas)} ideas in every area, from planting trees to adding bus lanes, using local construction and upkeep costs where we have them.`],
    ["Estimate the payoff", "Studies show how much nearby home prices rise after, say, a renovated park or a new grocery store. We apply those findings to the homes each idea would reach and divide by the cost: dollars of home value back for each $1 spent. We only show this where the study's effect size or the cost was checked against its source."],
  ];
  return `<ol class="ex-steps">${steps.map(([h, t], i) => `<li><span class="ex-step-n">${i + 1}</span><div><h3>${h}</h3><p>${t}</p></div></li>`).join("")}</ol>
    <div class="ex-how-grid">
      <div class="ex-note"><h3>How sure are we?</h3><p>Every idea carries a verification label from our 16 November 2026 data audit.</p>
        <ul class="ex-grades">${[[4, "Sourced inputs", "The effect size and the cost were both found in their cited sources; the dollar return is still a model estimate."], [2, "Partly verified", "One side was checked; the label names the side that was not."], [0, "Effect not sourced yet", "Listed by name only, with no dollar figures."]].map(([n, t, d]) => `<li>${dots(n)}<b>${t}</b><span>${d}</span></li>`).join("")}</ul></div>
      <div class="ex-note"><h3>What “$ back per $1” means</h3><p>If an idea shows <b>$3 back per $1</b>, our estimate is that each dollar spent adds about three dollars to the value of the homes it reaches. It is a range from a model, not a promise, and it does not count every benefit: cleaner air, safety and fun matter even when they do not show up in home prices.</p>
        <p>Rising home values are good news for owners but can push rents up. Each idea says how it tends to affect renters.</p></div>
    </div>
    <p class="ex-foot">Want the full detail? Open <button type="button" class="ex-link" data-ex="methods">Methods and data vintages</button> or <button type="button" class="ex-link" data-ex="accuracy">Accuracy and sources</button>.</p>`;
}

// ---------------------------------------------------------------- one idea, explained
function ideaPage(id) {
  const c = D.catalog[id]; if (!c) { ex.idea = null; return home(); }
  const s = summary(), wins = s.best[id] || [], g = gradeOf(c);
  const m0 = wins.length ? ((D.details[wins[0].id] || {}).m || {}) : {};
  const ag = t => esc(agencyFor(t, m0));
  const funds = (c.funding || []).filter(k => D.funding[k] && (isCAActive() || !(CA_ONLY_FUNDING.has(k) || LA_ONLY_FUNDING.has(k))) && !(activeCounty === "oc" && LA_ONLY_FUNDING.has(k)))
    .map(k => D.funding[k]);
  const rentTxt = c.renter_direct || c.displacement_risk === "protective" ? ["good", "Helps renters directly", "Renters get the benefit without much pressure on rents."]
    : c.displacement_risk === "high_risk" ? ["warn", "Can push rents up", "Big jumps in land value can raise rents. Best paired with tenant protections."]
    : ["", "Little effect on rents", "Not expected to change rents much either way."];
  const top = wins.slice(0, 8);
  return `${crumbs(ideaName(c))}
    <article class="ex-detail" style="--cc:${catColor(c.category)}">
      <div class="ex-detail-head">
        <span class="ex-card-cat"><i></i>${esc(c.category)}</span>
        <h2 class="ex-title">${esc(ideaName(c))}</h2>
        <p class="ex-lede">${esc(PLAIN[c.id] || "")}</p>
      </div>
      <div class="ex-facts">
        <div class="ex-fact"><div class="ex-fact-k">What kind of idea</div><div class="ex-fact-v">${esc(KIND_TXT[c.kind] || "")}</div></div>
        <div class="ex-fact"><div class="ex-fact-k">How sure we are</div><div class="ex-fact-v">${dots(g[2])}${esc(g[0])}</div><div class="ex-fact-s">${esc(g[1])}</div></div>
        <div class="ex-fact ${rentTxt[0]}"><div class="ex-fact-k">For renters</div><div class="ex-fact-v">${rentTxt[1]}</div><div class="ex-fact-s">${rentTxt[2]}</div></div>
        <div class="ex-fact"><div class="ex-fact-k">In ${esc(countyShort())}</div><div class="ex-fact-v">${wins.length ? `Best bet in ${plural(wins.length, "area")}` : "Not the top idea anywhere"}</div><div class="ex-fact-s">${wins.length ? `Up to ${fvpd(wins[0].v)} back per $1` : "It can still show up lower on a neighborhood's list."}</div></div>
      </div>
      ${c.economic_nuance ? `<section class="ex-sec"><h3>Why it can help</h3><p>${esc(c.economic_nuance)}</p></section>` : ""}
      ${c.lead_agency ? `<section class="ex-sec"><h3>Who makes it happen</h3><p><b>Who decides:</b> ${ag(c.lead_agency)}</p>${c.process ? `<p><b>First step:</b> ${ag(c.process)}</p>` : ""}${activeCounty === "oc" ? `<p class="ex-muted">Adapted from the Los Angeles County version; check with the city.</p>` : ""}</section>` : ""}
      ${funds.length ? `<section class="ex-sec"><h3>Who could pay for it</h3><ul class="ex-list">${funds.map(f => `<li>${f[2] ? `<a href="${esc(f[2])}" target="_blank" rel="noopener">${esc(f[0])}</a>` : `<b>${esc(f[0])}</b>`}<span>${esc(f[1])}</span></li>`).join("")}</ul></section>` : ""}
      ${top.length ? `<section class="ex-sec"><h3>Where it pays off most in ${esc(countyShort())}</h3>
        <ol class="ex-rank">${top.map((p, i) => `<li><span class="ex-rank-n">${i + 1}</span><span class="ex-rank-name"><b>${esc(p.n || "Unnamed area")}</b>${p.c ? `<span>${esc(p.c)}</span>` : ""}</span><span class="ex-rank-v">${fvpd(p.v)} per $1</span>
          <span class="ex-rank-act"><button type="button" class="ex-link" data-ex-area="${esc(p.id)}">Read its story</button><button type="button" class="ex-link" data-ex-map="${esc(p.id)}">On the map</button></span></li>`).join("")}</ol></section>` : ""}
      ${(c.sources || []).length ? `<details class="ex-sources"><summary>Where these numbers come from</summary><ul>${c.sources.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
        <button type="button" class="ex-link" data-ex-research="${esc(c.category)}">Open the research library for ${esc(c.category.toLowerCase())}</button></details>` : ""}
    </article>`;
}

// ---------------------------------------------------------------- one neighborhood, as a story
function hoodPage(key, areaId) {
  const s = summary(), g = s.groups.find(x => x.key === key);
  if (!g) { ex.hood = null; return home(); }
  const areas = g.areas.slice().sort((a, b) => (b.v || 0) - (a.v || 0));
  const p = areas.find(a => a.id === areaId) || areas[0];
  const { m, val, qol, other } = rankedRecs(p.id);
  const top = val[0], tc = top && D.catalog[top.id];
  const rng = top && tc ? formatVpdRange(top.vpd, tc.grade, top.id, m) : null;
  const gaps = ((m.gp || {}).g || []).filter(x => x && x[5]).slice(0, 4);
  const strengths = ((m.gp || {}).s || []).filter(x => x && x[0]);
  const homes = m.homes || p.h, hv = m.hv || p.hv;
  const story = top && tc && top.vpd >= 1
    ? `The idea that gives the most back here: <b>${esc(ideaName(tc))}</b>. Our estimate is that every $1 spent adds about <b>${esc(rangeTxt(rng))}</b> in value to nearby homes.`
    : top && tc ? `No idea here is expected to add more home value than it costs. The closest: <b>${esc(ideaName(tc))}</b>. Ideas below can still make daily life better.`
    : "No sourced estimate is available here yet: none of the ideas whose effect and cost could be checked applies to this area.";
  return `${crumbs(g.n)}
    <article class="ex-detail ex-story" style="--cc:${tc ? catColor(tc.category) : "var(--accent)"}">
      <div class="ex-detail-head">
        <span class="ex-card-cat">${esc(g.c || countyShort())}</span>
        <h2 class="ex-title">${esc(g.n)}</h2>
        <p class="ex-sub">${homes ? `About ${plural(homes, "home")}` : ""}${hv ? ` · typical home value ${fmt$(hv)}${m.hvs ? ` <span class="ex-muted">(${esc(m.hvs)})</span>` : ""}` : ""}${m.pop ? ` · ${fmtN(m.pop)} residents` : ""}</p>
        ${areas.length > 1 ? `<div class="ex-areas"><span>${esc(g.n)} is ${areas.length} small areas. Showing:</span>${areas.slice(0, 12).map((a, i) => `<button type="button" class="ex-chip${a.id === p.id ? " active" : ""}" data-ex-area="${esc(a.id)}" aria-pressed="${a.id === p.id}">Area ${i + 1}${a.v >= 1 ? ` · ${fvpd(a.v)}` : ""}</button>`).join("")}${areas.length > 12 ? `<span class="ex-muted">+${areas.length - 12} more on the map</span>` : ""}</div>` : ""}
      </div>
      <section class="ex-sec ex-short"><h3>The short version</h3><p>${story}</p>
        <div class="ex-hero-actions"><button type="button" class="tool-btn primary" data-ex-map="${esc(p.id)}"><svg class="ic" aria-hidden="true"><use href="#i-pin"/></svg><span>See it on the map</span></button><button type="button" class="tool-btn fun" data-ex="surprise"><svg class="ic" aria-hidden="true"><use href="#i-dice"/></svg><span>Another neighborhood</span></button></div></section>
      ${gaps.length ? `<section class="ex-sec"><h3>What stands out compared with similar neighborhoods</h3><ul class="ex-gaps">${gaps.map(x => `<li><span class="ex-gap-v">${esc(x[1])}</span><span>${esc(x[5])}${x[4] && D.catalog[x[4]] ? ` <button type="button" class="ex-link" data-ex-idea="${esc(x[4])}">What could help: ${esc(lc(ideaName(D.catalog[x[4]])))}</button>` : ""}</span></li>`).join("")}</ul>
        ${strengths.length ? `<p class="ex-muted">Already doing well: ${strengths.map(x => `${esc((D.gap_labels && D.gap_labels[x[0]]) || x[0])} (${esc(x[1])}; similar places ${esc(x[2])})`).join(", ")}.</p>` : ""}</section>` : ""}
      ${val.length ? `<section class="ex-sec"><h3>Top ideas for this area</h3><div class="ex-ideas">${val.slice(0, 5).map((r, i) => storyIdea(r, i, m)).join("")}</div></section>` : ""}
      ${qol.length ? `<section class="ex-sec"><h3>Also worth doing for daily life</h3><p class="ex-muted">These are not priced in home value, but this area is short on them.</p><div class="ex-pills">${qol.slice(0, 6).map(r => `<button type="button" class="ex-chip" data-ex-idea="${esc(r.id)}">${esc(ideaName(D.catalog[r.id]))}</button>`).join("")}</div></section>` : ""}
      ${other.length ? `<section class="ex-sec" data-other-ideas><h3>Other ideas (effect not sourced yet)</h3><p class="ex-muted">Suggested by the model, but their effect or cost could not be confirmed against a source, so no numbers are shown.</p><div class="ex-pills">${other.filter(id => D.catalog[id]).map(id => `<span class="ex-chip">${esc(ideaName(D.catalog[id]))}</span>`).join("")}</div></section>` : ""}
      <p class="ex-foot">Estimates come from public data and published studies; they are a starting point for a conversation with the city, not a promise. The map view has the full numbers, sources and costs.</p>
    </article>`;
}

function storyIdea(r, i, m) {
  const c = D.catalog[r.id], g = gradeOf(c), rng = formatVpdRange(r.vpd, c.grade, r.id, m);
  return `<div class="ex-idea" style="--cc:${catColor(c.category)}">
      <div class="ex-idea-head"><span class="ex-idea-n">${i + 1}</span><div><div class="ex-idea-name">${esc(ideaName(c))}</div><div class="ex-idea-what">${esc(r.project || "")}</div></div>
        <div class="ex-idea-v"><b>${esc(rangeTxt(rng))}</b><span>back per $1</span></div></div>
      <p>${esc(PLAIN[c.id] || "")}</p>
      <p class="ex-idea-meta">Costs about <b>${fmt$(r.cost)}</b>${r.value > 0 ? ` · adds about <b>${fmt$(r.value)}</b> across ~${plural(r.homes, "home")}` : ""} · ${dots(g[2])}${esc(g[0])}</p>
      ${r.why ? `<p class="ex-why"><b>Why here:</b> ${esc(whyFix(r.why))}</p>` : ""}
      <button type="button" class="ex-link" data-ex-idea="${esc(c.id)}">Learn about this idea</button>
    </div>`;
}

function crumbs(here) {
  const tabName = { ideas: "Ideas", places: "Neighborhoods", how: "How it works" }[ex.tab];
  return `<nav class="ex-crumbs" aria-label="Breadcrumb"><button type="button" class="ex-back" data-ex="back"><svg class="ic" aria-hidden="true"><use href="#i-chevron"/></svg>Back</button>
    <button type="button" class="ex-link" data-ex="home">Explore</button><span aria-hidden="true">/</span><button type="button" class="ex-link" data-ex="home">${tabName}</button><span aria-hidden="true">/</span><span aria-current="page">${esc(here)}</span></nav>`;
}

// ---------------------------------------------------------------- actions
const trail = [];
function go(state) {
  trail.push({ idea: ex.idea, hood: ex.hood, area: ex.area, tab: ex.tab, y: window.scrollY });
  Object.assign(ex, { idea: null, hood: null, area: null }, state);
  render(); window.scrollTo(0, 0);
}
function back() {
  const h = trail.pop();
  if (!h) { Object.assign(ex, { idea: null, hood: null, area: null }); render(); return; }
  Object.assign(ex, h); render(); window.scrollTo(0, h.y || 0);
}
function groupKeyOf(id) { const f = byId.get(id), p = f && f.properties; return p ? (p.n || "Unnamed area") + "|" + (p.c || "") : null; }
function surprise() {
  const good = feats().map(f => f.properties).filter(p => p && p.v >= 1).sort((a, b) => b.v - a.v);
  const pool = good.slice(0, Math.max(12, Math.ceil(good.length / 4)));
  if (!pool.length) { if (typeof showToast === "function") showToast("No neighborhood here returns $1 or more per $1 yet. Try another county."); return; }
  let p = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1 && ex.area === p.id) p = pool[(pool.indexOf(p) + 1) % pool.length];
  go({ hood: groupKeyOf(p.id), area: p.id });
}

function onClick(e) {
  const t = e.target.closest("[data-ex],[data-ex-tab],[data-ex-cat],[data-ex-idea],[data-ex-hood],[data-ex-area],[data-ex-map],[data-ex-research],[data-view]");
  if (!t) return;
  const d = t.dataset;
  if (d.view) { setView(d.view); return; }
  if (!host().contains(t)) return;
  if (d.exTab) { ex.tab = d.exTab; ex.shown = 24; render(); }
  else if (d.exCat) { ex.cat = d.exCat; render(); }
  else if (d.exIdea) go({ idea: d.exIdea });
  else if (d.exHood) go({ hood: d.exHood });
  else if (d.exArea) { const k = groupKeyOf(d.exArea); if (ex.hood && ex.hood === k) { ex.area = d.exArea; render(); } else go({ hood: k, area: d.exArea }); }
  else if (d.exMap) openOnMap(d.exMap);
  else if (d.exResearch) { if (typeof openResearchModal === "function") openResearchModal(d.exResearch); }
  else if (d.ex === "surprise") surprise();
  else if (d.ex === "more") { ex.shown += 48; render(); }
  else if (d.ex === "back") back();
  else if (d.ex === "home") { trail.length = 0; Object.assign(ex, { idea: null, hood: null, area: null }); render(); window.scrollTo(0, 0); }
  else if (d.ex === "methods") { const b = $("#btn-methods-header"); if (b) b.click(); }
  else if (d.ex === "accuracy") { if (typeof openAccuracyModal === "function") openAccuracyModal(); }
}
function onInput(e) {
  const t = e.target;
  if (t.id === "ex-q") { ex.q = t.value; render._focus = "q"; render(); }
  else if (t.id === "ex-hq") { ex.hq = t.value; ex.shown = 24; render._focus = "hq"; render(); }
}
function onChange(e) {
  const t = e.target;
  if (t.id === "ex-city") { ex.city = t.value; ex.shown = 24; render(); }
  else if (t.id === "ex-sort") { ex.sort = t.value; render(); }
}

function init() {
  const el = host(); if (!el) return;
  document.addEventListener("click", onClick);
  el.addEventListener("input", onInput);
  el.addEventListener("change", onChange);
  // Re-render when the county changes (its label in the header updates) or the evidence filter changes
  const lbl = $("#county-pick-label");
  if (lbl && window.MutationObserver) new MutationObserver(() => { _sumKey = null; if (ex.view === "explore") { trail.length = 0; render(); } }).observe(lbl, { childList: true, characterData: true, subtree: true });
  const ev = $("#evid"); if (ev) ev.addEventListener("change", () => { _sumKey = null; if (ex.view === "explore") render(); });
  // A search from the header while exploring jumps to the map, where the result is shown
  const q = $("#q"); if (q) q.addEventListener("keydown", e => { if (e.key === "Enter" && ex.view === "explore") setView("map"); });
  let want = null;
  try { want = new URLSearchParams(location.hash.replace(/^#/, "")).get("view") || localStorage.getItem("cp_view"); } catch (e) {}
  if (want === "explore") setView("explore", { keepWelcome: false });
}

window.cpExplore = { setView, render, openOnMap, get state() { return ex; } };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
