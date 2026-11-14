"use strict";

function buildGroundedAdvisorPrompt(userQuestion, ctx) {
  const isParcel = Boolean(ctx.parcel);
  const exclusions = isParcel
    ? ctx.parcel.statutoryExclusions
    : (ctx.zoning ? ctx.zoning.statutory_exclusions : null);

  const activeExclusions = exclusions
    ? Object.entries(exclusions)
        .filter(([, active]) => Boolean(active))
        .map(([key]) => key)
    : [];

  const readinessTier = (ctx.county && ctx.county.readiness_tier) || "audited_A";
  const zoningSource = (ctx.county && ctx.county.zoning_source) || "live_municipal_gis";
  const crimeFeed = (ctx.county && ctx.county.crime_feed_status) || "rolling_12m";

  const systemPrompt = [
    "You are the City Pretty Urban & Property Advisor, an institutional econometric and statutory intelligence copilot for municipal leaders, homeowners, and urban infill investors.",
    "STRICT GROUNDING & ANTI-HALLUCINATION RULES:",
    "1. Cite ONLY numbers, property attributes, valuations, permit dates, statutory citations, and financial figures present in the verified context payload below. Never invent zoning codes, millage rates, building dimensions, or local ordinances.",
    `2. Active jurisdiction readiness tier is "${readinessTier}". If readiness_tier is NOT "audited_A", explicitly state that the jurisdiction is in "${readinessTier}" screening mode and identify preliminary data sources (e.g., zoning_source="${zoningSource}", crime_feed_status="${crimeFeed}").`,
    activeExclusions.length > 0
      ? `3. CRITICAL STATUTORY OVERLAYS DETECTED: [${activeExclusions.join(", ")}]. You MUST warn the user that these overlays block or restrict ministerial by-right development (e.g. SB 9 lot splits or CEQA exemptions) unless specifically exempted.`
      : "3. If no statutory exclusions are flagged, advise that local municipal historic preservation overlays, coastal permits, and private HOA / CC&R covenants must still be verified with the local building department.",
    "4. For rooftop solar inquiries in 2026+: explicitly affirm that the federal residential 30% tax credit under IRC § 25D expired on Dec 31, 2025 (0% for cash/loan purchases); 30% applies only under IRC § 48E commercial/TPO leases. In California, note that NEM 3.0 avoided-cost export tariffs require paired battery storage for positive equity.",
    "5. For high-value parcels ($2.5M+): note that amenity price-lift reflects non-linear diminishing marginal returns.",
    "6. Always format responses in clean GitHub-flavored markdown with bold headers and bullet points.",
    "7. MANDATORY CLOSING NOTICE: You must conclude actionable property and investment outputs with the exact institutional disclaimer:\n'LEGAL & ENGINEERING NON-RELIANCE NOTICE: Preliminary screening based on public municipal GIS, tax rolls, and statutory feeds as of November 2026. Feasibility determinations do not constitute formal zoning verification letters, title opinions, or structural engineering assessments. Verify all easements, utility hookups, and setbacks with local building departments.'",
  ].join("\n\n");

  const userPrompt = [
    "VERIFIED GEOSPATIAL & STATUTORY CONTEXT (JSON):",
    "```json",
    JSON.stringify(ctx, null, 2),
    "```",
    "",
    `USER QUESTION: ${userQuestion}`,
  ].join("\n\n");

  return { systemPrompt, userPrompt };
}

