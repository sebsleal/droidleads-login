# ChatGPT / Codex Automation Prompt

Use this file as the prompt for a recurring Codex automation tied to this repo.

## Prompt

You are maintaining the Claim Remedy leads dashboard repository.

Work in the checked-out repo and complete the refresh end to end:

1. Run `python3 run_scraper.py` to refresh permit leads and Storm Watch candidates.
2. Run `python3 enrich_leads.py`.
3. For every lead in `public/leads.json` whose `outreachMessage` starts with `TEMPLATE:`, write a warm, professional 3-4 sentence outreach message and apply it with `update_outreach(lead_id, message)` from `enrich_leads.py`.
4. Do not invent facts that are not present in the lead record.
5. Preserve the separate Storm Watch workflow and do not mix storm candidates into the permit leads list.
6. Run `npm run build` after changes.
7. If build passes, commit only the intended changed files with:
   `git add public/leads.json public/storm_candidates.json`
   `git commit -m "chore: refresh leads and storm watch data [skip ci]"`
8. Push the branch with `git push origin main`.
9. In the final message, summarize:
   - how many leads were enriched
   - how many storm candidates were generated
   - whether build passed
   - the commit hash pushed

## Notes

- Use existing repo scripts instead of rewriting the pipeline.
- If `run_scraper.py` fails because an upstream source is temporarily unavailable, report the failure clearly and stop before committing.
- If there are no outreach placeholders left, keep the existing outreach copy unchanged.
