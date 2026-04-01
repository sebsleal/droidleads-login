/**
 * Cross-area validation fixture data — enriched leads with EV factor, homestead signal,
 * and enriched outreach visible in the drawer.
 *
 * Used for VAL-CROSS-002 (enriched lead drawer), VAL-CROSS-003 (composed insurer filter),
 * and VAL-CROSS-004 (mobile filter functionality).
 *
 * These leads are static fixture data — isolated from production data files.
 */
import type { Lead } from "@/types";

// ── Lead 1: Full enriched lead — EV factor + homestead + outreach ──────────────
// This is the primary lead for VAL-CROSS-002: shows EV factor, homestead badge,
// enriched outreach in drawer.
export const fixtureLeadFullEnriched: Lead = {
  id: "cross-area-001",
  ownerName: "Claudia Rodriguez",
  propertyAddress: "2847 SW 87th Ave",
  city: "Miami",
  zip: "33165",
  folioNumber: "01-4033-005-1800",
  damageType: "Hurricane/Wind",
  score: 88,
  date: "2026-03-15",
  contact: {
    email: "claudia.rodriguez@email.com",
    phone: "(305) 264-3300",
  },
  status: "New",
  permitType: "Roof Replacement",
  permitDate: "2026-03-10",
  stormEvent: "Hurricane Helene (Sept 2025)",
  femaDeclarationNumber: "DR-4879",
  femaIncidentType: "Hurricane",
  outreachMessage:
    "Dear Ms. Rodriguez, I represent Claim Remedy Adjusters. Our records indicate your property at 2847 SW 87th Ave sustained significant damage during Hurricane Helene (DR-4879). As a local public adjuster, I help property owners like yourself navigate the insurance claims process to ensure you receive the full settlement you're entitled to. I'd welcome the opportunity to discuss how I can assist you with your claim. Please feel free to call or text (305) 555-0198 at your convenience.",
  source: "permit",
  sourceDetail: "permit",
  county: "miami-dade",
  homestead: true,
  assessedValue: 425000,
  insuranceCompany: "Citizens Property Insurance",
  insurerRisk: "high",
  insurerRiskLabel: "High Risk Insurer",
  permitStatus: "No Contractor",
  permitValue: 42000,
  underpaidFlag: false,
  absenteeOwner: false,
  scoreBreakdown: {
    base: 30,
    factors: [
      {
        label: "Expected Value (EV) — Miami-Dade homestead",
        delta: 18,
        note: "Homestead property in Miami-Dade with $425K assessed value: high claim exposure",
      },
      {
        label: "Hurricane/Wind damage type",
        delta: 10,
        note: "High-severity peril based on historical claims",
      },
      {
        label: "FEMA DR-4879 active declaration",
        delta: 8,
        note: "Active federal disaster declaration strengthens claim legitimacy",
      },
      {
        label: "Contact info (email + phone)",
        delta: 12,
        note: "Owner can be reached directly",
      },
      {
        label: "Recent permit (within 30 days)",
        delta: 10,
        note: "Fresh damage — high urgency",
      },
    ],
    total: 88,
  },
};

// ── Lead 2: Enriched lead — different insurer (for insurer filter) ─────────────
export const fixtureLeadUniversalPeninsula: Lead = {
  id: "cross-area-002",
  ownerName: "James Thornton",
  propertyAddress: "1204 NE 15th Ave",
  city: "Fort Lauderdale",
  zip: "33304",
  folioNumber: "02-4134-007-2200",
  damageType: "Flood",
  score: 79,
  date: "2026-03-12",
  contact: {
    email: "j.thornton@gmail.com",
    phone: "(954) 882-4400",
  },
  status: "Contacted",
  permitType: "Water Damage Restoration",
  permitDate: "2026-03-08",
  stormEvent: "Tropical Storm Sara (Nov 2025)",
  outreachMessage:
    "Dear Mr. Thornton, I am reaching out regarding the water damage restoration permit filed for your Fort Lauderdale property. As a licensed public adjuster, I help homeowners maximize their insurance settlements. Given the recent storm activity in Broward County, I wanted to make sure you have the support you need to get your claim resolved fairly.",
  source: "permit",
  sourceDetail: "permit",
  county: "broward",
  homestead: false,
  assessedValue: 310000,
  insuranceCompany: "Universal Property & Casualty",
  insurerRisk: "medium",
  insurerRiskLabel: "Medium Risk Insurer",
  permitStatus: "Owner-Builder",
  permitValue: 18500,
  underpaidFlag: true,
  absenteeOwner: true,
  scoreBreakdown: {
    base: 25,
    factors: [
      {
        label: "Expected Value (EV) — Broward non-homestead",
        delta: 12,
        note: "Non-homestead investment property: moderate claim exposure",
      },
      {
        label: "Flood damage type",
        delta: 8,
        note: "Water damage claims often involve contested scope",
      },
      {
        label: "Underpaid permit signal",
        delta: 14,
        note: "Permit value below 60% of ZIP median — likely underpaid",
      },
      {
        label: "Contact info (email + phone)",
        delta: 12,
        note: "Owner can be reached directly",
      },
      {
        label: "Absentee owner",
        delta: 8,
        note: "Out-of-state owner — often more receptive to professional help",
      },
    ],
    total: 79,
  },
};

