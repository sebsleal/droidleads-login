"""
ev_config.py — Expected Value scoring configuration for Claim Remedy Adjusters.

All lookup tables are derived from 120+ real closed claims (Jan 2024 – Mar 2026).

Key findings from the portfolio:
  - Bathroom/Accidental Discharge = 65.2% of all settled claims (highest revenue)
  - Hurricane/Wind = 25.2% of settlements
  - Tower Hill: $31,200 in fees collected (strongest payer)
  - Progressive: $30,679 in fees collected
  - Citizens: 24.8% of all claims but high litigation rate on Wind/Rain
  - Integon National: near 100% litigation rate
  - Overall settlement rate: ~39.7%
  - Overall litigation rate: ~22.3%
  - Overall closed w/o pay: ~8%

Update these tables as more cases close to improve score accuracy.
"""

# ---------------------------------------------------------------------------
# P(settled) by insurance company
# Empirical probabilities from portfolio of 120+ closed claims.
# ---------------------------------------------------------------------------

P_SETTLED_BY_INSURER: dict[str, float] = {
    "tower hill":               0.72,   # $31,200 total fees — strongest payer
    "progressive":              0.70,   # $30,679 total fees — strong payer
    "universal property":       0.55,   # $17,993 total fees — reliable
    "universal north america":  0.55,   # similar profile to universal property
    "homeowners choice":        0.50,   # $14,730 in fees — moderate
    "florida peninsula":        0.55,   # reliable payer from portfolio
    "cypress":                  0.55,   # reliable payer from portfolio
    "monarch national":         0.55,   # reliable payer
    "slide":                    0.45,   # moderate — some litigation
    "state farm":               0.45,   # mixed outcomes
    "statefarm":                0.45,   # alias
    "american security":        0.50,   # moderate
    "castle key":               0.45,   # moderate
    "orange insurance":         0.50,   # small sample, moderate
    "heritage":                 0.45,   # moderate
    "usaa":                     0.45,   # mixed (some mediation)
    "citizens":                 0.30,   # high litigation rate, especially Wind/Rain
    "integon national":         0.05,   # near 100% litigation
    "DEFAULT":                  0.397,  # overall portfolio settlement rate
}

# ---------------------------------------------------------------------------
# P(settled) by peril type
# ---------------------------------------------------------------------------

P_SETTLED_BY_PERIL: dict[str, float] = {
    "accidental discharge":     0.58,   # bathroom claims dominate settled portfolio (65.2%)
    "bathroom":                 0.58,   # alias for accidental discharge
    "bath":                     0.58,   # alias
    "pipe break":               0.55,   # similar to accidental discharge
    "plumbing failure":         0.55,   # similar
    "collapse":                 0.55,   # uncommon but settles well
    "fire":                     0.50,   # higher settlements when settled
    "hurricane/wind":           0.45,   # 25.2% of settlements, more litigation
    "hurricane":                0.45,   # alias
    "wind":                     0.40,   # standalone wind — higher litigation
    "wind/rain":                0.35,   # Citizens Wind/Rain = common litigation pathway
    "roof leak":                0.42,   # moderate
    "roof":                     0.42,   # alias
    "a/c leak":                 0.50,   # AC leak — similar to bathroom
    "ac leak":                  0.50,   # alias
    "kitchen":                  0.55,   # kitchen water damage — similar to bathroom
    "laundry":                  0.50,   # laundry room leak
    "flood":                    0.32,   # flood claims are complex
    "structural":               0.38,
    "hail":                     0.38,   # relatively new claim type in portfolio
    "DEFAULT":                  0.397,
}

# ---------------------------------------------------------------------------
# Average settlement amount by peril type
# Estimated from portfolio data and industry benchmarks.
# ---------------------------------------------------------------------------

