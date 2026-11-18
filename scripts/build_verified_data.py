#!/usr/bin/env python3
"""scripts/build_verified_data.py is retired. The JSON it used to generate (app/data/statutes.json, funding_programs.json, case_studies.json, transit_pipelines.json) was checked by hand against primary sources on 2026-11-18 and is now the source of truth; re-running the old generator would overwrite those corrections with unverified typed-in values. Edit the JSON directly and record evidence in research/laws_verification.csv."""
import sys
print("scripts/build_verified_data.py is retired. The JSON it used to generate (app/data/statutes.json, funding_programs.json, case_studies.json, transit_pipelines.json) was checked by hand against primary sources on 2026-11-18 and is now the source of truth; re-running the old generator would overwrite those corrections with unverified typed-in values. Edit the JSON directly and record evidence in research/laws_verification.csv.", file=sys.stderr)
sys.exit(1)
