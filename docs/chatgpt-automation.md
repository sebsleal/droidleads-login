# ChatGPT Automation

This repo is set up for a Codex automation connected to your ChatGPT account.

Plain ChatGPT Tasks are not the right surface for this workflow because they are scheduled prompts, not repo-aware coding agents. Use a Codex automation instead.

Official references:

- ChatGPT scheduled tasks: <https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt>
- Codex with ChatGPT plans: <https://help.openai.com/en/articles/11369540>

## What To Use

- Use the prompt in [automations/chatgpt-codex-refresh.md](/Users/seb/Documents/claim-remedy-leads-testing/automations/chatgpt-codex-refresh.md).
- Point the automation at this repository.
- Schedule it on the cadence you want, for example every 6 hours after the scraper window.

## What The Automation Does

- Runs `python3 enrich_leads.py`
- Replaces `TEMPLATE:` outreach placeholders in `public/leads.json`
- Runs `npm run build`
- Commits and pushes the enriched lead copy

## Recommended Safeguards

- Run it on `main` only if you are comfortable with direct data commits.
- If you want a review step, change the prompt so it pushes to a separate branch instead of `main`.
- Keep `[skip ci]` in the commit message if you do not want deploy loops from data-only refreshes.
- Use GitHub Actions or another server-side job for `run_scraper.py`.
- Use `SUPABASE_SERVICE_ROLE_KEY` for scraper/import automation only. Do not point the browser or enrichment automation at the service-role key.
