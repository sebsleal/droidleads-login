export type DamageType =
  | 'Hurricane/Wind'
  | 'Flood'
  | 'Roof'
  | 'Fire'
  | 'Structural';

export type LeadStatus = 'New' | 'Contacted' | 'Converted' | 'Closed';
export type CountySlug = 'miami-dade' | 'broward' | 'palm-beach';
export type StormCandidateType = 'area' | 'property';
export type StormWatchStatus =
  | 'Watching'
  | 'Researching'
  | 'Outreach Ready'
  | 'Contacted'
  | 'Permit Filed'
  | 'Closed';

export type ScoreTier = 'high' | 'medium' | 'low';

export const COUNTY_LABELS: Record<CountySlug, string> = {
  'miami-dade': 'Miami-Dade',
  broward: 'Broward',
  'palm-beach': 'Palm Beach',
};

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
  scoreReasoning?: string;
  source?: string;
  contactedAt?: string;
  convertedAt?: string;
  claimValue?: number;
  contactMethod?: string;
  notes?: string;
  // PA-enriched fields (present after property appraiser lookup)
  homestead?: boolean;
  ownerMailingAddress?: string;
  assessedValue?: number;
  // Permit intelligence
  permitStatus?: 'No Contractor' | 'Owner-Builder' | 'Stalled' | 'Active';
  contractorName?: string;
  permitValue?: number;
  underpaidFlag?: boolean;
  // Property intelligence
  absenteeOwner?: boolean;
  priorPermitCount?: number;
  roofAge?: number;
  codeViolation?: boolean;
  // Multi-county + FEMA fields
  county?: CountySlug;
  femaDeclarationNumber?: string;     // e.g. 'DR-4611'
  femaIncidentType?: string;          // e.g. 'Hurricane' | 'Flood'
}

export interface FilterState {
  zip: string;
  damageType: DamageType | 'All';
  scoreTier: 'All' | 'High' | 'Medium' | 'Low';
  dateRange: '7' | '30' | '90' | 'all';
  hasContact: boolean;
  absenteeOwner: boolean;
  underpaid: boolean;
  noContractor: boolean;
  stormFirst: boolean;
  county: 'All' | CountySlug;
}

export interface StatsData {
  totalLeads: number;
  highPriority: number;
  absenteeOwners: number;
  underpaidFlags: number;
}

export interface StormCandidate {
  id: string;
  candidateType: StormCandidateType;
  county: CountySlug;
  city: string;
  zip: string;
  locationLabel: string;
  stormEvent: string;
  eventType: string;
  eventDate: string;
  femaDeclarationNumber?: string;
  femaIncidentType?: string;
  narrative: string;
  score: number;
  scoreReasoning: string;
  status: StormWatchStatus;
  notes: string;
  source: string;
  contactedAt?: string;
  permitFiledAt?: string;
  closedAt?: string;
}

export interface StormFilterState {
  county: 'All' | CountySlug;
  eventType: 'All' | string;
  femaTagged: 'All' | 'Tagged' | 'Untagged';
  scoreTier: 'All' | 'High' | 'Medium' | 'Low';
  dateRange: '30' | '90' | '365' | 'all';
  candidateType: 'All' | StormCandidateType;
}

export interface StormStatsData {
  totalCandidates: number;
  highPriority: number;
  femaTagged: number;
  areaCandidates: number;
}
