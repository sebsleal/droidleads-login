import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Hash,
  Settings,
  Clock,
  DollarSign,
  Phone,
  Mail,
  Copy,
  Plus,
  LayoutGrid,
  CheckCircle2,
  MessageSquare,
  Home,
} from "lucide-react";
import { COUNTY_LABELS, type Lead } from "@/types";
import { displayOwnerName, formatDate, isBusinessEntityLead } from "@/lib/utils";
import { useToast } from "@/components/Toast";

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

function cleanOutreachMessage(message: string): string {
  return message.replace(/^TEMPLATE:\s*/i, "").trim();
}

function formatCurrency(value?: number): string {
  if (value == null || Number.isNaN(value)) return "Not available";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getScorePill(score: number) {
  if (score >= 85) {
    return {
      label: "High",
      wrapper: "bg-green-50 border-green-100 text-green-700",
      dot: "bg-green-500",
    };
  }

  if (score >= 70) {
    return {
      label: "Medium",
      wrapper: "bg-amber-50 border-amber-100 text-amber-700",
      dot: "bg-amber-500",
    };
  }

  return {
    label: "Low",
    wrapper: "bg-red-50 border-red-100 text-red-700",
    dot: "bg-red-500",
  };
}

function getDamagePillClass(type: Lead["damageType"]): string {
  switch (type) {
    case "Fire":
      return "bg-tertiary-container text-tertiary-fixed";
    case "Flood":
    case "Accidental Discharge":
      return "bg-sky-50 text-sky-700";
    case "Structural":
      return "bg-violet-100 text-violet-700";
    case "Hurricane/Wind":
    case "Roof":
      return "bg-slate-100 text-slate-600";
  }
}

function getHomesteadPill(lead: Lead) {
  if (lead.homestead === true) {
    return {
      label: "Homestead",
      className: "bg-emerald-50 text-emerald-700",
      propertyText: "Local owner",
    };
  }

  if (lead.homestead === false) {
    return {
      label: "Non-Homestead",
      className: "bg-slate-100 text-slate-500",
      propertyText: "Investor / non-homestead",
    };
  }

  return null;
}

function StatusButton({
  active,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  label: Lead["status"];
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-all ${
        active
          ? "border-secondary bg-secondary text-white"
          : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      {label}
    </button>
  );
}

export default function LeadDrawer({
  lead,
  onClose,
  onUpdateStatus,
  onUpdateTracking,
  onConvertToCase,
  readOnly = false,
}: LeadDrawerProps) {
  const { addToast } = useToast();
  const drawerRef = useRef<HTMLDivElement>(null);
  const [claimValue, setClaimValue] = useState(
    lead.claimValue != null ? String(lead.claimValue) : "",
  );
  const [notesValue, setNotesValue] = useState(lead.notes ?? "");

  const owner = displayOwnerName(lead.ownerName).display;
  const isBusinessOwner = isBusinessEntityLead(lead);
  const scorePill = getScorePill(lead.score);
  const homesteadPill = getHomesteadPill(lead);

  useEffect(() => {
    setClaimValue(lead.claimValue != null ? String(lead.claimValue) : "");
    setNotesValue(lead.notes ?? "");
  }, [lead.id, lead.claimValue, lead.notes]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    drawerRef.current?.focus();
  }, [lead.id]);

  const contactRows = useMemo(() => {
    if (lead.contact?.phone) {
      return [
        {
          label: "Phone",
          value: lead.contact.phone,
          icon: Phone,
          textClass: "text-green-600",
          bgClass: "bg-green-50 text-green-600",
        },
      ];
    }

    if (lead.contact?.email) {
      return [
        {
          label: "Email",
          value: lead.contact.email,
          icon: Mail,
          textClass: "text-secondary",
          bgClass: "bg-blue-50 text-secondary",
        },
      ];
    }

    return [
      {
        label: "Contact",
        value: "Not available",
        icon: MessageSquare,
        textClass: "text-slate-500",
        bgClass: "bg-slate-50 text-slate-400",
      },
    ];
  }, [lead.contact]);

  const propertyDetails = [
    {
      label: "County",
      value: lead.county ? `${COUNTY_LABELS[lead.county]} County` : "Not available",
      icon: LayoutGrid,
    },
    {
      label: "Folio Number",
      value: lead.folioNumber || "Not available",
      icon: Hash,
    },
    {
      label: "Permit Type",
      value: lead.permitType || "Not available",
      icon: Settings,
    },
    {
      label: "Permit Date",
      value: lead.permitDate ? formatDate(lead.permitDate) : "Not available",
      icon: Clock,
    },
    {
      label: "Lead Date",
      value: lead.date ? formatDate(lead.date) : "Not available",
      icon: Clock,
    },
    {
      label: "Owner Mailing Address",
      value: lead.ownerMailingAddress || "Not available",
      icon: MapPin,
      highlight: Boolean(lead.ownerMailingAddress),
    },
    {
      label: "Assessed Value",
      value: formatCurrency(lead.assessedValue),
      icon: DollarSign,
    },
  ];

  function handleCopyMessage() {
    navigator.clipboard
      .writeText(cleanOutreachMessage(lead.outreachMessage))
      .then(() => {
        addToast({
          type: "success",
          title: "Message copied to clipboard",
        });
      })
      .catch(() => {
        addToast({
          type: "error",
          title: "Copy failed",
          message: "Clipboard access was denied by the browser.",
        });
      });
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60]"
      />

      <motion.div
        ref={drawerRef}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        tabIndex={-1}
        role="dialog"
        aria-label={`Lead details for ${owner}`}
        className="fixed right-0 top-0 z-[70] h-screen w-full overflow-y-auto border-l border-slate-200/15 bg-surface-container-lowest shadow-2xl focus:outline-none sm:w-[480px]"
      >
        <div className="space-y-10 p-8">
          <div className="flex items-start justify-between">
            <div className="space-y-4">
              <div>
                <h3 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">
                  {owner}
                </h3>
                <p className="mt-1 flex items-center gap-1 text-sm font-medium text-slate-500">
                  <MapPin size={14} /> {lead.propertyAddress}, {lead.city}, FL {lead.zip}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <div
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 ${scorePill.wrapper}`}
                >
                  <div className={`h-1.5 w-1.5 rounded-full ${scorePill.dot}`} />
                  <span className="text-xs font-bold">
                    {lead.score.toFixed(1)} · {scorePill.label}
                  </span>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-tight ${getDamagePillClass(lead.damageType)}`}
                >
                  {lead.damageType}
                </span>
                {isBusinessOwner && (
                  <span className="rounded-full bg-secondary-container/10 px-3 py-1 text-[10px] font-bold uppercase tracking-tight text-secondary">
                    Business Entity
                  </span>
                )}
                {homesteadPill && (
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-tight ${homesteadPill.className}`}
                  >
                    {homesteadPill.label}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100"
            >
              <Plus className="rotate-45" size={24} />
            </button>
          </div>

          <section className="space-y-6">
            <h4 className="border-b border-slate-100 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              Property Details
            </h4>
            <div className="grid grid-cols-1 gap-5">
              {propertyDetails.map((item) => (
                <div key={item.label} className="flex gap-4">
                  <div className="h-fit flex-shrink-0 rounded-lg bg-slate-50 p-2 text-slate-400">
                    <item.icon size={16} />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {item.label}
                    </p>
                    <p
                      className={`break-words text-sm font-semibold ${
                        item.highlight ? "text-orange-600" : "text-on-surface"
                      }`}
                    >
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <h4 className="border-b border-slate-100 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              Permit Intelligence
            </h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <span className="cursor-default text-xs font-medium text-slate-500 underline">
                  Contractor
                </span>
                <span className="text-right text-xs font-bold uppercase text-on-surface">
                  {lead.contractorName || "Not available"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="cursor-default text-xs font-medium text-slate-500 underline">
                  Permit Value
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-on-surface">
                    {formatCurrency(lead.permitValue)}
                  </span>
                  {lead.underpaidFlag && (
                    <span className="rounded bg-orange-50 px-2 py-0.5 text-[9px] font-bold uppercase text-orange-600">
                      Likely Underpaid
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h4 className="border-b border-slate-100 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              Property Intelligence
            </h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <span className="cursor-default text-xs font-medium text-slate-500 underline">
                  Owner Occupied
                </span>
                <span
                  className={`flex items-center gap-1 text-xs font-bold ${
                    lead.homestead === true ? "text-green-600" : "text-slate-500"
                  }`}
                >
                  {lead.homestead === true && <CheckCircle2 size={14} />}
                  {lead.homestead === false && <Home size={14} />}
                  {homesteadPill?.propertyText || "Unknown"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="cursor-default text-xs font-medium text-slate-500 underline">
                  Prior Permits
                </span>
                <span className="text-xs font-bold text-purple-600">
                  {(lead.priorPermitCount ?? 0) > 0
                    ? `${lead.priorPermitCount} prior at this address`
                    : "No prior permits recorded"}
                </span>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h4 className="border-b border-slate-100 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              Contact Information
            </h4>
            <div className="space-y-4">
              {contactRows.map((item) => (
                <div key={item.label} className="flex gap-4">
                  <div className={`h-fit rounded-lg p-2 ${item.bgClass}`}>
                    <item.icon size={16} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {item.label}
                    </p>
                    <p className={`text-sm font-bold ${item.textClass}`}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                AI Outreach Message
              </h4>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-100"
              >
                <Copy size={12} /> Copy Message
              </button>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 text-xs font-medium leading-relaxed text-slate-600">
              {cleanOutreachMessage(lead.outreachMessage)}
            </div>
          </section>

          <section className="space-y-6">
            <h4 className="border-b border-slate-100 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              Engagement & Conversion
            </h4>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Contact Method
                </label>
                <select
                  value={lead.contactMethod ?? ""}
                  disabled={readOnly}
                  onChange={(event) =>
                    onUpdateTracking?.(lead.id, {
                      contactMethod: event.target.value || undefined,
                    })
                  }
                  className={`w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium focus:ring-0 ${
                    readOnly ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                  }`}
                >
                  <option value="">— not set —</option>
                  <option value="Phone">Phone Call</option>
                  <option value="Email">Email</option>
                  <option value="Text">Text Message</option>
                  <option value="In-Person">In-Person</option>
                  <option value="Mail">Mail</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Claim Value
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 45000"
                  value={claimValue}
                  disabled={readOnly}
                  onChange={(event) => setClaimValue(event.target.value)}
                  onBlur={() => {
                    const numberValue = parseFloat(claimValue);
                    onUpdateTracking?.(lead.id, {
                      claimValue: Number.isNaN(numberValue) ? undefined : numberValue,
                    });
                  }}
                  className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium outline-none focus:ring-0 ${
                    readOnly ? "cursor-not-allowed opacity-70" : ""
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Notes
                </label>
                <textarea
                  placeholder="Add adjuster notes..."
                  value={notesValue}
                  disabled={readOnly}
                  onChange={(event) => setNotesValue(event.target.value)}
                  onBlur={() =>
                    onUpdateTracking?.(lead.id, {
                      notes: notesValue.trim() || undefined,
                    })
                  }
                  className={`h-24 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-medium outline-none focus:ring-0 ${
                    readOnly ? "cursor-not-allowed opacity-70" : ""
                  }`}
                />
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h4 className="border-b border-slate-100 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              Lead Status
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((status) => (
                <StatusButton
                  key={status}
                  active={lead.status === status}
                  label={status}
                  disabled={readOnly}
                  onClick={() => onUpdateStatus(lead.id, status)}
                />
              ))}
            </div>
          </section>

          {onConvertToCase && lead.status !== "Converted" && (
            <button
              type="button"
              onClick={() => onConvertToCase(lead)}
              className="w-full rounded-xl bg-on-surface py-4 text-sm font-bold text-white transition-all hover:opacity-90"
            >
              Convert To Case
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-4 text-sm font-bold text-slate-600 transition-all hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </motion.div>
    </>
  );
}