// ── Lead 3: Enriched lead — yet another insurer ─────────────────────────────────
export const fixtureLeadFloridaPeninsula: Lead = {
  id: "cross-area-003",
  ownerName: "Maria Gonzalez",
  propertyAddress: "445 Palm Ave",
  city: "West Palm Beach",
  zip: "33401",
  folioNumber: "03-2243-010-0900",
  damageType: "Roof",
  score: 91,
  date: "2026-03-18",
  contact: {
    email: "maria.gonzalez@outlook.com",
    phone: "(561) 330-7722",
  },
  status: "New",
  permitType: "Roof Replacement",
  permitDate: "2026-03-15",
  stormEvent: "Hurricane Helene (Sept 2025)",
  femaDeclarationNumber: "DR-4879",
  femaIncidentType: "Hurricane",
  outreachMessage:
    "Dear Ms. Gonzalez, I am a Florida-licensed public adjuster with Claim Remedy Adjusters. I noticed your roof replacement permit filed after Hurricane Helene (DR-4879). I help homeowners ensure their insurance settlements fully cover the cost of repairs. Given the scope of damage from this storm, many homeowners are significantly underpaid. I'd like to review your claim at no cost.",
  source: "permit",
  sourceDetail: "permit",
  county: "palm-beach",
  homestead: true,
  assessedValue: 520000,
  insuranceCompany: "Florida Peninsula Insurance",
  insurerRisk: "low",
  insurerRiskLabel: "Low Risk Insurer",
  permitStatus: "No Contractor",
  permitValue: 65000,
  underpaidFlag: false,
  absenteeOwner: false,
  scoreBreakdown: {
    base: 30,
    factors: [
      {
        label: "Expected Value (EV) — Palm Beach homestead",
        delta: 20,
        note: "Homestead property in Palm Beach with $520K assessed value: very high claim exposure",
      },
      {
        label: "Hurricane/Wind damage type",
        delta: 10,
        note: "High-severity peril",
      },
      {
        label: "FEMA DR-4879 active declaration",
        delta: 8,
        note: "Active federal disaster declaration",
      },
      {
        label: "High permit value ($65K)",
        delta: 13,
        note: "Larger repair scope — higher potential settlement",
      },
      {
        label: "Contact info (email + phone)",
        delta: 10,
        note: "Owner can be reached directly",
      },
    ],
    total: 91,
  },
};

// ── Lead 4: Enriched lead — yet another insurer ────────────────────────────────
export const fixtureLeadTowerHill: Lead = {
  id: "cross-area-004",
  ownerName: "Robert Chen",
  propertyAddress: "8800 SW 152nd St",
  city: "Miami",
  zip: "33157",
  folioNumber: "01-5039-002-1100",
  damageType: "Structural",
  score: 74,
  date: "2026-03-05",
  contact: {
    email: "robert.chen@webmail.com",
  },
  status: "New",
  permitType: "Structural Repair",
  permitDate: "2026-02-28",
  stormEvent: "Hurricane Helene (Sept 2025)",
  outreachMessage:
    "Dear Mr. Chen, our records indicate a structural repair permit was filed for your Miami property following Hurricane Helene. Structural damage claims are among the most complex — insurers often underestimate the scope of needed repairs. As a public adjuster, I advocate for homeowners to ensure full coverage. Please call (305) 555-0198 to discuss your claim.",
  source: "permit",
  sourceDetail: "permit",
  county: "miami-dade",
  homestead: false,
  assessedValue: 375000,
  insuranceCompany: "Tower Hill Prime Insurance",
  insurerRisk: "medium",
  insurerRiskLabel: "Medium Risk Insurer",
  permitStatus: "Stalled",
  permitValue: 28000,
  underpaidFlag: true,
  absenteeOwner: true,
  scoreBreakdown: {
    base: 25,
    factors: [
      {
        label: "Expected Value (EV) — Miami-Dade investment",
        delta: 14,
        note: "Non-homestead investment property: moderate claim exposure",
      },
      {
        label: "Structural damage type",
        delta: 6,
        note: "Complex damage type — often underpaid by insurers",
      },
      {
        label: "Stalled permit",
        delta: 10,
        note: "Permit filed but work stalled — strong need signal",
      },
      {
        label: "Underpaid permit signal",
        delta: 9,
        note: "Permit value below area median",
      },
      {
        label: "Email-only contact",
        delta: 10,
        note: "Email available but no phone",
      },
    ],
    total: 74,
  },
};

