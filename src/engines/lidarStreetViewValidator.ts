export interface ImageryVintageCheck {
  parcelId: string;
  lidarAcquisitionYear: number;
  streetViewCaptureDate: string | null; // ISO "YYYY-MM"
  latestPostConstructionPermitDate: string | null;
  permitScopeDescription: string | null;
  isLidarStale: boolean;
  isStreetViewStale: boolean;
  confidenceBadge: "verified_current" | "stale_imagery_permit_override" | "no_street_view";
  warningMessage: string | null;
}

export function validateParcelImageryVintage(input: {
  parcelId: string;
  lidarAcquisitionYear: number;
  streetViewCaptureDate: string | null;
  latestPostConstructionPermitDate: string | null;
  permitScopeDescription: string | null;
  referenceYear?: number;
}): ImageryVintageCheck {
  const currentYear = input.referenceYear ?? 2026;
  const permitYear = input.latestPostConstructionPermitDate
    ? Number(input.latestPostConstructionPermitDate.slice(0, 4))
    : null;

  const isLidarStale =
    permitYear !== null && permitYear >= input.lidarAcquisitionYear;

  let isStreetViewStale = false;
  if (input.streetViewCaptureDate) {
    const svYear = Number(input.streetViewCaptureDate.slice(0, 4));
    const ageYears = currentYear - svYear;
    isStreetViewStale =
      ageYears > 3 || (permitYear !== null && permitYear >= svYear);
  }

  if (!input.streetViewCaptureDate) {
    return {
      ...input,
      isLidarStale,
      isStreetViewStale: true,
      confidenceBadge: "no_street_view",
      warningMessage:
        "No Google Street View coverage at parcel frontage; story count relies solely on USGS LiDAR/OSM footprints.",
    };
  }

  if (isLidarStale || isStreetViewStale) {
    return {
      ...input,
      isLidarStale,
      isStreetViewStale,
      confidenceBadge: "stale_imagery_permit_override",
      warningMessage: `Building permit (${input.latestPostConstructionPermitDate}: ${
        input.permitScopeDescription ?? "structural alteration"
      }) post-dates LiDAR (${input.lidarAcquisitionYear}) or Street View (${
        input.streetViewCaptureDate
      }). Verify current structure before modeling ADU/SB 9 capacity.`,
    };
  }

  return {
    ...input,
    isLidarStale: false,
    isStreetViewStale: false,
    confidenceBadge: "verified_current",
    warningMessage: null,
  };
}
