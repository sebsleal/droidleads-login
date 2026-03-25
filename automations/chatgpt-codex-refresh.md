# ChatGPT / Codex Automation Prompt

Use this file as the prompt for a recurring Codex automation tied to this repo.

## Prompt

You are maintaining the Claim Remedy leads dashboard repository.

Work in the checked-out repo and complete the refresh end to end:

1. Run `python3 run_scraper.py` to refresh permit leads and Storm Watch candidates.
2. If `python3 run_scraper.py` fails because of an upstream network, DNS, timeout, or temporary source-availability issue, retry up to 3 total attempts with backoff delays of about 30 seconds, then 90 seconds.
3. Only treat the scraper step as failed after all retry attempts are exhausted.
4. Run `python3 enrich_leads.py`.
5. For every lead in `public/leads.json` whose `outreachMessage` starts with `TEMPLATE:`, write a warm, professional 3-4 sentence outreach message and apply it with `update_outreach(lead_id, message)` from `enrich_leads.py`.
6. Do not invent facts that are not present in the lead record.
7. Preserve the separate Storm Watch workflow and do not mix storm candidates into the permit leads list.
8. Run `npm run build` after changes.
9. If build passes, commit only the intended changed files with:
   `git add public/leads.json public/storm_candidates.json`
   `git commit -m "chore: refresh leads and storm watch data [skip ci]"`
10. Push the branch with `git push origin main`.
11. In the final message, summarize:
   - how many leads were enriched
   - how many storm candidates were generated
   - whether build passed
   - the commit hash pushed

## Notes

- Use existing repo scripts instead of rewriting the pipeline.
- If `run_scraper.py` still fails after all retries, report the final error clearly and stop before committing.
- If a retry succeeds, continue normally and mention that retries were needed.
- If there are no outreach placeholders left, keep the existing outreach copy unchanged.
