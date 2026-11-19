// City Pretty's site Worker: serves the static files in dist-site/ (built by scripts/build_site_dist.mjs).
// Files are served straight from Workers static assets. The only code here keeps the old GitHub Pages address
// shape working: requests under /city-pretty/ are answered with the same files as the root, so the page works at
// both https://<site>/ and https://<site>/city-pretty/ without a second copy of anything.
// wrangler.site.toml sends only /city-pretty and /city-pretty/* to this code; everything else is a plain asset request.

interface AssetsFetcher { fetch(request: Request): Promise<Response>; }
export interface SiteEnv { ASSETS: AssetsFetcher; }

const PREFIX = "/city-pretty";

// The path to look up among the assets, or null when the request should be redirected to "/city-pretty/".
export function stripPrefix(pathname: string): string | null {
  if (pathname === PREFIX) return null;
  if (!pathname.startsWith(PREFIX + "/")) return pathname;
  return pathname.slice(PREFIX.length) || "/";
}

export default {
  async fetch(request: Request, env: SiteEnv): Promise<Response> {
    const url = new URL(request.url);
    const inner = stripPrefix(url.pathname);
    if (inner === null) return Response.redirect(url.origin + PREFIX + "/" + url.search, 301);
    url.pathname = inner;
    return env.ASSETS.fetch(new Request(url.toString(), request));
  },
};
