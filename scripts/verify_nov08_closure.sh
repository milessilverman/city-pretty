#!/bin/bash
set -euo pipefail

cd /Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline

echo "========================================================"
echo "CITY PRETTY NOV 08 AUDIT CLOSURE VERIFICATION SUITE"
echo "========================================================"

echo "Step 1: Running 12-suite calculation engine test suite..."
python3 tests/run_audit_tests.py

echo "Step 2: Running live headless browser runtime verification..."
python3 tests/verify_nov08_runtime.py

echo "Step 3: Checking distribution replica synchronization..."
HASH1=$(md5 -q index.html)
HASH2=$(md5 -q city-pretty.html || echo "missing")
HASH3=$(md5 -q /Users/milessilverman/Downloads/city-pretty-verified/city-pretty.html || echo "missing")

echo "  index.html:                                 ${HASH1}"
echo "  city-pretty.html:                           ${HASH2}"
echo "  Downloads/city-pretty-verified/...:         ${HASH3}"

if [ "${HASH1}" != "${HASH2}" ] || [ "${HASH1}" != "${HASH3}" ]; then
  echo "❌ Error: Distribution replicas are not synchronized!"
  exit 1
fi

echo "✓ All 3 distribution replicas match MD5: ${HASH1}"
echo "========================================================"
echo "ALL AUDIT CLOSURE VERIFICATIONS PASSED (100% SUCCESS)!"
echo "========================================================"