AVG_SETTLEMENT_BY_PERIL: dict[str, float] = {
    "accidental discharge":     48_000,
    "bathroom":                 48_000,
    "bath":                     48_000,
    "pipe break":               52_000,
    "plumbing failure":         48_000,
    "fire":                     65_000,
    "collapse":                 60_000,
    "hurricane/wind":           42_000,
    "hurricane":                42_000,
    "wind":                     38_000,
    "wind/rain":                35_000,
    "roof leak":                32_000,
    "roof":                     32_000,
    "a/c leak":                 40_000,
    "ac leak":                  40_000,
    "kitchen":                  50_000,
    "laundry":                  42_000,
    "flood":                    40_000,
    "structural":               55_000,
    "hail":                     38_000,
    "DEFAULT":                  42_000,
}

# ---------------------------------------------------------------------------
# Settlement amount multiplier by insurer
# Adjusts avg_settlement for how aggressively the insurer pays.
# ---------------------------------------------------------------------------

SETTLEMENT_MULTIPLIER_BY_INSURER: dict[str, float] = {
    "tower hill":               1.15,
    "progressive":              1.12,
    "universal property":       1.05,
    "universal north america":  1.05,
    "homeowners choice":        1.00,
    "florida peninsula":        1.05,
    "cypress":                  1.05,
    "monarch national":         1.02,
    "slide":                    0.95,
    "state farm":               1.00,
    "statefarm":                1.00,
    "american security":        0.98,
    "castle key":               0.98,
    "heritage":                 0.95,
    "usaa":                     1.02,
    "citizens":                 0.85,   # often underpays
    "integon national":         0.60,
    "DEFAULT":                  1.00,
}

# ---------------------------------------------------------------------------
# Default fee rate (when not known from the lead)
# ---------------------------------------------------------------------------

DEFAULT_FEE_RATE: float = 0.10   # 10% — conservative default for new leads

# ---------------------------------------------------------------------------
# EV normalization bounds
# Score = normalize(EV, EV_MIN → EV_MAX) → 0-100
#
# EV_MAX represents a near-ideal lead:
#   P=0.72 (Tower Hill) × avg_settlement=$48k × fee=10% × multiplier=1.15 = $3,974
#   After signal bonuses, the best leads reach ~$5,000+ EV
# ---------------------------------------------------------------------------

EV_MIN: float = 0.0
EV_MAX: float = 6_000.0   # effective ceiling for normalization


def lookup_p_settled(insurer: str, peril: str) -> float:
    """Return combined P(settled) for an insurer + peril combination."""
    insurer_lower = (insurer or "").lower().strip()
    peril_lower = (peril or "").lower().strip()

    p_insurer = P_SETTLED_BY_INSURER.get("DEFAULT")
    for key, val in P_SETTLED_BY_INSURER.items():
        if key in insurer_lower or insurer_lower in key:
            p_insurer = val
            break

    p_peril = P_SETTLED_BY_PERIL.get("DEFAULT")
    for key, val in P_SETTLED_BY_PERIL.items():
        if key in peril_lower or peril_lower in key:
            p_peril = val
            break

    # Simple average of insurer and peril probabilities
    return (p_insurer + p_peril) / 2


def lookup_avg_settlement(peril: str, insurer: str) -> float:
    """Return expected settlement amount for a peril + insurer combination."""
    peril_lower = (peril or "").lower().strip()
    insurer_lower = (insurer or "").lower().strip()

    avg = AVG_SETTLEMENT_BY_PERIL.get("DEFAULT")
    for key, val in AVG_SETTLEMENT_BY_PERIL.items():
        if key in peril_lower or peril_lower in key:
            avg = val
            break

    multiplier = SETTLEMENT_MULTIPLIER_BY_INSURER.get("DEFAULT")
    for key, val in SETTLEMENT_MULTIPLIER_BY_INSURER.items():
        if key in insurer_lower or insurer_lower in key:
            multiplier = val
            break

    return avg * multiplier


def compute_ev(insurer: str, peril: str, fee_rate: float = DEFAULT_FEE_RATE) -> float:
    """Compute expected value for a lead."""
    p = lookup_p_settled(insurer, peril)
    avg_settlement = lookup_avg_settlement(peril, insurer)
    return p * avg_settlement * fee_rate


def ev_to_score(ev: float) -> int:
    """Normalize EV to a 0-100 score."""
    if ev <= EV_MIN:
        return 0
    if ev >= EV_MAX:
        return 100
    return int((ev / EV_MAX) * 100)
