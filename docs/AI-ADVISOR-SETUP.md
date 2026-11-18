# AI advisor: setup for the site owner

The advisor is a Cloudflare Worker (`workers/api-proxy.ts`) that holds your Anthropic API key, calls Claude, lets Claude
look things up in the site's own data tables, and checks the reply's numbers before the page shows it.

**Status of this build:** written and unit-tested with a mocked network only (`npx vitest run tests/unit/advisorWorker.test.ts`).
It has NOT been deployed and has NOT been run against the real Claude API: the session that wrote it had no API key.
The first real question is the first live test. Expect to fix small things (see "If something fails").

## Steps

1. **Create an API key.** Sign in at https://platform.claude.com, open Settings, API keys, create a key (name it
   `city-pretty-advisor`). Set a monthly spend limit for the workspace in the same console so a bug or abuse cannot run up a bill.
2. **Sign in to Wrangler** (Cloudflare's CLI; `npx` downloads it on first use, it is not in package.json): `npx wrangler login`.
3. **Store the key as a secret** (never in a file):
   `npx wrangler secret put ANTHROPIC_API_KEY` and paste the key when asked.
   Street View photos need `npx wrangler secret put GOOGLE_MAPS_KEY` as well; the advisor works without it.
4. **Deploy:** `npx wrangler deploy`. It prints the Worker's URL, like `https://city-pretty-api-proxy.<you>.workers.dev`.
5. **Point the page at it:** in `app/config.js` set `workerUrl` to that URL (no trailing slash), commit, push.
6. **Check:** open `<worker url>/api/health` from the site's page (the Worker only answers the site's own origins, so use the
   page: the advisor's status chip should say "Connected"). `ai_advisor_ready` is false whenever the key is missing.

Settings you can change in `wrangler.toml` `[vars]` (then `npx wrangler deploy` again):

| Var | Default | What it does |
|---|---|---|
| `ADVISOR_MODEL` | `claude-opus-5-5` | The Claude model. Overrides the constant in `workers/api-proxy.ts`. |
| `ADVISOR_EFFORT` | `medium` | How much the model thinks: `low`, `medium`, `high`, `xhigh`, `max`. Lower is cheaper and faster. |
| `SITE_DATA_BASE` | `https://milessilverman.github.io/city-pretty/app/data/` | Where the advisor's tools read the data tables. Change it if the site moves. |
| `ADVISOR_FALLBACKS` | (unset) | Set to `off` to stop sending the server-side refusal fallback if the API rejects it. |

The per-visitor limit (6 questions a minute) and the allowed origins are unchanged.

## What a question costs

Prices change; read the current ones at https://platform.claude.com/docs/en/about-claude/pricing. Use the model table
there for the `ADVISOR_MODEL` you choose.

Token use per question (estimates from the code, not measured live):

- **Fixed part:** the instructions (about 500 tokens) plus the ten tool definitions (about 2,500 tokens). This part is sent
  as a cached block, so repeat questions within a few minutes pay the lower cache-read rate on it, if the API's minimum
  cacheable size is met (if it is not, it is billed as normal input; the page works either way).
- **Page data:** the JSON for the county, block group or lot, the decision brief and the question: roughly 1,000 to 3,000 tokens.
- **Tool rounds:** each lookup adds the table rows it returns, capped at about 24,000 characters (roughly 6,000 tokens) per
  lookup, and the whole conversation is re-sent on each round. A question with no lookup is one call; with up to six
  lookup rounds it can be seven calls and tens of thousands of input tokens.
- **Output:** the instructions ask for a few sentences, plus any hidden reasoning the model does (counted as output).
  Capped at 4,096 tokens per call.

As a rough guide, with the cached prices published in the Claude API reference for `claude-opus-5-5` (cached 2026-11-03:
$4 per million input tokens, $20 per million output tokens): a question with no lookup (about 5,000 input, 1,000 output
tokens) is a few cents; a question with three lookups (about 30,000 input tokens across calls, 2,000 output) is on the
order of 15 cents. Check your real usage in the console, and set the spend limit in step 1. If cost matters, set
`ADVISOR_EFFORT = "low"` or choose a cheaper model in `ADVISOR_MODEL`. The Worker returns a `usage` field (token counts)
with every answer so you can measure it.

## What the grounding warning means

After the model answers, the Worker reads the reply for dollar amounts, percentages and numbers with units (miles, acres,
years, homes, and so on). Each one must appear in the page data the visitor sent, in a table row the advisor looked up
during this question, or be the result of arithmetic written out in the reply ("$2,328 + $1,800 = $4,128"). Rounding is
allowed ("$1.5 million" for 1,512,000).

If a figure is not found, the Worker asks the model once to remove it or source it. If it is still there, the answer is
returned with `grounding: { ok: false, unverified_figures: [...] }`. The page should show a warning such as "These figures
could not be matched to the page data or the site's tables: ...". It means: **do not rely on those figures**. It does not mean
they are wrong, only that this system could not trace them. A clean result (`ok: true`) means every checked figure was
found in the data; it does not prove the model used it correctly.

Not checked: whole numbers of 10 or fewer with a unit ("3 units"), 0% and 100%, years, and numbers without a unit or a $ or %.
The advisor's tables carry their own verification status; rows marked `partly`, `unverified` or unreachable are unconfirmed,
and the model is told to say so.

## If something fails

- `The AI advisor could not sign in...` (502): the key is wrong or revoked. Run `wrangler secret put ANTHROPIC_API_KEY` again.
- `The AI service is busy` (429) or `overloaded` (503): the Anthropic API is rate limiting or overloaded; try again.
- `The AI service could not take that question` (502): the API rejected the request (a 400). Run `npx wrangler tail` and ask
  a question; the Worker logs the API's error text. The most likely cause is a request field the chosen model does not
  accept (for example an `ADVISOR_MODEL` that is not in the Opus 5.5 / Fable / Sonnet 5.5 family and does not take
  `output_config.effort`, or the fallback header: set `ADVISOR_FALLBACKS = "off"`).
- The tools return nothing: check that `SITE_DATA_BASE` serves the JSON files (open `<base>statutes.json` in a browser).
