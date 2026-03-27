# Improvement Notes

This file used to contain pre-implementation ideas from the older split pipeline. The current system state is documented in [`README.md`](/Users/seb/Documents/claim-remedy-leads-testing/README.md).

Current implemented improvements:

- One canonical lead pipeline shared by the scraper, Supabase upsert path, and `public/leads.json`
- Inline lead tracking on `leads` instead of a missing `lead_tracking` table
- Read-only browser RLS for `leads`, `cases`, and `storm_tracking`
- Data-derived peril, insurer, and workflow analytics from sanitized company PDF outputs
- Regression tests for canonicalization, pre-permit handling, placeholder stamping, and month ordering
