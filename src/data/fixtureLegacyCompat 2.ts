/**
 * Legacy lead fixtures — leads that predate the scoreBreakdown/EV feature.
 * Used for VAL-CROSS-006 backward-compat verification via agent-browser.
 *
 * These leads have no scoreBreakdown field and no EV factor,
 * simulating leads from before the scoring upgrade was deployed.
 */
import type { Lead } from '@/types'

export const legacyLeadsWithoutBreakdown: Lead[] = [
  {
    id: 'legacy-001',
    ownerName: 'Rosa Hernandez',
    propertyAddress: '9201 SW 142nd Ave',
    city: 'Miami',
    zip: '33186',
    folioNumber: '01-4001-030-2200',
    damageType: 'Hurricane/Wind',
    score: 72,
    date: '2026-02-01',
    contact: {
      email: 'r.hernandez@email.com',
      phone: '(305) 882-1100',
    },
    status: 'New',
    permitType: 'Roof Replacement',
    permitDate: '2026-01-28',
    stormEvent: 'Hurricane Helene (Sept 2025)',
    outreachMessage:
      'Dear Ms. Hernandez, our records indicate your property at 9201 SW 142nd Ave sustained damage during Hurricane Helene.',
    source: 'permit',
    sourceDetail: 'permit',
    county: 'miami-dade',
    // No scoreBreakdown — legacy lead predating the EV/scoring upgrade
    // No homestead, assessedValue, etc.
  },
  {
    id: 'legacy-002',
    ownerName: 'Thompson Family Trust',
    propertyAddress: '3310 N Ocean Dr',
    city: 'Fort Lauderdale',
    zip: '33308',
    folioNumber: '02-4127-001-0030',
    damageType: 'Flood',
    score: 58,
    date: '2026-01-15',
    // No contact info at all
    status: 'Contacted',
    permitType: 'Water Damage Restoration',
    permitDate: '2026-01-10',
    stormEvent: 'Tropical Storm Sara (Nov 2025)',
    outreachMessage:
      'Dear Thompson Family Trust, we noticed a water damage restoration permit was filed for your Fort Lauderdale property.',
    source: 'permit',
    sourceDetail: 'permit',
    county: 'broward',
    // No scoreBreakdown
    // No contact fields
  },
  {
    id: 'legacy-003',
    ownerName: 'Marcus Webb',
    propertyAddress: '447 Pine St',
    city: 'West Palm Beach',
    zip: '33401',
    folioNumber: '03-2143-008-1100',
    damageType: 'Roof',
    score: 85,
    date: '2026-03-05',
    contact: {
      email: 'marcus.webb@webmail.com',
    },
    // phone-only email, no phone
    status: 'New',
    permitType: 'Roof Replacement',
    permitDate: '2026-03-01',
    stormEvent: '',
    outreachMessage:
      'Dear Mr. Webb, our records show a roof replacement permit was recently filed for your West Palm Beach property.',
    source: 'permit',
    sourceDetail: 'permit',
    county: 'palm-beach',
    femaDeclarationNumber: 'DR-4896',
    femaIncidentType: 'Hurricane',
    insuranceCompany: 'Citizens Property Insurance',
    insurerRisk: 'high',
    // No scoreBreakdown
    homestead: true,
    assessedValue: 385000,
  },
  {
    id: 'legacy-004',
    ownerName: 'Ocean View Condo Assoc',
    propertyAddress: '1000 S Ocean Blvd, Unit 501',
    city: 'Boca Raton',
    zip: '33432',
    folioNumber: '04-1247-010-0501',
    damageType: 'Structural',
    score: 91,
    date: '2026-03-10',
    contact: {
      phone: '(561) 338-7700',
    },
    status: 'Converted',
    permitType: 'Structural Repair',
    permitDate: '2026-03-08',
    stormEvent: 'Hurricane Helene (Sept 2025)',
    outreachMessage:
      'Dear Ocean View Condo Assoc, structural damage claims for HOA properties often involve complex multiple-unit coverage issues.',
    source: 'storm',
    sourceDetail: 'storm_event',
    county: 'palm-beach',
    // No scoreBreakdown
    permitStatus: 'Owner-Builder',
    underpaidFlag: true,
    priorPermitCount: 3,
  },
  {
    id: 'legacy-005',
    ownerName: 'Patel Properties LLC',
    propertyAddress: '2100 NW 27th Ave',
    city: 'Miami',
    zip: '33142',
    folioNumber: '01-3128-015-0000',
    damageType: 'Fire',
    score: 45,
    date: '2025-12-20',
    // No contact
    status: 'Closed',
    permitType: 'Fire Damage Repair',
    permitDate: '2025-12-15',
    stormEvent: '',
    outreachMessage:
      'Dear Patel Properties LLC, our records indicate a fire damage repair permit was recently filed for your Miami property.',
    source: 'permit',
    sourceDetail: 'permit',
    county: 'miami-dade',
    // No scoreBreakdown
    // Business entity - no personal contact
  },
]

/** Lead with scoreBreakdown but WITHOUT the EV factor — tests partial legacy */
export const legacyLeadWithBreakdownNoEV: Lead = {
  id: 'legacy-no-ev-001',
  ownerName: 'Sandra Diaz',
  propertyAddress: '6880 SW 40th St',
  city: 'Miami',
  zip: '33155',
  folioNumber: '01-4019-008-2200',
  damageType: 'Hurricane/Wind',
  score: 68,
  date: '2026-02-20',
  contact: {
    email: 's.diaz@outlook.com',
    phone: '(305) 554-2211',
  },
  status: 'Contacted',
  permitType: 'Roof Replacement',
  permitDate: '2026-02-15',
  stormEvent: 'Hurricane Helene (Sept 2025)',
  outreachMessage:
    'Dear Ms. Diaz, our records indicate your property at 6880 SW 40th St sustained hurricane damage.',
  source: 'permit',
  sourceDetail: 'permit',
  county: 'miami-dade',
  // scoreBreakdown WITHOUT EV factor
  scoreBreakdown: {
    base: 30,
    factors: [
      {
        label: 'Hurricane/Wind damage type',
        delta: 10,
        note: 'High-severity peril based on historical claims',
      },
      {
        label: 'Contact info available',
        delta: 12,
        note: 'Owner can be reached directly',
      },
      {
        label: 'Recent permit (within 30 days)',
        delta: 16,
        note: 'Fresh damage — high urgency',
      },
    ],
    total: 68,
  },
}
