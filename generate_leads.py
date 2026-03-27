"""
Compatibility wrapper for the canonical lead pipeline.

This script exists so local operators and older automation entrypoints can
continue to run `python3 generate_leads.py`, but the actual lead-building logic
now lives in `pipeline/leads.py`.
"""

from __future__ import annotations

from pathlib import Path

from pipeline.leads import build_canonical_lead_dataset, write_leads_json


def run() -> int:
    result = build_canonical_lead_dataset()
    payload = write_leads_json(result.leads, output_path=Path("public/leads.json"))
    print(f"Wrote canonical lead dataset: {payload['count']} leads")
    print(
        "Source mix: "
        f"{result.permit_count} permit, "
        f"{result.storm_count} storm, "
        f"{result.pre_permit_count} pre-permit"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
