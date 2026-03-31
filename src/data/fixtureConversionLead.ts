/**
 * Validation fixture: a pre-seeded Converted lead for testing the
 * Convert-to-Case flow end-to-end without mutating real leads data.
 *
 * This fixture is ONLY loaded via the /fixtures/convert-case route.
 * It is never mixed into the main leads dataset.
 */
import type { Lead } from "@/types";

export const FIXTURE_CONVERSION_LEAD: Lead = {
  id: "fixture-conversion-lead-001",
  ownerName: "Rodriguez, Maria",
  propertyAddress: "7421 SW 82nd Ave",
  city: "Miami",
  zip: "33143",
  folioNumber: "30-4020-020-1234",
  damageType: "Hurricane/Wind",
  score: 91.4,
  date: "2026-03-01",
  status: "Converted",
  permitType: "Roof Replacement",
  permitDate: "2026-02-28",
  stormEvent: "Hurricane Rafael (Nov 2026)",
  outreachMessage:
    "TEMPLATE: Dear Rodriguez, our records show a roof replacement permit was recently filed for 7421 SW 82nd Ave in Miami following Hurricane Rafael. Hurricane-related roof damage claims often involve hidden structural issues that standard insurance assessments overlook, leaving property owners significantly underpaid. At Claim Remedy Adjusters, our licensed public adjusters conduct a thorough inspection to uncover the full scope of damage and fight for the settlement you deserve. Contact us for a no-obligation review — there is no upfront cost to you.",
  source: "permit",
  sourceDetail: "permit",
  contactedAt: "2026-03-02T10:00:00.000Z",
  convertedAt: "2026-03-05T14:30:00.000Z",
  claimValue: 67500,
  contactMethod: "Phone",
  notes: "Owner eager to move forward. Has documentation of prior insurer denial.",
  contact: {
    phone: "(305) 555-8742",
    email: "maria.rodriguez.8742@email.com",
  },
  homestead: true,
  ownerMailingAddress: "7421 SW 82nd Ave, Miami, FL 33143",
  assessedValue: 485000,
  permitStatus: "Owner-Builder",
  contractorName: undefined,
  permitValue: 42000,
  underpaidFlag: true,
  absenteeOwner: false,
  priorPermitCount: 0,
  roofAge: 22,
  codeViolation: false,
  county: "miami-dade",
  femaDeclarationNumber: "DR-4896",
  femaIncidentType: "Hurricane",
  insuranceCompany: "Citizens Property Insurance",
  insurerRisk: "high",
  insurerRiskLabel: "High Risk",
  scoreBreakdown: {
    base: 30,
    factors: [
      {
        label: "Hurricane/Wind damage type",
        delta: 10,
        note: "Based on historical settlement rate & avg payout from closed claims",
      },
      {
        label: "Permit filed within 30 days",
        delta: 18,
        note: "Fresh damage — highest urgency",
      },
      {
        label: "Owner-Builder permit",
        delta: 5,
        note: "No contractor — owner may struggle with insurance process alone",
      },
      {
        label: "FEMA declaration DR-4896",
        delta: 8,
        note: "Federal disaster declaration active for this area",
      },
      {
        label: "Underpayment flag",
        delta: 10,
        note: "Permit value below local median — owner may have accepted a low settlement",
      },
      {
        label: "Homestead property",
        delta: 5,
        note: "Owner-occupied primary residence — high stakes in settlement",
      },
      {
        label: "Contact info available",
        delta: 5.4,
        note: "Phone and email available for outreach",
      },
    ],
    total: 91.4,
  },
};
