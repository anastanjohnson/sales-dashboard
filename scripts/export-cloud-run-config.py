#!/usr/bin/env python3
"""Export the exact Cloud Run service to an ignored private directory. Never prints values."""
import json
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
target = root / "migration-private"
os.umask(0o077)
target.mkdir(mode=0o700, exist_ok=True)
output = target / "cloud-run-service.json"
if output.exists():
    sys.exit("Export already exists; preserve it and choose a new backup before exporting again.")
try:
    result = subprocess.run([
        "gcloud", "run", "services", "describe", "sales-dashboard-supabase",
        "--project=tidy-groove-496114-i4", "--region=europe-west1", "--format=json"
    ], check=True, capture_output=True, text=True)
    data = json.loads(result.stdout)
    if data.get("metadata", {}).get("name") != "sales-dashboard-supabase":
        sys.exit("Unexpected service identity; export not saved.")
    with output.open("x", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)
        handle.write("\n")
    output.chmod(0o600)
except (FileNotFoundError, subprocess.CalledProcessError, ValueError):
    sys.exit("Export failed. Check local gcloud installation, sign-in and project access. No configuration values were printed.")
print("Private service export saved in migration-private/cloud-run-service.json. Do not upload it to GitHub or chat. Secret Manager values are not resolved by this export.")
