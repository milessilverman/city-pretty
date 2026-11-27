As of 2026-11-24: computed by scripts/platform_pilot_la.mjs from app/data/bundle-la.b64.txt (layers.projects, layers.pj_kinds). Back-test harness: src/platform/coverage/backtest.js (unchanged).

## Result: back-test not possible on this data
Harness refusal (SurvivorshipError): truth contains no failed or cancelled project; a survivors-only truth set is refused

## Counts
Rows 6379; undated (year not a 4-digit value) 28; dated on or before the cut-off 3612; dated after it 2739.
Cut-off year 2024: the year by which 70% of dated rows with a mapped outcome fall (the later rows are kept as truth). Rows carry a year only; each is dated 31 Dec of that year.
After the cut-off: 383 rows have a mapped outcome; truth records (mapped outcome and mapped category) 0; by outcome built 0; succeeded 0; alternative 0; failed 0; cancelled 0.
Outcome mapped from status text for 2119 rows; unmapped 4260. Category mapped for 0; unmapped 6379. Duplicate row ids made unique: 1150.

## Mappings used (read from code, not judgement per row)
Status to outcome: "completed" -> built; "in-service" -> built; "cofo issued" -> built; "permit finaled" -> built. Every other status text has outcome null.
Kind to category: "new adu" -> adu. Every other kind is unmapped.

## Rows by status
approved 1307; completed 1275; permitted 948; Issued 781; In-Service 587; Construction 570; Design 396; CofO Issued 225; Bid & Award 180; Pre-Design 33; Permit Finaled 32; Development 27; CofO Corrected 5; Permit Closed 4; Right of Way/Approvals 3; (null) 2; Permit Expired 2; CofO in Progress 2.

## Rows by kind
housing approved 1307; housing completed 1275; city capital project 1182; housing permitted 948; affordable housing 616; new building 564; new apartments 487.

## What is missing
Dated project outcomes that include failed or cancelled projects (and plausible alternatives), with a year or date for when each outcome was known, and a record of which rows the pilot discovery could have seen before the cut-off.
Rows whose status text maps to failed or cancelled: 0; to alternative: 0 (no status text names one). None was invented and the harness was not changed.
