"""Shared helpers for the prediction-signal fetchers (see docs/audit/prediction-signals-2026-11-22.md).

All raw downloads go to SCRATCH (never the repository) and are deleted after they are reduced.
Run every script from the repository root:  python3 scripts/signals/fetch_<source>.py
"""
import csv
import gzip
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "signals")
SCRATCH = os.environ.get(
    "SIGNALS_SCRATCH",
    "/tmp/claude-0/-home-user-city-pretty/3156622b-69a9-5d91-83c1-d393ef77389e/scratchpad/signals",
)
# Read-only caches left by the back-test run on 18 Nov 2026 (FHFA tract file, ACS files, Gazetteers).
BACKTEST_CACHE = os.environ.get(
    "BACKTEST_CACHE",
    "/tmp/claude-0/-home-user-city-pretty/3156622b-69a9-5d91-83c1-d393ef77389e/scratchpad/decision/cache",
)
os.makedirs(OUT, exist_ok=True)
os.makedirs(SCRATCH, exist_ok=True)


def backtest_counties():
    """The 50 county FIPS codes used by the neighbourhood-score back-test (same list, same order)."""
    d = json.load(open(os.path.join(ROOT, "app", "data", "neighborhood_score_backtest.json")))
    return d["sample"]["county_list"]


def county_states():
    return sorted({c[:2] for c in backtest_counties()})


def curl_stream(url, extra=None):
    """Start curl writing to a pipe (goes through the environment proxy). Caller reads .stdout."""
    cmd = ["curl", "-sSL", "--fail", "--retry", "3", "--max-time", "1800"] + (extra or []) + [url]
    return subprocess.Popen(cmd, stdout=subprocess.PIPE)


def curl_file(url, dest, retries=3):
    for _ in range(retries):
        r = subprocess.run(["curl", "-sSL", "--fail", "--retry", "2", "--max-time", "1800", "-o", dest + ".part", url])
        if r.returncode == 0:
            os.replace(dest + ".part", dest)
            return dest
    raise RuntimeError("download failed: " + url)


def write_gz_csv(path, header, rows):
    with gzip.open(path, "wt", newline="", compresslevel=9) as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    return os.path.getsize(path)


def read_gz_csv(path):
    with gzip.open(path, "rt", newline="") as f:
        yield from csv.DictReader(f)
