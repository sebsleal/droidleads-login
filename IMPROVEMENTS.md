# Claim Remedy Adjusters — Lead Intelligence Improvements

## Contact Enrichment

### Free Sources

| Source | Method | Expected Hit Rate |
|--------|--------|-------------------|
| FL Voter Roll | Bulk CSV (public records request) | 65–75% of homeowners |
| Sunbiz | Web scrape registered agent for LLC/corporate owners | ~80% of FL entities |
| Contractor referral reframe | Reframe permit contractor contact as warm referral | — |
| Mailing address outreach | Use owner mailing address (from PA enrichment) for absentee owners | — |

**FL Voter Roll (`scrapers/voter_lookup.py`):**
- Submit a public records request to Florida Division of Elections or Miami-Dade SOE
- Place the CSV at `data/voter_rolls.csv` — enrichment activates automatically
- Matches on last name + street number; only fills leads with no existing contact info

**Sunbiz (`scrapers/sunbiz.py`):**
- Triggered for owners containing LLC, INC, CORP, LTD, TRUST, etc.
- Scrapes registered agent name and phone from Florida Division of Corporations
- Conservative rate limiting (2s between requests)

---

## Conversion Tracking

### New DB Fields

| Column | Type | Purpose |
|--------|------|---------|
| `contacted_at` | timestamptz | When first outreach was made |
| `converted_at` | timestamptz | When lead became a client |
| `claim_value` | numeric | Final settlement amount |
| `contact_method` | text | How contact was made (email/phone/mail) |
| `notes` | text | Free-form adjuster notes |

### Enhanced Status Flow

```
New → Contacted → Converted (won)
                → Closed (lost/unresponsive)
```

### Funnel Analytics

- Conversion rate by damage type
- Conversion rate by score tier (high/medium/low)
- Average claim value by ZIP code
- Time-to-contact distribution
- Source attribution (permit vs. storm vs. voter vs. Sunbiz)

---

## Quick Wins

### Combined Claude Calls
- **Before:** 2 Claude API calls per lead (score + outreach), 2s delay each → ~4s/lead
- **After:** 1 combined call returning `{score, reasoning, outreach_message}` → ~2s/lead
- 50% reduction in Claude API cost and pipeline time
- Implemented in `enrichment/score_prompt.py` → `score_and_generate_outreach()`

### Scoring Improvements
- Added enrichment context to scoring prompt: assessed value, homestead status, absentee owner, roof age, prior permits, permit status, permit value, underpaid flag, contractor name
- High-value ZIP codes now enumerated explicitly (Coral Gables 33134, Coconut Grove 33133, Brickell 33131, Key Biscayne 33149, Pinecrest 33156)
- New scoring signals: Owner-Builder permit (+20), stalled permit (+15), underpayment flag (+15), absentee owner (+10), aging roof (+10), repeat damage (+15)

### Bug Fixes
- **Analytics NaN bug:** `Avg Score` stat divided by `leads.length` without zero guard — fixed with `leads.length > 0 ? ... : 0`
- **Hardcoded storm years:** `years=[2024, 2025]` → dynamic `[current_year - 1, current_year]`
- **100-lead PA cap removed:** PA enrichment now always runs on top 100 leads regardless of batch size

### Frequency
- Railway cron changed from `0 6 * * *` (once daily) to `0 */6 * * *` (every 6 hours)

---

## Algorithm Overhaul (Phase D — after conversion data accumulates)

### Weighted Scoring
Once 50+ converted leads are recorded, replace fixed point weights with regression-derived weights based on actual conversion outcomes.

### Claim Size Estimation
- Use permit value vs. ZIP median to estimate likely claim size
- Assessed value tiers: <$300K / $300K–$600K / $600K–$1M / $1M+
- Weight score by estimated claim size (bigger claims = higher adjuster fee)

### ZIP Value Tiers
Pre-compute median assessed value per ZIP for Miami-Dade, Broward, Palm Beach:

| Tier | ZIPs | Multiplier |
|------|------|-----------|
| Premium | 33134, 33133, 33131, 33149, 33156 | 1.3x |
| High | 33139, 33140, 33141, 33154 | 1.15x |
| Standard | All others | 1.0x |

### Urgency Score
Separate from quality score — measures time sensitivity:
- `days_since_permit` → linear decay
- `days_until_statute` → FL 3-year statute of limitations
- `storm_season_proximity` → boost June–November

---

## New Data Sources

### Broward & Palm Beach Counties
- Broward permits: `https://www.broward.org/BBCS/Pages/PermitSearch.aspx` (or ArcGIS equivalent)
- Palm Beach permits: similar open data portal
- Same normalization pipeline as Miami-Dade

### FEMA Declarations
- FEMA disaster declaration API: `https://www.fema.gov/api/open/v2/disasterDeclarationsSummaries`
- Filter for FL declarations; cross-reference with permit ZIP codes
- Add `fema_declaration_id` field to leads for strong insurance eligibility signal

### Code Violations
- Miami-Dade Code Compliance: open data portal
- Properties with open code violations on storm damage = high urgency (owner under pressure)
- Join on folio number

---

## Architecture

### Live Supabase Queries
- Dashboard queries Supabase directly (no static JSON)
- Real-time updates when scraper upserts new leads
- Row-level filtering for adjuster assignments (multi-user support)

### Enrichment Queue
- Replace sequential enrichment with a Supabase queue table
- Parallel workers process leads concurrently (bounded concurrency)
- Retry logic for failed Claude calls with exponential backoff

### Monitoring
- Pipeline run logs stored in `scraper_runs` table (start time, counts, errors)
- Alert on Slack/email if scraper returns 0 leads or >20% error rate
- Track Claude API cost per run via token counts
