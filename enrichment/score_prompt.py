"""
Compatibility exports for the production scoring helpers.

The canonical implementation now lives in `enrichment/company_scoring.py`.
Keep this module small so older imports continue to work without carrying the
legacy hand-tuned scoring logic.
"""

from enrichment.company_scoring import (
    _algorithmic_score,
    apply_company_signals,
    build_score_prompt,
    get_insurer_risk,
    score_leads_batch,
)

__all__ = [
    "_algorithmic_score",
    "apply_company_signals",
    "build_score_prompt",
    "get_insurer_risk",
    "score_leads_batch",
]
