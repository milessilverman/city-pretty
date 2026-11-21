# City Pretty: rules for any AI working in this repository

## HARD LIMIT: Cloudflare R2 storage must never exceed 10 GB

The owner's instruction (19 Nov 2026): **do not exceed the 10 GB R2 free storage allowance under any circumstance.**
Going over costs the owner money. This overrides every other goal, including finishing a county build.

- Upload to R2 **only** with `python3 scripts/r2_sync_counties.py`. It totals every object in every bucket of the
  account first and refuses any upload that would take storage above **8 GB** (a 2 GB safety margin).
- Run `python3 scripts/r2_sync_counties.py --dry-run` before every upload and read the projected total.
- **Never** raise `CEILING_BYTES`, bypass the check, upload with wrangler, rclone, the S3 API, the dashboard or any
  other tool, create another bucket, turn on object versioning, or start a multipart upload (unfinished parts are
  billed but do not show in listings).
- Do not store anything in R2 except the files under `counties/`. No backups, caches, raw downloads or logs.
- If data no longer fits under 8 GB: **stop and ask the owner.** The owner repeated on 19 Nov: do not pass the limit
  without asking, no matter what. Do not delete objects to make room without asking either.
- R2 also meters requests. Do not write scripts that list or re-upload the whole bucket in a loop.

## Accuracy rules (the owner's, from `docs/WORK-QUEUE.md` and `docs/DATA-AUDIT-AND-TRANSPARENCY.md`)

- Never type a number, date, citation or URL that was not fetched from its source in the same session. If it cannot
  be fetched, withhold it and show the reason.
- Every claim needs a fetched primary source with a verbatim quote and URL, stored next to the data.
- Report mistakes as dated corrections in `docs/DATA-AUDIT-AND-TRANSPARENCY.md`.
- "Working" means seen on the real page (`scripts/live_check_panels.mjs`, unique `LIVE_PORT`), not only unit tests.
- Before committing: `npm test`, `npm run typecheck`, `PW_PORT=<unique> npm run test:e2e` all pass. Never skip or
  weaken a test to get green.
- Never commit API keys or tokens. Secrets live in the cloud environment's network secrets or in Cloudflare secrets.

## Where things are

- Open work: `docs/WORK-QUEUE.md`. One-month plan: `docs/PLAN-DEVELOPER-PLATFORM.md`. Research prompts the owner sends
  out: `docs/RESEARCH-PROMPTS.md`. Evidence per area: `docs/audit/`.
- County files load from the host in `app/data/county_hosts.json` (R2 when enabled), falling back to `counties/`.
- The AI advisor runs in the Cloudflare Worker (`workers/`); the page works without it.
