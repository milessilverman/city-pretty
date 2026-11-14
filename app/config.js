// Site settings, read by app/app.js. Edit here; no build step.
window.CITY_PRETTY_CONFIG = {
  // Base URL of the Cloudflare Worker in workers/api-proxy.ts once it is deployed, with no trailing slash, e.g.
  // "https://city-pretty-api-proxy.<your-subdomain>.workers.dev". The page then uses <workerUrl>/api/ai (AI advisor),
  // /api/streetview (Street View photos) and /api/health. While this is empty the AI advisor shows "Not connected"
  // and sends nothing, and Street View opens on Google Maps instead of showing a photo in the page.
  // (A browser can point the advisor at a test Worker from the advisor's settings drawer.)
  workerUrl: "",
};
