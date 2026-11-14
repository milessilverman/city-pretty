/**
 * ArcGIS Multi-State Field Alias Normalizer (ES6 / Browser & Node compatible)
 * Resolves county parcel attributes across 637+ US local jurisdictions.
 */

const FIELD_ALIASES = {
  parcel_id: ["APN", "PARCEL_ID", "PARCELID", "PIN", "FOLIO", "TAX_ID", "PROP_ID", "SBL", "MAPBLOLOT", "GEO_ID", "AIN"],
  situs_address: ["SITUS_ADDR", "SITE_ADDR", "PROP_ADDR", "ADDRESS", "FULL_ADDR", "PHY_ADDR", "LOC_ADDR"],
  zoning_code: ["ZONING", "ZONE_CODE", "ZONING_CD", "ZONE_DIST", "BASE_ZONE", "MUN_ZONE", "LAND_USE_Z"],
  land_use_code: ["USE_CODE", "LAND_USE", "LU_CODE", "PROP_CLASS", "CLASS_CD", "DOR_UC", "STATE_USE"],
  assessed_total: ["ASSESSED_VAL", "TOT_ASSESS", "ASSD_VAL", "TAXABLE_VAL", "AV_TOTAL", "NET_VALUE", "SEV"],
  market_total: ["MARKET_VAL", "FULL_MKT_VAL", "JUST_VAL", "APPRAISED_VAL", "FCV", "TOTAL_VALUE"],
  owner_exempt_flag: ["EXEMPT_CD", "TAX_EXEMPT", "OWNER_TYPE", "GOV_OWNED", "PUBLIC_LAND", "EXEMPTION"],
  lot_sqft: ["LOT_SQFT", "GIS_SQFT", "AREA_SQFT", "LAND_SQFT", "SHAPE_Area"],
};

function normalizeArcGisFeature(attributes) {
  if (!attributes) attributes = {};
  const resolve = (keys) => {
    for (const k of keys) {
      const match = Object.keys(attributes).find((attr) => attr.toUpperCase() === k);
      if (match && attributes[match] !== null && attributes[match] !== "") {
        return attributes[match];
      }
    }
    return null;
  };

  return {
    parcel_id: String(resolve(FIELD_ALIASES.parcel_id) || "UNKNOWN"),
    situs_address: String(resolve(FIELD_ALIASES.situs_address) || ""),
    zoning_code: String(resolve(FIELD_ALIASES.zoning_code) || "UNZONED"),
    land_use_code: String(resolve(FIELD_ALIASES.land_use_code) || ""),
    assessed_total: Number(resolve(FIELD_ALIASES.assessed_total) || 0),
    market_total: Number(resolve(FIELD_ALIASES.market_total) || 0),
    owner_exempt_flag: Boolean(resolve(FIELD_ALIASES.owner_exempt_flag)),
    lot_sqft: Number(resolve(FIELD_ALIASES.lot_sqft) || 0),
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { normalizeArcGisFeature, FIELD_ALIASES };
}
