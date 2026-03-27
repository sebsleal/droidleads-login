from __future__ import annotations

import json
import math
import statistics
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import pdfplumber

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "src" / "data" / "companyMetrics.json"

CLAIMS_HEADERS = [
    "file_number",
    "client_last_name",
    "client_first_name",
    "client_organization",
    "client_type",
    "status",
    "on_behalf_of",
    "mailing_address",
    "phones",
    "email",
    "property_name",
    "loss_address",
    "loss_date",
    "peril",
    "related_to",
    "estimated_loss",
    "fee_rate",
    "fee_disbursed",
    "assignees",
    "insurance_company",
    "policy_type",
    "policy_number",
    "claim_number",
    "date_logged",
]

TRACKER_HEADERS = [
    "client_name",
    "claim_number",
    "loss_date",
    "lor",
    "type_of_claim",
    "plumbing_invoice",
    "water_mitigation",
    "estimate",
    "inspection",
    "srl",
    "cdl_1",
    "cdl_2",
    "cdl_3",
    "status",
    "review",
    "extra",
]

TRACKER_MILESTONES = ["estimate", "inspection", "srl", "cdl_1", "cdl_2", "cdl_3"]

OPEN_CASE_STATUSES = {
    "OpenPhase: Claim Originated",
    "OpenPhase: Estimating",
    "OpenPhase: Inspection",
    "OpenPhase: Under Review",
    "OpenPhase: Negotiation",
    "OpenPhase: Appraisal",
    "OpenPhase: Mediation",
    "OpenPhase: Mortgage Processing",
    "OpenPhase: Initial Payment",
    "OpenPhase: Recovering Depreciation",
    "OpenPhase: Ready to Close",
}


@dataclass(frozen=True)
class SourceFiles:
    claims_pdf: str
    graphs_pdf: str | None = None
    tracker_pdf: str | None = None


def parse_money(value: str | None) -> float:
    raw = (value or "").strip().replace("$", "").replace(",", "")
    if not raw:
        return 0.0
    if raw.endswith("-"):
        raw = raw[:-1].strip()
    try:
        return float(raw)
    except ValueError:
        return 0.0


def parse_percentage(value: str | None) -> float | None:
    raw = (value or "").strip().replace("%", "")
    if not raw:
        return None
    try:
        percent = float(raw)
    except ValueError:
        return None
    return percent / 100 if percent > 1 else percent


def parse_date(value: str | None) -> date | None:
    raw = (value or "").strip()
    if not raw or raw.lower() in {"n/a", "none"}:
        return None
    for fmt in (
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%m/%d/%y",
        "%m/%d/%Y",
        "%m/%d/%y",
        "%m/%d/%Y",
        "%m/%d/%y",
    ):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def looks_like_date(value: str | None) -> bool:
    return parse_date(value) is not None


def is_checkmark(value: str | None) -> bool:
    raw = (value or "").strip().lower()
    return raw in {"✓", "yes", "y", "completed"}


def title_case_words(value: str) -> str:
    return " ".join(part for part in value.replace("_", " ").split()).title()


def normalize_case_status(raw: str | None) -> str:
    value = (raw or "").strip()
    if value == "OpenPhase: Litigation":
        return "Litigation"
    if value in {"Settled", "OpenPhase: Settled"}:
        return "Settled"
    if not value:
        return "Unknown"
    return value


def normalize_tracker_status(raw: str | None) -> str:
    value = (raw or "").strip()
    if not value:
        return "Blank"
    return value


def normalize_insurer(raw: str | None) -> str:
    value = (raw or "").strip()
    if not value:
        return "Unknown"
    collapsed = " ".join(value.split())
    aliases = {
        "StateFarm": "State Farm",
        "Universal Property": "Universal Property",
        "Universal North America": "Universal North America",
        "Integon National Insurance Company": "Integon National",
        "Underwriters at Lloyd's": "Underwriters at Lloyd's",
    }
    return aliases.get(collapsed, collapsed)


