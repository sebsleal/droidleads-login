export type DamageType =
  | 'Hurricane/Wind'
  | 'Flood'
  | 'Roof'
  | 'Fire'
  | 'Structural';

export type LeadStatus = 'New' | 'Contacted' | 'Closed';

export type ScoreTier = 'high' | 'medium' | 'low';

export interface ContactInfo {
  email?: string;
  phone?: string;
}

export interface Lead {
  id: string;
  ownerName: string;
  propertyAddress: string;
  city: string;
  zip: string;
  folioNumber: string;
  damageType: DamageType;
  score: number;
  date: string; // ISO date string
  contact?: ContactInfo;
  status: LeadStatus;
  permitType: string;
  permitDate: string; // ISO date string
  stormEvent: string;
  outreachMessage: string;
  // PA-enriched fields (present after property appraiser lookup)
  homestead?: boolean;
  ownerMailingAddress?: string;
  assessedValue?: number;
}

export interface FilterState {
  zip: string;
  damageType: DamageType | 'All';
  scoreTier: 'All' | 'High' | 'Medium' | 'Low';
  dateRange: '7' | '30' | '90' | 'all';
  hasContact: boolean;
}

export interface StatsData {
  totalLeads: number;
  highPriority: number;
  avgScore: number;
  leadsWithContact: number;
}