// ── Lead 5: Enriched lead — Bankers Insurance ───────────────────────────────────
export const fixtureLeadBankers: Lead = {
  id: "cross-area-005",
  ownerName: "Lisa Patel",
  propertyAddress: "33 SE 8th St",
  city: "Boca Raton",
  zip: "33432",
  folioNumber: "04-1547-003-0033",
  damageType: "Accidental Discharge",
  score: 82,
  date: "2026-03-20",
  contact: {
    email: "lisa.patel@gmail.com",
    phone: "(561) 992-4411",
  },
  status: "Contacted",
  permitType: "Water Damage Restoration",
  permitDate: "2026-03-18",
  stormEvent: "",
  outreachMessage:
    "Dear Ms. Patel, I am a Florida-licensed public adjuster reaching out regarding the water damage restoration permit for your Boca Raton property. Many homeowners are unaware that accidental discharge incidents are often covered under a separate policy provision that can significantly increase the claim payout. I'd be happy to review your policy at no cost.",
  source: "permit",
  sourceDetail: "permit",
  county: "palm-beach",
  homestead: true,
  assessedValue: 475000,
  insuranceCompany: "Bankers Insurance Group",
  insurerRisk: "low",
  insurerRiskLabel: "Low Risk Insurer",
  permitStatus: "Active",
  permitValue: 22000,
  underpaidFlag: false,
  absenteeOwner: false,
  scoreBreakdown: {
    base: 28,
    factors: [
      {
        label: "Expected Value (EV) — Boca Raton homestead",
        delta: 18,
        note: "Homestead property in Boca Raton with $475K assessed value: high claim exposure",
      },
      {
        label: "Accidental discharge type",
        delta: 8,
        note: "Often underpaid — separate coverage provision",
      },
      {
        label: "Active contractor on permit",
        delta: 10,
        note: "Professional contractor engaged",
      },
      {
        label: "Contact info (email + phone)",
        delta: 12,
        note: "Owner can be reached directly",
      },
      {
        label: "Very recent permit (within 7 days)",
        delta: 6,
        note: "Fresh activity",
      },
    ],
    total: 82,
  },
};

// ── Lead 6: Enriched lead — yet another insurer ────────────────────────────────
export const fixtureLeadPeopleSecured: Lead = {
  id: "cross-area-006",
  ownerName: "Derek Williams",
  propertyAddress: "7721 W Sunrise Blvd",
  city: "Plantation",
  zip: "33322",
  folioNumber: "02-6034-012-7700",
  damageType: "Hurricane/Wind",
  score: 76,
  date: "2026-03-08",
  contact: {
    phone: "(954) 661-3300",
  },
  status: "New",
  permitType: "Roof Replacement",
  permitDate: "2026-03-04",
  stormEvent: "Hurricane Helene (Sept 2025)",
  femaDeclarationNumber: "DR-4879",
  femaIncidentType: "Hurricane",
  outreachMessage:
    "Dear Mr. Williams, I represent Claim Remedy Adjusters. Your roof replacement permit following Hurricane Helene (DR-4879) caught our attention. Many homeowners with this type of damage are significantly underpaid by their insurer. I'd like to offer a free claim review — no obligation — to see if you're leaving money on the table. Call (305) 555-0198 today.",
  source: "permit",
  sourceDetail: "permit",
  county: "broward",
  homestead: false,
  assessedValue: 295000,
  insuranceCompany: "People's Trust Insurance",
  insurerRisk: "high",
  insurerRiskLabel: "High Risk Insurer",
  permitStatus: "No Contractor",
  permitValue: 31000,
  underpaidFlag: false,
  absenteeOwner: true,
  scoreBreakdown: {
    base: 30,
    factors: [
      {
        label: "Expected Value (EV) — Broward non-homestead",
        delta: 13,
        note: "Non-homestead in Broward: moderate claim exposure",
      },
      {
        label: "Hurricane/Wind damage + FEMA declaration",
        delta: 12,
        note: "Strong storm linkage and active declaration",
      },
      {
        label: "No contractor on permit",
        delta: 8,
        note: "Owner may need help navigating claim",
      },
      {
        label: "Phone-only contact",
        delta: 8,
        note: "Direct phone contact available",
      },
      {
        label: "Recent permit (within 30 days)",
        delta: 5,
        note: "Fresh damage",
      },
    ],
    total: 76,
  },
};

// ── All fixture leads combined ─────────────────────────────────────────────────
export const fixtureCrossAreaLeads: Lead[] = [
  fixtureLeadFullEnriched,
  fixtureLeadUniversalPeninsula,
  fixtureLeadFloridaPeninsula,
  fixtureLeadTowerHill,
  fixtureLeadBankers,
  fixtureLeadPeopleSecured,
];
