# Hosting on Cloudflare, 19 Nov 2026

## Docs read (developers.cloudflare.com, 19 Nov 2026)
- Limits page, Static Assets: files per Worker version "20,000" free / "100,000" paid; individual file "25 MiB" both.
- Static assets: `[assets] directory`, `binding`, `not_found_handling`, `run_worker_first` (true, or an array of route
  patterns, `!` negates). `env.ASSETS.fetch(request)` applies html handling to the path. Default header
  `Cache-Control: public, max-age=0, must-revalidate`. `.assetsignore` uses `.gitignore` format (not needed here).

## Page requests recorded (Playwright, LA 06037, Cook 17031, Travis 48453, Roane TN 47135; Map, Explore, Invest)
Same-origin: index, `app/*.js|css`, `app/vendor/*`, `app/config.js`, 30 files in `app/data/` (plus per-county
`crash_counts`, `crash_gaps`, `tree_equity_2025`), `src/engines/investmentDecisionEngine.js`,
`counties/sites_<fips>.json.gz`. Two optional files return 404 on purpose (`crash_counts/48453.json`,
`counties/sites_47135.json.gz` do not exist; the page copes, same as on GitHub Pages). Other hosts: Google Fonts, LA
County tile service, and `pub-79001cd74c284c499559e54d4aa4f33b.r2.dev/counties/bundle_*.json.gz`.

## Built and checked locally
`npm run build:site`: 1,908 files, 63.1 MiB, no file near 25 MiB. A throwaway server mapping paths exactly as
`workers/site.ts` does served `dist-site/` and the page was loaded at `/` and at `/city-pretty/` for the four counties
and three views: 53 same-origin requests each, bundles from r2.dev, only the 2 expected 404s, no other console errors.
Screenshots: `scratchpad/hosting/dist-root-*.png`, `dist-city-pretty-*.png`. `workers/site.ts` has unit tests.
Note seen in a screenshot: after opening Travis the county label still read "Cook County, IL" while the Invest brief
was Travis (Austin) content; this also happens on the unmodified page and was not investigated here.

## Done on Cloudflare
- Advisor Worker redeployed (version 6968745a-243e-4c0c-ab35-1bd5d6fc32bc) with the site origin
  `https://city-pretty.city-pretty.workers.dev` allowed (exact host, https only; unit test added).
  `/api/health` with `Origin: https://city-pretty.city-pretty.workers.dev` returns `ai_advisor_ready: true` and
  `access-control-allow-origin` echoing that origin. No advisor questions were asked.
- R2 CORS read-only check: a bundle/manifest request with that Origin returns `Access-Control-Allow-Origin: *`.
  R2 usage read: 1.145 GB of 10 GB. Nothing in R2 was changed.

## NOT done: deploying the site Worker
`npx wrangler deploy -c wrangler.site.toml` builds the asset manifest and creates an upload session, then POSTs files to
`/accounts/<id>/workers/assets/upload` with a session token in `Authorization`. That returned 401 after 5 retries.
Cause found: the session's proxy substitutes its own account token for any `Authorization` header on
`api.cloudflare.com/client/v4/accounts/...` (a request with a made-up bearer token to `/accounts/<id>/tokens/verify`
came back as the valid account token), so the upload token never arrives. No Worker `city-pretty` exists on the
account (listed before and after). Not worked around. So deployed-site checks (new address loads, counties, Explore/Invest,
advisor round trip from the new origin, no console errors) have NOT been run; the local checks above are the substitute.
Fix: run `npm run deploy:site` from any machine with a Cloudflare login, or the GitHub workflow
`.github/workflows/deploy-site.yml` with the two repository secrets.