def normalize_peril(raw: str | None) -> tuple[str, str]:
    value = (raw or "").strip()
    lowered = value.lower()
    if lowered in {
        "accidental discharge",
        "bathroom",
        "bath",
        "m bath",
        "h bath",
        "hall bath",
        "kitchen",
        "laundry",
        "plumbing failure",
        "pipe break",
        "water mold",
        "plumbing mold",
        "bathroom mold",
        "ac leak",
        "a/c leak",
    }:
        return "Accidental Discharge", "bathroom_water"
    if lowered in {
        "hurricane",
        "wind/rain",
        "milton",
        "ian",
        "hail",
        "windrain",
        "wind/rain ",
    }:
        return "Hurricane/Wind", "storm"
    if lowered in {"roof leak"}:
        return "Roof", "roof_leak"
    if lowered in {"fire"}:
        return "Fire", "fire"
    if lowered in {"collapse"}:
        return "Structural", "structural"
    if lowered in {"flood"}:
        return "Flood", "flood"
    if not value:
        return "Unknown", "unknown"
    return value, lowered.replace("/", "_").replace(" ", "_")


def month_key(value: date | None) -> str | None:
    return value.strftime("%Y-%m") if value else None


def month_label(value: str) -> str:
    return datetime.strptime(value, "%Y-%m").strftime("%b %Y")


