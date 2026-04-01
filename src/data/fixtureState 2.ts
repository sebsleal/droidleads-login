/**
 * Shared fixture state — module-level registry for validation fixture cases.
 *
 * Uses a setter registry pattern so that FixtureConversionPage can create
 * cases that immediately appear in the main App's Cases view without
 * touching real Supabase data.
 *
 * Problem being solved: the App (/cases route) and FixtureConversionPage
 * are rendered by different React trees, so module-level state isn't
 * automatically shared as React state. We work around this by having
 * each useCases hook register its React state setter here; when a fixture
 * case is created, we call all registered setters to trigger re-renders.
 */
import type { Case } from "@/types";
import type React from "react";

// Module-level fixture case storage
const _fixtureCases: Case[] = [];

// Registry of React state setters from all active useCases hooks
type CaseStateSetter = React.Dispatch<React.SetStateAction<Case[]>>;
const _registeredSetters = new Set<CaseStateSetter>();

/** Register a useCases hook's React state setter */
export function registerCaseStateSetter(setter: CaseStateSetter): () => void {
  _registeredSetters.add(setter);
  return () => _registeredSetters.delete(setter);
}

export function getFixtureCases(): Case[] {
  return [..._fixtureCases];
}

export function addFixtureCase(kase: Case): void {
  _fixtureCases.push(kase);
  // Notify all registered useCases hook instances to re-render
  _registeredSetters.forEach((setter) => {
    setter((prev) => {
      // Avoid duplicates
      if (prev.some((c) => c.id === kase.id)) return prev;
      return [kase, ...prev];
    });
  });
}

export function clearFixtureCases(): void {
  _fixtureCases.length = 0;
}
