import { describe, expect, it } from 'vitest';
import type { Lead, LLCOfficer } from '@/types';
import { classifyOwnerType, isBusinessEntityLead, isNaturalPersonLead } from '@/lib/utils';

function lead(overrides: Partial<Pick<Lead, 'ownerName' | 'registeredAgentName' | 'llcOfficers'>> = {}) {
  return {
    ownerName: 'Pedro Sanchez',
    registeredAgentName: undefined,
    llcOfficers: undefined,
    ...overrides,
  } satisfies Pick<Lead, 'ownerName' | 'registeredAgentName' | 'llcOfficers'>;
}

describe('classifyOwnerType', () => {
  it('treats natural-person owners as people', () => {
    expect(classifyOwnerType(lead({ ownerName: 'Aime Zarate Oliva' }))).toBe('Person');
  });

  it('treats LLC and corporate owners as businesses', () => {
    expect(classifyOwnerType(lead({ ownerName: 'Labrada Investments Llc' }))).toBe('Business');
    expect(classifyOwnerType(lead({ ownerName: 'Miami Edge Investments Inc' }))).toBe('Business');
  });

  it('treats government and institutional owners as businesses for filtering', () => {
    expect(classifyOwnerType(lead({ ownerName: 'Miami-Dade County' }))).toBe('Business');
    expect(classifyOwnerType(lead({ ownerName: 'Villa Rustica Condo' }))).toBe('Business');
  });

  it('treats Sunbiz-enriched leads as businesses even if the name looks human', () => {
    const officers: LLCOfficer[] = [{ name: 'Jane Doe', title: 'Manager' }];
    expect(classifyOwnerType(lead({ ownerName: 'Jane Doe', registeredAgentName: 'John Agent' }))).toBe('Business');
    expect(classifyOwnerType(lead({ ownerName: 'John Smith', llcOfficers: officers }))).toBe('Business');
  });

  it('treats placeholder and missing owner names as unknown', () => {
    expect(classifyOwnerType(lead({ ownerName: 'Property Owner' }))).toBe('Unknown');
    expect(classifyOwnerType(lead({ ownerName: 'Ref Only/Luis Martinez' }))).toBe('Unknown');
    expect(classifyOwnerType(lead({ ownerName: '' }))).toBe('Unknown');
  });
});

describe('owner type helpers', () => {
  it('returns false for people and true for non-person owners', () => {
    expect(isBusinessEntityLead(lead({ ownerName: 'Pedro Sanchez' }))).toBe(false);
    expect(isBusinessEntityLead(lead({ ownerName: 'The Garcia Family Trust' }))).toBe(true);
  });

  it('only treats actual people as natural-person leads', () => {
    expect(isNaturalPersonLead(lead({ ownerName: 'Pedro Sanchez' }))).toBe(true);
    expect(isNaturalPersonLead(lead({ ownerName: 'Property Owner' }))).toBe(false);
    expect(isNaturalPersonLead(lead({ ownerName: 'Labrada Investments Llc' }))).toBe(false);
  });
});