def bucket_rate(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round(numerator / denominator, 4)


def rounded(value: float, digits: int = 2) -> float:
    return round(float(value), digits)


def median_days(values: list[int]) -> float:
    if not values:
        return 0.0
    return float(statistics.median(values))


def average_days(values: list[int]) -> float:
    if not values:
        return 0.0
    return round(sum(values) / len(values), 1)


def parse_claims_pdf(path: str | Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with pdfplumber.open(str(path)) as pdf:
        if not pdf.pages:
            return rows
        table = pdf.pages[0].extract_table()
        if not table or len(table) < 3:
            return rows

        for raw_row in table[2:]:
            if not raw_row:
                continue
            row = list(raw_row[: len(CLAIMS_HEADERS)])
            if len(row) < len(CLAIMS_HEADERS):
                row.extend([""] * (len(CLAIMS_HEADERS) - len(row)))
            record = {
                header: (row[index] or "").strip()
                for index, header in enumerate(CLAIMS_HEADERS)
            }
            if not record["file_number"]:
                continue
            record["full_name"] = " ".join(
                part
                for part in [record["client_first_name"], record["client_last_name"]]
                if part
            ).strip()
            record["status_normalized"] = normalize_case_status(record["status"])
            record["peril_normalized"], record["claim_family"] = normalize_peril(
                record["peril"]
            )
            record["insurance_company_normalized"] = normalize_insurer(
                record["insurance_company"]
            )
            record["fee_rate_value"] = parse_percentage(record["fee_rate"])
            record["fee_disbursed_value"] = parse_money(record["fee_disbursed"])
            record["estimated_loss_value"] = parse_money(record["estimated_loss"])
            record["loss_date_value"] = parse_date(record["loss_date"])
            record["date_logged_value"] = parse_date(record["date_logged"])
            rows.append(record)
    return rows


def normalize_tracker_row(cells: list[str]) -> dict[str, Any]:
    trimmed = [(cell or "").strip() for cell in cells]
    if trimmed and not trimmed[0]:
        trimmed = trimmed[1:]
    if len(trimmed) < len(TRACKER_HEADERS):
        trimmed.extend([""] * (len(TRACKER_HEADERS) - len(trimmed)))
    trimmed = trimmed[: len(TRACKER_HEADERS)]

    record = {header: trimmed[index] for index, header in enumerate(TRACKER_HEADERS)}

    # The tracker PDF drifts on later pages. If the LOR field contains a date and
    # the type-of-claim column is empty, shift the milestone window one cell right.
    if looks_like_date(record["lor"]) and not record["type_of_claim"]:
        shifted = trimmed[:]
        shifted.insert(3, "")
        shifted = shifted[: len(TRACKER_HEADERS)]
        record = {
            header: shifted[index] for index, header in enumerate(TRACKER_HEADERS)
        }

    record["client_name_normalized"] = " ".join(record["client_name"].lower().split())
    record["status_normalized"] = normalize_tracker_status(record["status"])
    peril_label, claim_family = normalize_peril(record["type_of_claim"])
    record["claim_family"] = claim_family
    record["type_of_claim_normalized"] = peril_label
    record["lor_complete"] = is_checkmark(record["lor"])
    record["plumbing_invoice_complete"] = is_checkmark(record["plumbing_invoice"])
    record["water_mitigation_complete"] = is_checkmark(record["water_mitigation"])
    record["review_required"] = (record["review"] or "").strip().lower() == "yes"
    for milestone in TRACKER_MILESTONES:
        record[f"{milestone}_date"] = parse_date(record[milestone])
    return record


def parse_tracker_pdf(path: str | Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            table = page.extract_table()
            if not table or len(table) < 3:
                continue
            for raw_row in table[2:]:
                if not raw_row:
                    continue
                record = normalize_tracker_row(list(raw_row))
                if not record["client_name"]:
                    continue
                rows.append(record)
    return rows


def build_claims_metrics(rows: list[dict[str, Any]]) -> dict[str, Any]:
    statuses = Counter(row["status_normalized"] for row in rows)
    perils: dict[str, list[dict[str, Any]]] = defaultdict(list)
    insurers: dict[str, list[dict[str, Any]]] = defaultdict(list)
    monthly_fees: dict[str, dict[str, float | int]] = {}

    loss_dates = [row["loss_date_value"] for row in rows if row["loss_date_value"]]
    logged_dates = [
        row["date_logged_value"] for row in rows if row["date_logged_value"]
    ]

    for row in rows:
        perils[row["peril_normalized"]].append(row)
        insurers[row["insurance_company_normalized"]].append(row)
        key = month_key(row["date_logged_value"])
        if key:
            bucket = monthly_fees.setdefault(key, {"fees": 0.0, "cases": 0})
            bucket["fees"] += row["fee_disbursed_value"]
            bucket["cases"] += 1

    monthly_fees_sorted = [
        {
            "month_key": key,
            "label": month_label(key),
            "fees": rounded(bucket["fees"]),
            "case_count": int(bucket["cases"]),
        }
        for key, bucket in sorted(monthly_fees.items())
    ]

    def build_bucket_metrics(grouped_rows: list[dict[str, Any]]) -> dict[str, Any]:
        total = len(grouped_rows)
        settled = sum(
            1 for row in grouped_rows if row["status_normalized"] == "Settled"
        )
        litigation = sum(
            1 for row in grouped_rows if row["status_normalized"] == "Litigation"
        )
        no_pay = sum(
            1 for row in grouped_rows if row["status_normalized"] == "Closed w/o Pay"
        )
        open_cases = total - settled - litigation - no_pay
        total_fees = sum(row["fee_disbursed_value"] for row in grouped_rows)
        paid_cases = sum(1 for row in grouped_rows if row["fee_disbursed_value"] > 0)
        average_paid_fee = total_fees / paid_cases if paid_cases else 0.0
        expected_fee_per_case = total_fees / total if total else 0.0
        known_outcome_total = settled + litigation + no_pay
        return {
            "sample_size": total,
            "settled_like_rate": bucket_rate(settled, total),
            "litigation_rate": bucket_rate(litigation, total),
            "no_pay_rate": bucket_rate(no_pay, total),
            "open_rate": bucket_rate(open_cases, total),
            "known_outcome_rate": bucket_rate(known_outcome_total, total),
            "total_fees": rounded(total_fees),
            "average_paid_fee": rounded(average_paid_fee),
            "expected_fee_per_case": rounded(expected_fee_per_case),
            "paid_case_count": paid_cases,
        }

    peril_metrics = []
    for peril_name, grouped_rows in sorted(
        perils.items(), key=lambda item: len(item[1]), reverse=True
    ):
        family = grouped_rows[0]["claim_family"] if grouped_rows else "unknown"
        peril_metrics.append(
            {
                "peril": peril_name,
                "claim_family": family,
                **build_bucket_metrics(grouped_rows),
            }
        )

    insurer_metrics = []
    for insurer_name, grouped_rows in sorted(
        insurers.items(),
        key=lambda item: sum(row["fee_disbursed_value"] for row in item[1]),
        reverse=True,
    ):
        insurer_metrics.append(
            {
                "insurer": insurer_name,
                **build_bucket_metrics(grouped_rows),
            }
        )

    return {
        "record_count": len(rows),
        "residential_rate": 1.0 if rows else 0.0,
        "status_distribution": [
            {"status": status, "count": count}
            for status, count in sorted(
                statuses.items(), key=lambda item: (-item[1], item[0])
            )
        ],
        "loss_date_range": {
            "start": min(loss_dates).isoformat() if loss_dates else None,
            "end": max(loss_dates).isoformat() if loss_dates else None,
        },
        "date_logged_range": {
            "start": min(logged_dates).isoformat() if logged_dates else None,
            "end": max(logged_dates).isoformat() if logged_dates else None,
        },
        "total_fee_disbursed": rounded(sum(row["fee_disbursed_value"] for row in rows)),
        "monthly_fees": monthly_fees_sorted,
        "peril_metrics": peril_metrics,
        "insurer_metrics": insurer_metrics,
        "notes": [
            "Estimated loss is blank in the PDF extract and is excluded from the scoring model.",
            "Rates are computed against all extracted cases, not only closed files.",
        ],
    }


def build_tracker_metrics(rows: list[dict[str, Any]]) -> dict[str, Any]:
    statuses = Counter(row["status_normalized"] for row in rows)
    claim_families = Counter(row["claim_family"] for row in rows)
    milestone_counts = {milestone: 0 for milestone in TRACKER_MILESTONES}

    completed_like = {"Completed"}
    terminal_statuses = {"Completed", "Litigation", "Appraisal"}

    family_buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    backlog_missing_counts = Counter()

    overall_cycle_days: list[int] = []
    inspection_to_srl_days: list[int] = []
    cdl_1_to_cdl_2_days: list[int] = []
    cdl_2_to_cdl_3_days: list[int] = []

    for row in rows:
        family_buckets[row["claim_family"]].append(row)
        for milestone in TRACKER_MILESTONES:
            if row.get(f"{milestone}_date"):
                milestone_counts[milestone] += 1

        if row["status_normalized"] not in terminal_statuses:
            for milestone in TRACKER_MILESTONES:
                if not row.get(f"{milestone}_date"):
                    backlog_missing_counts[milestone] += 1

        milestone_dates = [
            row.get(f"{milestone}_date")
            for milestone in TRACKER_MILESTONES
            if row.get(f"{milestone}_date")
        ]
        if row["status_normalized"] in completed_like and len(milestone_dates) >= 2:
            overall_cycle_days.append(
                (max(milestone_dates) - min(milestone_dates)).days
            )

        inspection_date = row.get("inspection_date")
        srl_date = row.get("srl_date")
        cdl_1_date = row.get("cdl_1_date")
        cdl_2_date = row.get("cdl_2_date")
        cdl_3_date = row.get("cdl_3_date")
        if inspection_date and srl_date and srl_date >= inspection_date:
            inspection_to_srl_days.append((srl_date - inspection_date).days)
        if cdl_1_date and cdl_2_date and cdl_2_date >= cdl_1_date:
            cdl_1_to_cdl_2_days.append((cdl_2_date - cdl_1_date).days)
        if cdl_2_date and cdl_3_date and cdl_3_date >= cdl_2_date:
            cdl_2_to_cdl_3_days.append((cdl_3_date - cdl_2_date).days)

    claim_family_metrics = []
    for family, bucket in sorted(
        family_buckets.items(), key=lambda item: len(item[1]), reverse=True
    ):
        total = len(bucket)
        completed = sum(1 for row in bucket if row["status_normalized"] == "Completed")
        litigation = sum(
            1 for row in bucket if row["status_normalized"] == "Litigation"
        )
        backlog = sum(
            1 for row in bucket if row["status_normalized"] not in terminal_statuses
        )
        cycle_days = []
        for row in bucket:
            dates = [
                row.get(f"{milestone}_date")
                for milestone in TRACKER_MILESTONES
                if row.get(f"{milestone}_date")
            ]
            if row["status_normalized"] == "Completed" and len(dates) >= 2:
                cycle_days.append((max(dates) - min(dates)).days)
        claim_family_metrics.append(
            {
                "claim_family": family,
                "label": title_case_words(family),
                "sample_size": total,
                "completed_rate": bucket_rate(completed, total),
                "litigation_rate": bucket_rate(litigation, total),
                "backlog_rate": bucket_rate(backlog, total),
                "average_cycle_days": average_days(cycle_days),
                "median_cycle_days": median_days(cycle_days),
            }
        )

    milestone_coverage = [
        {
            "milestone": milestone,
            "label": title_case_words(milestone),
            "count": milestone_counts[milestone],
            "coverage_rate": bucket_rate(milestone_counts[milestone], len(rows)),
        }
        for milestone in TRACKER_MILESTONES
    ]

    return {
        "record_count": len(rows),
        "status_distribution": [
            {"status": status, "count": count}
            for status, count in sorted(
                statuses.items(), key=lambda item: (-item[1], item[0])
            )
        ],
        "claim_family_distribution": [
            {"claim_family": family, "label": title_case_words(family), "count": count}
            for family, count in sorted(
                claim_families.items(), key=lambda item: (-item[1], item[0])
            )
        ],
        "milestone_coverage": milestone_coverage,
        "backlog_missing_stage": [
            {
                "milestone": milestone,
                "label": title_case_words(milestone),
                "count": backlog_missing_counts[milestone],
            }
            for milestone in TRACKER_MILESTONES
        ],
        "stage_durations": [
            {
                "stage": "overall_cycle",
                "label": "Completed Cycle",
                "sample_size": len(overall_cycle_days),
                "average_days": average_days(overall_cycle_days),
                "median_days": median_days(overall_cycle_days),
            },
            {
                "stage": "inspection_to_srl",
                "label": "Inspection to SRL",
                "sample_size": len(inspection_to_srl_days),
                "average_days": average_days(inspection_to_srl_days),
                "median_days": median_days(inspection_to_srl_days),
            },
            {
                "stage": "cdl_1_to_cdl_2",
                "label": "CDL 1 to CDL 2",
                "sample_size": len(cdl_1_to_cdl_2_days),
                "average_days": average_days(cdl_1_to_cdl_2_days),
                "median_days": median_days(cdl_1_to_cdl_2_days),
            },
            {
                "stage": "cdl_2_to_cdl_3",
                "label": "CDL 2 to CDL 3",
                "sample_size": len(cdl_2_to_cdl_3_days),
                "average_days": average_days(cdl_2_to_cdl_3_days),
                "median_days": median_days(cdl_2_to_cdl_3_days),
            },
        ],
        "claim_family_metrics": claim_family_metrics,
        "bottlenecks": [
            {
                "label": title_case_words(milestone),
                "kind": "backlog_missing",
                "count": backlog_missing_counts[milestone],
            }
            for milestone in sorted(
                backlog_missing_counts, key=backlog_missing_counts.get, reverse=True
            )
        ][:4],
    }


def build_scoring_model(
    claims_metrics: dict[str, Any], tracker_metrics: dict[str, Any]
) -> dict[str, Any]:
    peril_metrics = claims_metrics["peril_metrics"]
    insurer_metrics = claims_metrics["insurer_metrics"]
    tracker_family_metrics = {
        row["claim_family"]: row for row in tracker_metrics["claim_family_metrics"]
    }

    max_peril_expected = (
        max((row["expected_fee_per_case"] for row in peril_metrics), default=1.0) or 1.0
    )
    max_insurer_expected = (
        max((row["expected_fee_per_case"] for row in insurer_metrics), default=1.0)
        or 1.0
    )
    max_cycle_days = (
        max(
            (row["average_cycle_days"] for row in tracker_family_metrics.values()),
            default=1.0,
        )
        or 1.0
    )

    peril_weights: dict[str, dict[str, Any]] = {}
    for row in peril_metrics:
        if row["sample_size"] < 3:
            continue
        expected_index = row["expected_fee_per_case"] / max_peril_expected
        workflow = tracker_family_metrics.get(row["claim_family"], {})
        workflow_bonus = 0.0
        if workflow:
            workflow_bonus = min(
                6.0,
                (workflow.get("backlog_rate", 0.0) * 4.0)
                + ((workflow.get("average_cycle_days", 0.0) / max_cycle_days) * 2.0),
            )
        modifier = (
            12.0 * expected_index
            + 8.0 * row["settled_like_rate"]
            - 10.0 * row["litigation_rate"]
            - 6.0 * row["no_pay_rate"]
            + workflow_bonus
        )
        peril_weights[row["peril"]] = {
            "claim_family": row["claim_family"],
            "sample_size": row["sample_size"],
            "settled_like_rate": row["settled_like_rate"],
            "litigation_rate": row["litigation_rate"],
            "no_pay_rate": row["no_pay_rate"],
            "expected_fee_per_case": row["expected_fee_per_case"],
            "workflow_priority_bonus": rounded(workflow_bonus, 2),
            "score_modifier": int(round(modifier)),
        }

    insurer_modifiers: dict[str, dict[str, Any]] = {}
    for row in insurer_metrics:
        if row["sample_size"] < 3:
            continue
        expected_index = row["expected_fee_per_case"] / max_insurer_expected
        modifier = (
            10.0 * expected_index
            + 6.0 * row["settled_like_rate"]
            - 12.0 * row["litigation_rate"]
            - 8.0 * row["no_pay_rate"]
        )
        rounded_modifier = int(round(modifier))
        if rounded_modifier >= 8:
            risk = "low"
            label = "Strong Payer"
        elif rounded_modifier >= 2:
            risk = "medium"
            label = "Balanced Outcomes"
        else:
            risk = "high"
            label = "High Friction"
        insurer_modifiers[row["insurer"]] = {
            "sample_size": row["sample_size"],
            "settled_like_rate": row["settled_like_rate"],
            "litigation_rate": row["litigation_rate"],
            "no_pay_rate": row["no_pay_rate"],
            "expected_fee_per_case": row["expected_fee_per_case"],
            "score_modifier": rounded_modifier,
            "risk": risk,
            "label": label,
        }

    return {
        "formula": {
            "peril_modifier": "12*expected_fee_index + 8*settled_rate - 10*litigation_rate - 6*no_pay_rate + workflow_bonus",
            "insurer_modifier": "10*expected_fee_index + 6*settled_rate - 12*litigation_rate - 8*no_pay_rate",
            "notes": [
                "expected_fee_index scales each peril or insurer against the highest extracted expected fee per case.",
                "workflow_bonus is capped at 6 points and comes from tracker backlog/cycle-time pressure by claim family.",
            ],
        },
        "peril_weights": peril_weights,
        "insurer_modifiers": insurer_modifiers,
    }


def conservative_name_overlap(
    claim_rows: list[dict[str, Any]], tracker_rows: list[dict[str, Any]]
) -> dict[str, int]:
    claim_names = {row["full_name"].lower() for row in claim_rows if row["full_name"]}
    tracker_names = {
        row["client_name_normalized"]
        for row in tracker_rows
        if row["client_name_normalized"]
    }
    overlap = claim_names & tracker_names
    return {
        "claims_unique_names": len(claim_names),
        "tracker_unique_names": len(tracker_names),
        "exact_name_overlap": len(overlap),
    }


def build_company_metrics(
    claims_pdf: str | Path,
    tracker_pdf: str | Path,
    graphs_pdf: str | Path | None = None,
) -> dict[str, Any]:
    claim_rows = parse_claims_pdf(claims_pdf)
    tracker_rows = parse_tracker_pdf(tracker_pdf)
    claims_metrics = build_claims_metrics(claim_rows)
    tracker_metrics = build_tracker_metrics(tracker_rows)
    scoring_model = build_scoring_model(claims_metrics, tracker_metrics)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_files": {
            "claims_pdf": Path(claims_pdf).name,
            "tracker_pdf": Path(tracker_pdf).name,
            "graphs_pdf": Path(graphs_pdf).name if graphs_pdf else None,
        },
        "claims_summary": claims_metrics,
        "workflow_summary": tracker_metrics,
        "join_summary": conservative_name_overlap(claim_rows, tracker_rows),
        "scoring_model": scoring_model,
        "validation_notes": [
            "Raw PDFs are not committed. This JSON contains aggregate, sanitized business metrics only.",
            "Data Analysis - Graphs.pdf is chart-only in this environment and is treated as a manual validation artifact.",
        ],
    }


def write_company_metrics(
    claims_pdf: str | Path,
    tracker_pdf: str | Path,
    graphs_pdf: str | Path | None = None,
    output_path: str | Path = DEFAULT_OUTPUT_PATH,
) -> dict[str, Any]:
    metrics = build_company_metrics(
        claims_pdf=claims_pdf, tracker_pdf=tracker_pdf, graphs_pdf=graphs_pdf
    )
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics
