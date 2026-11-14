export interface GtfsStopMetric {
  stopId: string;
  agencyId: string;
  routeType: number; // GTFS: 0=Tram/LRT, 1=Subway/Heavy Rail, 2=Commuter Rail, 3=Bus, 4=Ferry
  lat: number;
  lng: number;
  weekdayPeakTripsPerHour: number;   // 07:00-09:00 and 16:00-18:00 average
  weekdayAllDayTripsPerHour: number; // 06:00-22:00 average (CA AB 2097 / SB 79 benchmark)
  hasFrequentService15Min: boolean;  // >= 4 trips/hr in both directions
}

export interface WalkshedSummary {
  blockGroupGeoid: string;
  busiestStopTripsPerHour: number;
  busiestStopAgency: string;
  withinQuarterMileHeavyRail: boolean;
  withinHalfMileHeavyRail: boolean;
  withinHalfMileFrequentTransit: boolean; // Triggers CA AB 2097 zero-parking & WA HB 1110 tiers
  qualifyingAgencies: string[];
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.7613;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function evaluateBlockGroupTransit(
  blockGroupGeoid: string,
  centroidLat: number,
  centroidLng: number,
  stops: GtfsStopMetric[]
): WalkshedSummary {
  const CIRCUITY_FACTOR = 1.25;

  let busiestStopTripsPerHour = 0;
  let busiestStopAgency = "None";
  let withinQuarterMileHeavyRail = false;
  let withinHalfMileHeavyRail = false;
  let withinHalfMileFrequentTransit = false;
  const agencies = new Set<string>();

  for (const stop of stops) {
    const walkMiles = haversineMiles(centroidLat, centroidLng, stop.lat, stop.lng) * CIRCUITY_FACTOR;
    if (walkMiles > 0.75) continue;

    agencies.add(stop.agencyId);

    if (walkMiles <= 0.5 && stop.weekdayAllDayTripsPerHour > busiestStopTripsPerHour) {
      busiestStopTripsPerHour = Number(stop.weekdayAllDayTripsPerHour.toFixed(1));
      busiestStopAgency = stop.agencyId;
    }

    const isHeavyOrCommuterRail = stop.routeType === 1 || stop.routeType === 2;
    if (isHeavyOrCommuterRail && walkMiles <= 0.25) {
      withinQuarterMileHeavyRail = true;
    }
    if (isHeavyOrCommuterRail && walkMiles <= 0.5) {
      withinHalfMileHeavyRail = true;
    }
    if (walkMiles <= 0.5 && (stop.hasFrequentService15Min || isHeavyOrCommuterRail)) {
      withinHalfMileFrequentTransit = true;
    }
  }

  return {
    blockGroupGeoid,
    busiestStopTripsPerHour,
    busiestStopAgency,
    withinQuarterMileHeavyRail,
    withinHalfMileHeavyRail,
    withinHalfMileFrequentTransit,
    qualifyingAgencies: Array.from(agencies).sort(),
  };
}
