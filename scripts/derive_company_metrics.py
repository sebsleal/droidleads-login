#!/usr/bin/env python3
"""Derive sanitized company metrics from local PDF exports."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from company_data.metrics import DEFAULT_OUTPUT_PATH, write_company_metrics


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build sanitized company metrics JSON from claim PDFs"
    )
    parser.add_argument("--claims-pdf", required=True, help="Path to All Claims PDF")
    parser.add_argument(
        "--tracker-pdf", required=True, help="Path to process-tracker PDF"
    )
    parser.add_argument(
        "--graphs-pdf", help="Optional chart PDF used as a manual validation reference"
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT_PATH),
        help="Destination JSON path (default: src/data/companyMetrics.json)",
    )
    args = parser.parse_args()

    metrics = write_company_metrics(
        claims_pdf=args.claims_pdf,
        tracker_pdf=args.tracker_pdf,
        graphs_pdf=args.graphs_pdf,
        output_path=args.output,
    )

    print(f"Wrote sanitized company metrics to {Path(args.output)}")
    print(f"Claims rows: {metrics['claims_summary']['record_count']}")
    print(f"Tracker rows: {metrics['workflow_summary']['record_count']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
