import { useEffect, useRef, useState } from "react";
import {
  X,
  MapPin,
  Hash,
  Wrench,
  Calendar,
  CloudLightning,
  Mail,
  Phone,
  Copy,
  Check,
  MessageSquare,
  Home,
  DollarSign,
  Building2,
  ShieldAlert,
  ExternalLink,
  Users,
} from "lucide-react";
import type { Lead, LLCOfficer } from "@/types";
import { formatDate, damageTypeColor, cn, displayOwnerName } from "@/lib/utils";

const LLC_KEYWORDS = ["LLC", "L.L.C", "INC", "CORP", "LTD", "TRUST", "HOLDINGS",
  "PROPERTIES", "REALTY", "INVESTMENTS", "GROUP", "PARTNERS", "VENTURES"];

function isBusinessEntity(name: string): boolean {
  const upper = name.toUpperCase();
  return LLC_KEYWORDS.some((kw) => upper.includes(kw));
}
import ScoreBadge from "@/components/ScoreBadge";
import Tooltip from "@/components/Tooltip";

type TrackingPatch = Partial<
  Pick<
    Lead,
    | "status"
    | "contactedAt"
    | "convertedAt"
    | "claimValue"
    | "contactMethod"
    | "notes"
  >
>;

interface LeadDrawerProps {
  lead: Lead;
  onClose: () => void;
  onUpdateStatus: (id: string, status: Lead["status"]) => void;
  onUpdateTracking?: (id: string, patch: TrackingPatch) => void;
  onConvertToCase?: (lead: Lead) => void;
  readOnly?: boolean;
}

const STATUS_OPTIONS: Lead["status"][] = [
  "New",
  "Contacted",
  "Converted",
  "Closed",
];

const STATUS_ACTIVE: Record<Lead["status"], string> = {
  New: "bg-blue-600 text-white border-blue-600",
  Contacted: "bg-amber-500 text-white border-amber-500",
  Converted: "bg-emerald-600 text-white border-emerald-600",
  Closed: "bg-slate-400 text-white border-slate-400",
};

const STATUS_INACTIVE =
  "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";

function cleanOutreachMessage(msg: string): string {
  return msg.replace(/^TEMPLATE:\s*/i, "").trim();
}

const STATUS_TOOLTIPS: Record<Lead["status"], string> = {
  New: "This lead hasn't been contacted yet. Mark it when you're ready to start outreach.",
  Contacted:
    "You've reached out to this owner. The contact date is recorded automatically.",
  Converted:
    "This owner has signed on as a client. The conversion date is recorded automatically.",
  Closed:
    "This lead is no longer active — not interested, unresponsive, or otherwise resolved.",
};

