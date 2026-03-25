import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ScoreTier, DamageType } from '@/types';

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
  }
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

export function downloadCSV(leads: import('@/types').Lead[]) {
  const headers = [
    'ID',
    'Owner Name',
    'Property Address',
    'City',
    'ZIP',
    'Folio Number',
    'Damage Type',
    'Score',
    'Date',
    'Email',
    'Phone',
    'Status',
    'Permit Type',
    'Permit Date',
    'Storm Event',
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
    l.date,
    l.contact?.email ?? '',
    l.contact?.phone ?? '',
    l.status,
    l.permitType,
    l.permitDate,
    l.stormEvent,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cra-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
