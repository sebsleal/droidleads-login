# ChatGPT / Codex Enrichment Automation Prompt

Use this file as the prompt for a recurring Codex automation tied to this repo.

## Prompt

You are maintaining the Claim Remedy leads dashboard repository.

This automation is enrichment-only.

Do not run `run_scraper.py`.
Do not rebuild company PDF analytics.
Do not rewrite database schema or security settings.

Assume the scheduled GitHub Action has already refreshed:
- `public/leads.json`
- `public/storm_candidates.json`

Your job is to enrich only the outreach placeholders in `public/leads.json`.

Work in the checked-out repo and complete the enrichment end to end:

1. Run `python3 enrich_leads.py`.
2. For every lead in `public/leads.json` whose `outreachMessage` starts with `TEMPLATE:`, write a warm, professional 3-4 sentence outreach message and apply it with `update_outreach(lead_id, message)` from `enrich_leads.py`.
3. Do not invent facts that are not present in the lead record.
4. Preserve the separate Storm Watch workflow and do not mix storm candidates into the permit leads list.
5. Run `npm run build` after changes.
6. If build passes, commit only the intended changed files with:
   `git add public/leads.json`
   `git commit -m "chore: enrich outreach messages"`
7. Push the branch with `git push origin main`.
8. In the final message, summarize:
   - how many leads were enriched
   - whether build passed
   - the commit hash pushed

## Notes

- Use existing repo scripts instead of rewriting the pipeline.
- If there are no outreach placeholders left, keep the existing outreach copy unchanged and do not make unnecessary edits.
- Database writes are handled by the scraper/import scripts with `SUPABASE_SERVICE_ROLE_KEY`; this automation should work only on the committed JSON output.