export default function LeadDrawer({
  lead,
  onClose,
  onUpdateStatus,
  onUpdateTracking,
  onConvertToCase,
  readOnly = false,
}: LeadDrawerProps) {
  const [copied, setCopied] = useState(false);
  const [notesValue, setNotesValue] = useState(lead.notes ?? "");
  const [claimValue, setClaimValue] = useState(
    lead.claimValue != null ? String(lead.claimValue) : "",
  );
  const drawerRef = useRef<HTMLDivElement>(null);

  // Sync local editable state when the lead prop changes (e.g. different lead opened)
  useEffect(() => {
    setNotesValue(lead.notes ?? "");
    setClaimValue(lead.claimValue != null ? String(lead.claimValue) : "");
  }, [lead.id, lead.notes, lead.claimValue]);

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Focus trap: focus drawer on open
  useEffect(() => {
    drawerRef.current?.focus();
  }, [lead.id]);

  function handleCopy() {
    navigator.clipboard.writeText(cleanOutreachMessage(lead.outreachMessage)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="drawer-backdrop fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-label={`Lead details: ${displayOwnerName(lead.ownerName).display}`}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] lg:w-[520px] bg-white shadow-drawer
                   flex flex-col animate-slide-in focus:outline-none overflow-hidden"
      >
        {/* Drawer header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {(() => {
                const { display, isPlaceholder } = displayOwnerName(lead.ownerName);
                return (
                  <h2 className={`text-lg leading-snug truncate ${isPlaceholder ? 'font-normal text-slate-400 italic' : 'font-bold text-slate-900'}`}>
                    {display}
                  </h2>
                );
              })()}
              <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">
                  {lead.propertyAddress}, {lead.city}, FL {lead.zip}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full
                         bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Score + damage type + homestead badge */}
          <div className="flex items-center gap-2.5 mt-3 flex-wrap">
            <Tooltip
              text="Lead priority score (0–100). 85+ = High priority. Calculated from damage type, storm event match, FEMA declaration, permit status, building age, absentee owner, and contact availability."
              position="bottom"
            >
              <span className="cursor-help">
                <ScoreBadge score={lead.score} size="md" showLabel />
              </span>
            </Tooltip>
            <Tooltip
              text="Type of damage recorded on the permit — drives both the lead score and the outreach message tone."
              position="bottom"
            >
              <span
                className={cn(
                  "badge cursor-help",
                  damageTypeColor(lead.damageType),
                )}
              >
                {lead.damageType}
              </span>
            </Tooltip>
            {isBusinessEntity(lead.ownerName) && (
              <Tooltip
                text="This property is owned by a business entity (LLC, Corp, Trust, etc.). See the LLC Principals section below for registered officers and Sunbiz lookup."
                position="bottom"
              >
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200 cursor-help">
                  <Building2 className="w-3 h-3" />
                  Business Entity
                </span>
              </Tooltip>
            )}
            {lead.homestead === true && (
              <Tooltip
                text="The owner lives here as their primary residence (homestead exemption on file). Owner-occupied properties often have more at stake in a claim."
                position="bottom"
              >
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-help">
                  <Home className="w-3 h-3" />
                  Homestead
                </span>
              </Tooltip>
            )}
            {lead.homestead === false && (
              <Tooltip
                text="This property is not the owner's primary residence — likely a rental, investment, or vacation property. Absentee investors are often very open to professional claim help."
                position="bottom"
              >
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200 cursor-help">
                  <Home className="w-3 h-3" />
                  Non-Homestead
                </span>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Property details */}
          <section>
            <Tooltip
              text="Core property and permit information pulled from the county permit system and Property Appraiser records."
              position="bottom"
            >
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4 cursor-help inline-block underline decoration-dotted decoration-slate-300">
                Property Details
              </h3>
            </Tooltip>
            <div className="space-y-4">
              {lead.county && (
                <DetailRow
                  icon={<Building2 className="w-4 h-4" />}
                  label="County"
                  tooltip="The county where the property is located."
                  value={
                    <span className="capitalize">
                      {lead.county === "miami-dade"
                        ? "Miami-Dade County"
                        : lead.county === "broward"
                          ? "Broward County"
                          : lead.county === "palm-beach"
                            ? "Palm Beach County"
                            : lead.county}
                    </span>
                  }
                />
              )}
              {lead.femaDeclarationNumber && (
                <DetailRow
                  icon={<ShieldAlert className="w-4 h-4 text-orange-500" />}
                  label="FEMA Declaration"
                  tooltip="An active FEMA federal disaster declaration covers this area. This strengthens the insurance claim, may unlock additional federal aid, and is a strong buying signal for the homeowner."
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-semibold text-orange-700">
                        {lead.femaDeclarationNumber}
                      </span>
                      {lead.femaIncidentType && (
                        <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full">
                          {lead.femaIncidentType}
                        </span>
                      )}
                    </span>
                  }
                />
              )}
              {(lead.insurerRisk || lead.insuranceCompany) && (
                <DetailRow
                  icon={<Building2 className="w-4 h-4 text-slate-500" />}
                  label="Insurer Risk"
                  tooltip="Risk level for this insurance company based on historical payout rates, litigation frequency, and settlement amounts from closed claims data."
                  value={
                    <span className="inline-flex items-center gap-2">
                      {lead.insuranceCompany && (
                        <span className="text-sm text-slate-700">
                          {lead.insuranceCompany}
                        </span>
                      )}
                      {lead.insurerRiskLabel && (
                        <span
                          className={cn(
                            "badge text-[10px]",
                            lead.insurerRisk === "high"
                              ? "bg-red-100 text-red-800 border-red-200"
                              : lead.insurerRisk === "medium"
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : lead.insurerRisk === "low"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200",
                          )}
                        >
                          {lead.insurerRiskLabel}
                        </span>
                      )}
                    </span>
                  }
                />
              )}
              <DetailRow
                icon={<Hash className="w-4 h-4" />}
                label="Folio Number"
                tooltip="The county Property Appraiser's unique parcel ID for this property. Useful for looking up tax records, assessed value, and ownership history."
                value={lead.folioNumber}
              />
              <DetailRow
                icon={<Wrench className="w-4 h-4" />}
                label="Permit Type"
                tooltip="The type of building permit filed — e.g. Roof Replacement, Water Damage Repair, Hurricane Damage. Indicates the scope of the repair work."
                value={lead.permitType}
              />
              <DetailRow
                icon={<Calendar className="w-4 h-4" />}
                label="Permit Date"
                tooltip="The date the damage repair permit was filed with the county. More recent permits are higher priority — the owner is actively dealing with the damage."
                value={formatDate(lead.permitDate)}
              />
              <DetailRow
                icon={<CloudLightning className="w-4 h-4" />}
                label="Storm Event"
                tooltip="The NOAA-recorded storm event associated with this area's damage. Referencing the specific storm by name in outreach significantly improves response rates."
                value={lead.stormEvent}
              />
              <DetailRow
                icon={<Calendar className="w-4 h-4" />}
                label="Lead Date"
                tooltip="The date this lead was added to the system."
                value={formatDate(lead.date)}
              />
              {lead.ownerMailingAddress &&
                lead.ownerMailingAddress !==
                  `${lead.propertyAddress}, ${lead.city}, FL ${lead.zip}` && (
                  <DetailRow
                    icon={<MapPin className="w-4 h-4 text-amber-500" />}
                    label="Owner Mailing Address"
                    tooltip="Where the owner receives mail — different from the property address. This confirms the owner is absentee (out of state or elsewhere), meaning they may not be aware of the full damage."
                    value={
                      <span className="text-amber-700">
                        {lead.ownerMailingAddress}
                      </span>
                    }
                  />
                )}
              {lead.assessedValue && lead.assessedValue > 0 && (
                <DetailRow
                  icon={<DollarSign className="w-4 h-4" />}
                  label="Assessed Value"
                  tooltip="County Property Appraiser assessed value. Used as a rough baseline for estimating claim size — higher assessed values typically mean larger potential settlements."
                  value={`$${lead.assessedValue.toLocaleString()}`}
                />
              )}
            </div>
          </section>

          {/* Permit Intelligence */}
          {(lead.permitStatus || lead.permitValue || lead.contractorName) && (
            <section className="space-y-2">
              <Tooltip
                text="Signals derived from the permit filing itself — who filed it, the repair cost, and whether there are red flags like a stalled permit or no contractor."
                position="bottom"
              >
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-help inline-block underline decoration-dotted decoration-slate-300 mb-4">
                  Permit Intelligence
                </h3>
              </Tooltip>
              <div className="space-y-3 text-sm">
                {lead.permitStatus && (
                  <div className="flex justify-between">
                    <Tooltip text="The filing status of the permit. Owner-Builder = no licensed contractor, owner is handling it themselves. No Contractor = contractor field is blank. Stalled = work started but stopped. Active = repair is in progress.">
                      <span className="text-slate-500 cursor-help underline decoration-dotted decoration-slate-400">
                        Status
                      </span>
                    </Tooltip>
                    <span
                      className={`font-medium px-2 py-0.5 rounded text-xs ${
                        lead.permitStatus === "Owner-Builder" ||
                        lead.permitStatus === "No Contractor"
                          ? "bg-blue-100 text-blue-700"
                          : lead.permitStatus === "Stalled"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {lead.permitStatus}
                    </span>
                  </div>
                )}
                {lead.contractorName && (
                  <div className="flex justify-between">
                    <Tooltip text="The licensed contractor listed on the permit. If a contractor is already hired, focus your pitch on the insurance claim side rather than the repair work.">
                      <span className="text-slate-500 cursor-help underline decoration-dotted decoration-slate-400">
                        Contractor
                      </span>
                    </Tooltip>
                    <span className="text-slate-800 font-medium text-right max-w-[60%] truncate">
                      {lead.contractorName}
                    </span>
                  </div>
                )}
                {(lead.permitValue ?? 0) > 0 && (
                  <div className="flex justify-between items-center">
                    <Tooltip text="The declared repair cost on the permit. If flagged 'Likely Underpaid', this value is below 60% of the ZIP code median — a strong sign the insurance settlement may not cover the true cost of repairs.">
                      <span className="text-slate-500 cursor-help underline decoration-dotted decoration-slate-400">
                        Permit Value
                      </span>
                    </Tooltip>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-800 font-medium">
                        ${lead.permitValue!.toLocaleString()}
                      </span>
                      {lead.underpaidFlag && (
                        <Tooltip text="This permit value is below 60% of the median for this ZIP code. The owner may have accepted a low settlement without realizing they could have received more.">
                          <span className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full font-medium cursor-help">
                            Likely Underpaid
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Property Intelligence */}
          {(lead.absenteeOwner !== undefined ||
            lead.roofAge !== undefined ||
            (lead.priorPermitCount ?? 0) > 0) && (
            <section className="space-y-2">
              <Tooltip
                text="Signals about the property and owner derived from Property Appraiser records — ownership patterns, roof condition, and damage history."
                position="bottom"
              >
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-help inline-block underline decoration-dotted decoration-slate-300 mb-4">
                  Property Intelligence
                </h3>
              </Tooltip>
              <div className="space-y-3 text-sm">
                {lead.absenteeOwner !== undefined && (
                  <div className="flex justify-between items-center">
                    <Tooltip text="Whether the owner lives at this address. Absentee = mailing address is out of state. These owners often haven't seen the damage firsthand and are more likely to need remote claim assistance.">
                      <span className="text-slate-500 cursor-help underline decoration-dotted decoration-slate-400">
                        Owner Occupied
                      </span>
                    </Tooltip>
                    {lead.absenteeOwner ? (
                      <span className="text-amber-600 font-medium text-xs flex items-center gap-1">
                        ⚠ Absentee — out of state
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium text-xs">
                        ✓ Local owner
                      </span>
                    )}
                  </div>
                )}
                {lead.roofAge != null && (
                  <div className="flex justify-between items-center">
                    <Tooltip text="Estimated building age based on the year of construction from Property Appraiser records. Older buildings are more likely to have aging roofs, outdated systems, and higher claim value potential.">
                      <span className="text-slate-500 cursor-help underline decoration-dotted decoration-slate-400">
                        Est. Building Age
                      </span>
                    </Tooltip>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-800 font-medium">
                        {lead.roofAge} yrs
                      </span>
                      {lead.roofAge > 15 && (
                        <Tooltip text="This building is over 15 years old. Older structures are more likely to have wear-related damage that insurers may undervalue.">
                          <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-full cursor-help">
                            Aging
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                )}
                {(lead.priorPermitCount ?? 0) >= 1 && (
                  <div className="flex justify-between">
                    <Tooltip text="Number of prior damage permits filed at this address. Multiple claims suggest ongoing vulnerability or a complex repair history — worth mentioning you understand repeat claim situations.">
                      <span className="text-slate-500 cursor-help underline decoration-dotted decoration-slate-400">
                        Prior Permits
                      </span>
                    </Tooltip>
                    <span className="text-purple-700 font-medium">
                      {lead.priorPermitCount} prior at this address
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Contact information */}
          <section>
            <Tooltip
              text="Contact details found via voter roll and business records lookups. Click email or phone to open your mail or dialer directly."
              position="bottom"
            >
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4 cursor-help inline-block underline decoration-dotted decoration-slate-300">
                Contact Information
              </h3>
            </Tooltip>
            {lead.contact ? (
              <div className="space-y-4">
                {lead.contact.email && (
                  <DetailRow
                    icon={<Mail className="w-4 h-4 text-blue-500" />}
                    label="Email"
                    tooltip="Owner's email address found from voter roll or public records. Click to open in your email client."
                    value={
                      <a
                        href={`mailto:${lead.contact.email}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.contact.email}
                      </a>
                    }
                  />
                )}
                {lead.contact.phone && (
                  <DetailRow
                    icon={<Phone className="w-4 h-4 text-green-500" />}
                    label="Phone"
                    tooltip="Owner's phone number found from voter roll or public records. Click to dial directly from your device."
                    value={
                      <a
                        href={`tel:${lead.contact.phone}`}
                        className="text-green-700 hover:text-green-900 hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.contact.phone}
                      </a>
                    }
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-50 rounded-lg px-4 py-3">
                <Phone className="w-4 h-4" />
                <span>No contact information available</span>
              </div>
            )}
          </section>

          {/* LLC Principals — always visible for business entities */}
          {isBusinessEntity(lead.ownerName) && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <Tooltip
                  text="Officers, directors, and members registered with Florida's Division of Corporations (Sunbiz). These are the actual humans behind the LLC — the right people to contact about an insurance claim."
                  position="bottom"
                >
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-help inline-flex items-center gap-1.5 underline decoration-dotted decoration-slate-300">
                    <Users className="w-3.5 h-3.5" />
                    LLC Principals
                  </h3>
                </Tooltip>
                <a
                  href={`https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?SearchTerm=${encodeURIComponent(lead.ownerName)}&SearchType=EntityName&SearchStatus=Active&ListPage=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3" />
                  View on Sunbiz
                </a>
              </div>

              {/* Registered agent row */}
              {lead.registeredAgentName && (
                <div className="mb-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 flex items-start gap-2">
                  <Building2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
                  <div>
                    <span className="font-semibold text-slate-600">Registered Agent: </span>
                    {lead.registeredAgentName}
                    {lead.registeredAgentAddress && (
                      <span className="text-slate-400 block mt-0.5">{lead.registeredAgentAddress}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Officers list */}
              {lead.llcOfficers && lead.llcOfficers.length > 0 ? (
                <div className="space-y-2">
                  {lead.llcOfficers.map((officer: LLCOfficer, i: number) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-3 py-2.5 px-3 rounded-lg bg-violet-50/60 border border-violet-100"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 leading-snug">{officer.name}</p>
                        {officer.address && (
                          <p className="text-xs text-slate-400 mt-0.5">{officer.address}</p>
                        )}
                      </div>
                      <span className="flex-shrink-0 text-[10px] font-medium bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {officer.title}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
                  <Users className="w-4 h-4 flex-shrink-0" />
                  <span>
                    No officers on file yet —{" "}
                    <a
                      href={`https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?SearchTerm=${encodeURIComponent(lead.ownerName)}&SearchType=EntityName&SearchStatus=Active&ListPage=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-600 hover:underline font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      look up on Sunbiz
                    </a>
                  </span>
                </div>
              )}
            </section>
          )}

          {/* AI Outreach Message */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <Tooltip
                text="A personalized outreach message written by AI using this lead's specific details — damage type, address, storm event, FEMA declaration, and owner signals. Edit before sending if needed."
                position="bottom"
              >
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2 cursor-help underline decoration-dotted decoration-slate-300">
                  <MessageSquare className="w-3.5 h-3.5" />
                  AI Outreach Message
                </h3>
              </Tooltip>
              <Tooltip text="Copy this message to your clipboard — ready to paste into an email, text, or mail merge tool. The message is personalized to this specific owner and property.">
                <button
                  onClick={handleCopy}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border transition-all duration-200",
                    copied
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Message
                    </>
                  )}
                </button>
              </Tooltip>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                {cleanOutreachMessage(lead.outreachMessage)}
              </p>
            </div>
          </section>

          {/* Engagement & conversion */}
          <section>
            <Tooltip
              text="Track your outreach and deal progress for this lead. All fields are saved automatically when you leave them."
              position="bottom"
            >
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4 cursor-help inline-block underline decoration-dotted decoration-slate-300">
                Engagement & Conversion
              </h3>
            </Tooltip>
            <div className="space-y-3">
              {/* Timestamps — read-only, auto-set by status changes */}
              {lead.contactedAt && (
                <DetailRow
                  icon={<Calendar className="w-4 h-4" />}
                  label="Contacted At"
                  tooltip="Date this lead was first marked as Contacted. Set automatically when you change the status."
                  value={formatDate(lead.contactedAt)}
                />
              )}
              {lead.convertedAt && (
                <DetailRow
                  icon={<Calendar className="w-4 h-4" />}
                  label="Converted At"
                  tooltip="Date this lead was marked as Converted (signed as a client). Set automatically when you change the status."
                  value={formatDate(lead.convertedAt)}
                />
              )}

              {/* Contact Method — editable select */}
              <div className="flex items-start gap-3">
                <span className="mt-2 text-slate-400 flex-shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <Tooltip
                    text="How you reached out to this owner — phone call, email, in-person visit, mail, or text. Helps you track which outreach method works best across your leads."
                    position="top"
                  >
                    <span className="text-xs text-slate-400 block mb-1 cursor-help underline decoration-dotted decoration-slate-300">
                      Contact Method
                    </span>
                  </Tooltip>
                  <select
                    value={lead.contactMethod ?? ""}
                    disabled={readOnly}
                    onChange={(e) => {
                      const val = e.target.value || undefined;
                      onUpdateTracking?.(lead.id, { contactMethod: val });
                    }}
                    className={cn(
                      "w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                      readOnly ? "cursor-not-allowed bg-slate-50 text-slate-400" : "",
                    )}
                  >
                    <option value="">— not set —</option>
                    <option value="Phone">Phone</option>
                    <option value="Email">Email</option>
                    <option value="In-Person">In-Person</option>
                    <option value="Mail">Mail</option>
                    <option value="Text">Text</option>
                  </select>
                </div>
              </div>

              {/* Claim Value — editable number input */}
              <div className="flex items-start gap-3">
                <span className="mt-2 text-slate-400 flex-shrink-0">
                  <DollarSign className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <Tooltip
                    text="The estimated or final insurance claim value for this property. Enter the settlement amount once known — used to track your pipeline value in Analytics."
                    position="top"
                  >
                    <span className="text-xs text-slate-400 block mb-1 cursor-help underline decoration-dotted decoration-slate-300">
                      Claim Value
                    </span>
                  </Tooltip>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="e.g. 45000"
                    value={claimValue}
                    disabled={readOnly}
                    onChange={(e) => setClaimValue(e.target.value)}
                    onBlur={() => {
                      const num = parseFloat(claimValue);
                      onUpdateTracking?.(lead.id, {
                        claimValue: isNaN(num) ? undefined : num,
                      });
                    }}
                    className={cn(
                      "w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                      readOnly ? "cursor-not-allowed bg-slate-50 text-slate-400" : "",
                    )}
                  />
                </div>
              </div>

              {/* Notes — editable textarea */}
              <div className="flex items-start gap-3">
                <span className="mt-2 text-slate-400 flex-shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <Tooltip
                    text="Your private notes about this lead — conversation summaries, follow-up reminders, property access info, or anything else relevant to the claim."
                    position="top"
                  >
                    <span className="text-xs text-slate-400 block mb-1 cursor-help underline decoration-dotted decoration-slate-300">
                      Notes
                    </span>
                  </Tooltip>
                  <textarea
                    rows={3}
                    placeholder="Add adjuster notes…"
                    value={notesValue}
                    disabled={readOnly}
                    onChange={(e) => setNotesValue(e.target.value)}
                    onBlur={() => {
                      onUpdateTracking?.(lead.id, {
                        notes: notesValue.trim() || undefined,
                      });
                    }}
                    className={cn(
                      "w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                      readOnly ? "cursor-not-allowed bg-slate-50 text-slate-400" : "",
                    )}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Status selector */}
          <section>
            <Tooltip
              text="Set the current stage of this lead in your pipeline. Status changes are saved immediately and timestamps are recorded automatically."
              position="bottom"
            >
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4 cursor-help inline-block underline decoration-dotted decoration-slate-300">
                Lead Status
              </h3>
            </Tooltip>
            <div className="flex items-center gap-2">
              {STATUS_OPTIONS.map((s) => (
                <Tooltip key={s} text={STATUS_TOOLTIPS[s]} position="top">
                  <button
                    disabled={readOnly}
                    onClick={() => onUpdateStatus(lead.id, s)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium border transition-all duration-150",
                      lead.status === s ? STATUS_ACTIVE[s] : STATUS_INACTIVE,
                      readOnly ? "cursor-not-allowed opacity-60" : "",
                    )}
                  >
                    {s}
                  </button>
                </Tooltip>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          {lead.status === "Converted" && onConvertToCase && (
            <button
              onClick={() => onConvertToCase(lead)}
              className="w-full mb-2 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium
                         hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Convert to Case
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg border border-slate-200 text-sm font-medium
                       text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tooltip?: string;
}

function DetailRow({ icon, label, value, tooltip }: DetailRowProps) {
  if (value === null || value === undefined || value === "" || value === false) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="mt-3.5 text-slate-400 flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        {tooltip ? (
          <Tooltip text={tooltip}>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide cursor-help">
              {label}
            </span>
          </Tooltip>
        ) : (
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
        )}
        <span className="text-sm text-slate-800 font-medium leading-snug">{value}</span>
      </div>
    </div>
  );
}
