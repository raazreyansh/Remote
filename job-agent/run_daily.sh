#!/usr/bin/env bash
set -euo pipefail

python -m backend.services.ats_ingestion
python run_phase3_test.py --profile data/profile.json --threshold 70 --limit 10