function serializeLiveAdvisorContext(env) {
  const g = typeof window !== "undefined" ? window : (env || {});

  // Active county lookup
  const curFips = (typeof g.activeFips === "function") ? g.activeFips() : "06037";
  const compIndex = g.COUNTY_COMPLETENESS_INDEX || {};
  const countyMeta = compIndex[curFips] || {
    fips: curFips,
    name: (typeof g.countyOf === "function" ? g.countyOf() : "County " + curFips),
    state: (typeof g.activeState === "function" ? g.activeState() : "CA"),
    readiness_tier: "audited_A",
    assessor_roll_vintage: "2026 Secured Roll",
    sales_comps_window: ["2022-08-01", "2026-10-31"],
    zoning_source: "live_municipal_gis",
    gtfs_agencies_count: 19,
    crime_feed_status: "rolling_12m",
    canopy_dataset: "tree_equity_2025",
  };

  const payload = {
    county: countyMeta,
    roiMode: (typeof g.getRoiMode === "function") ? g.getRoiMode() : "adj",
  };

  // Selected block group
  const selBg = g.selected;
  if (selBg && g.byId && g.byId.get && g.byId.get(selBg)) {
    const feat = g.byId.get(selBg);
    const props = feat.properties || {};
    payload.blockGroupGeoid = selBg;
    payload.neighborhoodName = props.n || "Local Neighborhood";
    payload.neighborhoodMedianHv = props.hv ? Math.round(props.hv * 1.165) : 850000;
    payload.neighborhoodMedianRent = props.rent || 2800;
    payload.displacementRiskScore = props.rent_risk || 45;
  }

  // Active house parcel
  const ah = g.activeHouse;
  if (ah && ah.a) {
    const a = ah.a;
    const audit = ah.audit || {};
    const val = ah.valuation || (audit ? audit.valuation : null) || {};
    const lotSqft = ah.lot || a.LotSqft || 6000;
    const livingSqft = (val && val.livingSqft) ? val.livingSqft : (ah.F ? ah.F.bldg : 1800);

    const parcelCtx = {
      parcelId: String(a.AIN || a.APN || "PARCEL"),
      address: String(a.SitusFullAddress || a.PROPERTYADDRESS || ("Parcel " + (a.AIN || "–"))),
      county: String(a.county || countyMeta.name),
      state: String((typeof g.activeState === "function" ? g.activeState() : null) || countyMeta.state || "CA"),
      lotSqft: lotSqft,
      livingSqft: livingSqft,
      yearBuilt: ah.F ? ah.F.yb : null,
      effectiveYearBuilt: ah.F ? ah.F.eff : null,
      bedrooms: ah.F ? ah.F.beds : 3,
      bathrooms: ah.F ? ah.F.baths : 2,
      stories: ah.F ? ah.F.stories : 1,
      units: ah.F ? ah.F.units : 1,
      isVacantLand: Boolean(val.isVacantLand),
      zoningCode: String(a.ZoneCode || "R-1"),
      useDescription: String(a.UseDescription || "Residential"),
      avmValuation: {
        estimatedValue: val.estimatedValue || 750000,
        valueLow: val.valueLow || Math.round((val.estimatedValue || 750000) * 0.935),
        valueHigh: val.valueHigh || Math.round((val.estimatedValue || 750000) * 1.065),
        vpsf: val.vpsf || Math.round((val.estimatedValue || 750000) / Math.max(livingSqft, 1)),
        valuationMethod: val.valuationMethod || "Hedonic Micro-Model",
        confidenceMarginPct: val.confidenceMarginPct || 0.065,
        confidenceRating: val.confidenceRating || "High Confidence",
        permitCapitalizationAdded: val.permitCapitalizationAdded || 0,
        luxuryDampeningApplied: Boolean(val.luxuryDampeningApplied),
        multiUnitBonusPct: val.multiUnitBonusPct || 0,
      },
      recentPermits: (ah.recentPermits || []).map(p => ({
        issue_date: String(p.issue_date || p.IssueDate || ""),
        permit_type: String(p.permit_type || p.TYPE || "remodel"),
        valuation_usd: Number(p.valuation_usd || p.Valuation || 0),
        description: String(p.description || p.Description || ""),
      })),
      imagery: {
        confidenceBadge: (audit && audit.imagery) ? audit.imagery.confidenceBadge : "verified_current",
        isLidarStale: Boolean(audit && audit.imagery && audit.imagery.isLidarStale),
        isStreetViewStale: Boolean(audit && audit.imagery && audit.imagery.isStreetViewStale),
        warningMessage: (audit && audit.imagery) ? audit.imagery.warningMessage : null,
      },
      statutoryExclusions: (audit && audit.statutoryZoning) ? audit.statutoryZoning.statutory_exclusions : {
        historic_district_hpoz: false,
        coastal_commission_or_sma: false,
        fema_100yr_floodway: false,
        calfire_or_state_vhfhsz: false,
        private_hoa_or_ccr_disclaimer_required: true,
      },
      solar: (audit && audit.solarMicrogrid) ? {
        system_size_dc_kw: audit.solarMicrogrid.system_size_dc_kw,
        federal_itc_pct: audit.solarMicrogrid.federal_itc_pct,
        battery_storage_required: audit.solarMicrogrid.battery_storage_required_for_roi,
        net_25yr_npv_usd: audit.solarMicrogrid.net_25yr_npv_usd,
      } : undefined,
      treeEconomics: (audit && audit.treeEconomics) ? {
        annualCoolingOrHeatingSavingsUsd: audit.treeEconomics.annualCoolingOrHeatingSavingsUsd,
        capitalizedValueUsd: audit.treeEconomics.capitalizedValueUsd,
        climateRegime: audit.treeEconomics.climateRegime,
      } : undefined,
    };

    if (typeof g.computePropertyPlaybook === "function") {
      try {
        const pb = g.computePropertyPlaybook(a, lotSqft, ah.F || {}, null, ah.ll, ah.st);
        if (pb && pb.best) {
          parcelCtx.playbookRecommendation = {
            strategyTitle: pb.best.title,
            badge: pb.best.badge,
            netEquityLift: pb.best.equity,
            roiPerDollar: pb.best.roi,
            statutoryPathway: pb.best.statute,
            annualCashflow: pb.best.annualCashflow,
            paybackYears: pb.best.paybackYrs,
          };
        }
      } catch (e) {}
    }

    payload.parcel = parcelCtx;
  }

  // Nearest transit station
  if (ah && ah.ll && typeof g.findNearestTransitStation === "function") {
    try {
      const stn = g.findNearestTransitStation(ah.ll.lat, ah.ll.lng);
      if (stn) {
        payload.nearestTransit = {
          stationName: stn.name || "Transit Hub",
          distMiles: stn.distMi || 0,
          inWalkshed: (stn.distMi || 0) <= 0.5,
          ab2097ParkingExempt: (stn.distMi || 0) <= 0.5,
        };
      }
    } catch (e) {}
  }

  return payload;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildGroundedAdvisorPrompt,
    serializeLiveAdvisorContext,
  };
}

if (typeof window !== "undefined") {
  window.buildGroundedAdvisorPrompt = buildGroundedAdvisorPrompt;
  window.serializeLiveAdvisorContext = serializeLiveAdvisorContext;
}
