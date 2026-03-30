---
name: react-frontend
description: Implements React dashboard features (filters, pagination, UX, mobile) with browser verification
---

# React Frontend Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Features involving React/TypeScript dashboard: new UI components, filters, pagination, sort controls, drawers, analytics charts, mobile responsive layouts, URL state management.

## Required Skills

- `agent-browser` — MUST be used for manual verification of all UI changes. Invoke after implementation to verify each user interaction.

## Work Procedure

1. **Read the feature description** thoroughly. Understand expected behavior and verification steps.

2. **Read existing code** in the files you'll modify. Understand current patterns:
   - Components are in `src/components/`, functional React with hooks
   - Styling: Tailwind CSS classes, `clsx()` and `tailwind-merge` for conditional classes
   - State: local `useState` hooks, no global state management
   - Types: defined in `src/types.ts`
   - Icons: `lucide-react`
   - Charts: `recharts`
   - Routing: `react-router-dom` v6
   - Path alias: `@` → `./src`
   - No test framework for frontend — verification is via TypeScript build + agent-browser

3. **Plan the implementation**:
   - Identify which files need changes (types, components, App.tsx)
   - Plan state management (new useState hooks, prop threading)
   - Consider filter composition (new filters must work with existing ones)
   - For pagination: must reset to page 1 when any filter changes

4. **Implement the feature**:
   - Follow existing Tailwind CSS patterns (spacing, colors, font sizes)
   - Use existing component patterns (FilterBar dropdowns, table columns, drawer sections)
   - Add types to `src/types.ts` if needed (extend FilterState, etc.)
   - Ensure all new UI elements have proper TypeScript types (no `any`)
   - For mobile: use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`)

5. **Run TypeScript build**:
   - `npm run build` — must succeed with zero errors
   - Fix any type errors before proceeding

6. **Start dev server and verify with agent-browser**:
   - Start: `npm run dev` (port 5173)
   - Use `agent-browser` to verify EVERY user interaction in the feature
   - For each interaction: navigate to the correct view, perform the action, verify the result
   - Check for console errors after each interaction
   - For mobile features: set viewport to 375×812 before testing
   - **CRITICAL**: Each verification must be a separate `interactiveChecks` entry with specific action and observed result

7. **Stop the dev server** after verification (kill the process by PID).

8. **Commit** with a descriptive message.

## Example Handoff

```json
{
  "salientSummary": "Added text search to FilterBar — filters leads by ownerName, propertyAddress, and folioNumber (case-insensitive partial match). Added search state to FilterState type, wired into App.tsx filtering logic. npm run build passes. Verified 5 search interactions via agent-browser: owner name search, address search, folio search, clear search restores all leads, special characters don't crash.",
  "whatWasImplemented": "Added SearchInput component to FilterBar with 'Search owner, address, folio...' placeholder. Extended FilterState in types.ts with `search: string`. Updated App.tsx filteredLeads computation to filter by search text across ownerName, propertyAddress, and folioNumber using case-insensitive includes(). Pagination resets to page 1 on search change.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {"command": "npm run build", "exitCode": 0, "observation": "TypeScript compilation and Vite build succeeded, dist/ generated"}
    ],
    "interactiveChecks": [
      {"action": "Typed 'gonza' in search input on Leads page", "observed": "Table filtered to 3 leads with owner names containing 'gonza' (case-insensitive). Stats row updated to show 3 leads."},
      {"action": "Typed 'nw 7th' in search input", "observed": "Table filtered to leads with addresses containing 'nw 7th'. All visible addresses confirmed matching."},
      {"action": "Typed '01-3' in search input", "observed": "Table filtered to leads with folio numbers containing '01-3'."},
      {"action": "Cleared search input (backspace to empty)", "observed": "All leads reappeared, count matched original total."},
      {"action": "Typed O'Brien in search input", "observed": "No JS errors in console. Results display normally (0 matches for this name, empty state shown)."}
    ]
  },
  "tests": {
    "added": []
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Feature requires backend data changes (new fields in leads.json schema)
- A required dependency is not installed (e.g., needs a new npm package)
- Feature conflicts with existing component architecture in ways that need design decisions
- Mobile layout changes break desktop layout in ways that need guidance
