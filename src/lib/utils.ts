import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ScoreTier, DamageType, Lead, StormCandidate } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getScoreTier(score: number): ScoreTier {
  if (score >= 85) return 'high';
  if (score >= 70) return 'medium';
  return 'low';
}

export function scoreTierColors(tier: ScoreTier) {
  switch (tier) {
    case 'high':
      return {
        bg: 'bg-green-100',
        text: 'text-green-800',
        border: 'border-green-200',
        dot: 'bg-green-500',
        hex: '#16a34a',
      };
    case 'medium':
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-800',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
        hex: '#d97706',
      };
    case 'low':
      return {
        bg: 'bg-red-100',
        text: 'text-red-800',
        border: 'border-red-200',
        dot: 'bg-red-500',
        hex: '#dc2626',
      };
  }
}

export function damageTypeColor(type: DamageType): string {
  switch (type) {
    case 'Hurricane/Wind':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Flood':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'Roof':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Fire':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'Structural':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'Accidental Discharge':
      return 'bg-teal-100 text-teal-800 border-teal-200';
  }
}

const PA_PLACEHOLDER_NAMES = new Set([
  'reference only',
  'see name',
  'no name',
  'unknown',
  'unavailable',
]);

/** Returns the owner name, or a clean fallback if the PA returned a placeholder. */
export function displayOwnerName(name: string | null | undefined): string {
  if (!name || PA_PLACEHOLDER_NAMES.has(name.trim().toLowerCase())) {
    return 'Owner Unknown';
  }
  return name;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function isWithinDays(isoDate: string, days: number): boolean {
  const date = new Date(isoDate);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

type LeadWithScoreReasoning = Lead & { score_reasoning?: string };

function downloadRowsAsCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>, filenamePrefix: string) {
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCSV(leads: Lead[]) {
  const headers = [
    'ID',
    'Owner Name',
    'Property Address',
    'City',
    'ZIP',
    'Folio Number',
    'Damage Type',
    'Score',
    'Score Reasoning',
    'Date',
    'Email',
    'Phone',
    'Status',
    'Contacted At',
    'Converted At',
    'Claim Value',
    'Contact Method',
    'Notes',
    'Permit Type',
    'Permit Date',
    'Storm Event',
    'Source',
    'Assessed Value',
    'Homestead',
    'Owner Mailing Address',
    'Absentee Owner',
    'Underpaid Flag',
    'Permit Status',
    'Contractor Name',
    'Permit Value',
    'Building Age',
    'Prior Permit Count',
  ];

  const rows = leads.map((l) => [
    l.id,
    l.ownerName,
    l.propertyAddress,
    l.city,
    l.zip,
    l.folioNumber,
    l.damageType,
    l.score,
    l.scoreReasoning ?? (l as LeadWithScoreReasoning).score_reasoning ?? '',
    l.date,
    l.contact?.email ?? '',
    l.contact?.phone ?? '',
    l.status,
    l.contactedAt ?? '',
    l.convertedAt ?? '',
    l.claimValue ?? '',
    l.contactMethod ?? '',
    l.notes ?? '',
    l.permitType,
    l.permitDate,
    l.stormEvent,
    l.source ?? '',
    l.assessedValue ?? '',
    l.homestead != null ? (l.homestead ? 'Yes' : 'No') : '',
    l.ownerMailingAddress ?? '',
    l.absenteeOwner != null ? (l.absenteeOwner ? 'Yes' : 'No') : '',
    l.underpaidFlag ? 'Yes' : '',
    l.permitStatus ?? '',
    l.contractorName ?? '',
    l.permitValue ?? '',
    l.roofAge ?? '',
    l.priorPermitCount ?? '',
  ]);

  downloadRowsAsCsv(headers, rows, 'cra-leads');
}

export function downloadStormCandidatesCSV(candidates: StormCandidate[]) {
  const headers = [
    'ID',
    'Candidate Type',
    'County',
    'City',
    'ZIP',
    'Location Label',
    'Storm Event',
    'Event Type',
    'Event Date',
    'FEMA Declaration Number',
    'FEMA Incident Type',
    'Narrative',
    'Score',
    'Score Reasoning',
    'Status',
    'Notes',
    'Contacted At',
    'Permit Filed At',
    'Closed At',
    'Source',
  ];

  const rows = candidates.map((candidate) => [
    candidate.id,
    candidate.candidateType,
    candidate.county,
    candidate.city,
    candidate.zip,
    candidate.locationLabel,
    candidate.stormEvent,
    candidate.eventType,
    candidate.eventDate,
    candidate.femaDeclarationNumber ?? '',
    candidate.femaIncidentType ?? '',
    candidate.narrative,
    candidate.score,
    candidate.scoreReasoning,
    candidate.status,
    candidate.notes,
    candidate.contactedAt ?? '',
    candidate.permitFiledAt ?? '',
    candidate.closedAt ?? '',
    candidate.source,
  ]);

  downloadRowsAsCsv(headers, rows, 'cra-storm-watch');
}
