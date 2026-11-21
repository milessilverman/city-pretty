# Hosting: how the site is served (19 Nov 2026)

Three pieces, all on the owner's Cloudflare account.

| Piece | What it does | Config | Address |
|---|---|---|---|
| Site Worker `city-pretty` | Serves the page and its small files (`dist-site/`, about 1,900 files, 63 MiB) as static assets. Also answers `/city-pretty/...` with the same files, so the old GitHub Pages path keeps working. | `wrangler.site.toml`, `workers/site.ts`, `scripts/build_site_dist.mjs` | `https://city-pretty.city-pretty.workers.dev/` (expected address; see "Status") |
| Advisor Worker `city-pretty-api-proxy` | AI advisor, Street View, public-facts lookups. Only the site's own origins may call it (`ALLOWED_ORIGINS` in `workers/api-proxy.ts`). | `wrangler.toml` | `https://city-pretty-api-proxy.city-pretty.workers.dev` |
| R2 bucket `city-pretty-data` | The big county files `counties/bundle_*.json.gz` (about 1.1 GB). | `app/data/county_hosts.json` | `https://pub-79001cd74c284c499559e54d4aa4f33b.r2.dev/` (any origin allowed) |

## HARD LIMIT: R2 must never exceed 10 GB
The owner's rule (see `CLAUDE.md`). Upload only with `python3 scripts/r2_sync_counties.py` (stops at 8 GB; run
`--dry-run` first). Nothing in these steps touches R2. `python3 scripts/r2_sync_counties.py --usage` only reads.

## Limits relied on (Cloudflare docs, read 19 Nov 2026)
developers.cloudflare.com/workers/platform/limits, Static Assets: files per Worker version 20,000 (free) / 100,000
(paid); individual file 25 MiB (both). Default caching for assets: `Cache-Control: public, max-age=0,
must-revalidate` with an ETag (the browser re-checks each time). `run_worker_first` can be an array of path
patterns, so only `/city-pretty` and `/city-pretty/*` run Worker code; all other requests are plain asset requests.
`.assetsignore` is not needed because `dist-site/` is built from an allowlist.

## What is in the site (and what is not)
`index.html`, all of `app/` (code, styles, vendor libraries and the small data files in `app/data/`), `src/**/*.js`
(the engines the page imports), `counties/manifest.json`, `counties/sites_*.json.gz`, `docs/DECISION-ENGINE.md`
(linked from Invest). Left out: `counties/bundle_*.json.gz` (R2), node_modules, .git, national/, pipeline/, scripts/,
tests/, data/, research/, workers/. The build fails if a needed file is missing or one is over 25 MiB.
The page needed no code change for the new address: `resolveRepoAssetUrl` uses relative paths at `/` and the
`/city-pretty/` prefix when the page is opened under it.

## Redeploy commands
Set `CLOUDFLARE_ACCOUNT_ID=f453f73f6bf89cdf05f91ad3396aaec8` and a real `CLOUDFLARE_API_TOKEN` (Workers edit) first.
- Site: `npm run deploy:site` (builds `dist-site/`, then `npx wrangler deploy -c wrangler.site.toml`). Build only: `npm run build:site`.
  Or run the "Deploy site to Cloudflare" workflow from the repository's Actions tab (needs the secrets below).
- Advisor: `npx wrangler deploy` (default `wrangler.toml`). Secrets (`ANTHROPIC_API_KEY` etc.) stay on Cloudflare.
- Data files in R2: only `python3 scripts/r2_sync_counties.py` (see the limit above).

## Status and the one thing that blocked the deploy from the build session
The advisor Worker was redeployed on 19 Nov with the new origin allowed. The site Worker has NOT been deployed from the
build session: Wrangler's asset upload uses a short-lived upload token sent in the `Authorization` header, and the
build session's network proxy replaces that header on every `api.cloudflare.com/accounts/...` request with the account
token, so Cloudflare answers 401 on `POST /workers/assets/upload`. (Shown by calling `/accounts/<id>/tokens/verify`
with a made-up bearer token and getting the account token back.) Deploy from any normal machine or from the GitHub
workflow instead. Details: `docs/audit/hosting-cloudflare-2026-11-19.md`.

## Making the repository private (owner steps)
1. Deploy the site Worker (`npm run deploy:site` from a computer with `wrangler login`, or add the repository secrets
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` under Settings -> Secrets and variables -> Actions and run
   the "Deploy site to Cloudflare" workflow).
2. Open the new address and check, before anything else: the page loads; open Los Angeles, Cook and Travis counties;
   Explore and Invest show content; the Ask AI drawer says Connected; a county file request goes to `r2.dev`.
3. Only then: GitHub -> the repository -> Settings -> General -> scroll to Danger Zone -> Change repository
   visibility -> Make private -> confirm.
4. What stops: `https://milessilverman.github.io/city-pretty/` (GitHub Pages does not serve private repositories on a
   free plan), so every link or bookmark to it dies, and the regional data repositories
   (`city-pretty-data-*`) behave the same if made private. The page falls back to its own `counties/` path if a data host fails, but the new site does not carry the
   bundle files, so county loading depends on R2 staying up. GitHub Actions minutes for private repositories are limited on free plans.
5. First checks afterwards: new address loads, advisor health at `<advisor>/api/health` is ready when called with
   `Origin: <new address>`, one county opens from `r2.dev`.

## Still depends on GitHub Pages
The github.io address itself, and the `fetchJSON` fallback in `app/app.js` that retries on `milessilverman.github.io`
after a network failure (it does nothing harmful once the site is private; it only fails). The e2e suite and
`scripts/serve.mjs` still serve under `/city-pretty/`.
