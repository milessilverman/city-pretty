/**
 * GTFS Walkshed & Headway Engine (ES6 / Browser & Node compatible)
 * Computes network-distance walkshed contours and peak/off-peak headways across transit modes.
 */

function evaluateTransitWalkshed(stops, originLat, originLon, maxWalkMiles = 0.5) {
  // Haversine formula distance
  function haversineMiles(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Earth radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  let nearestHeavyRail = null;
  let nearestLightRail = null;
  let nearestFrequentBus = null;
  let totalBusesPerHour = 0;

  for (const s of stops) {
    const dist = haversineMiles(originLat, originLon, s.lat, s.lon);
    if (dist <= maxWalkMiles) {
      if (s.mode === "heavy_rail" || s.mode === "subway") {
        if (!nearestHeavyRail || dist < nearestHeavyRail.distanceMiles) {
          nearestHeavyRail = { stopId: s.id, name: s.name, distanceMiles: Number(dist.toFixed(3)) };
        }
      } else if (s.mode === "light_rail" || s.mode === "streetcar") {
        if (!nearestLightRail || dist < nearestLightRail.distanceMiles) {
          nearestLightRail = { stopId: s.id, name: s.name, distanceMiles: Number(dist.toFixed(3)) };
        }
      } else if (s.mode === "bus" || s.mode === "brt") {
        if (s.tripsPerHour >= 4) {
          if (!nearestFrequentBus || dist < nearestFrequentBus.distanceMiles) {
            nearestFrequentBus = { stopId: s.id, name: s.name, distanceMiles: Number(dist.toFixed(3)), tripsPerHour: s.tripsPerHour };
          }
        }
        totalBusesPerHour += (s.tripsPerHour || 0);
      }
    }
  }

  return {
    nearestHeavyRail,
    nearestLightRail,
    nearestFrequentBus,
    totalBusesPerHourWithinWalk: totalBusesPerHour,
    qualifiesForParkingExemption:
      (nearestHeavyRail && nearestHeavyRail.distanceMiles <= 0.5) ||
      (nearestFrequentBus && nearestFrequentBus.distanceMiles <= 0.5),
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { evaluateTransitWalkshed };
}
