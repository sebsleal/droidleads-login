import { useEffect, useRef, useState } from "react";
import {
  X,
  MapPin,
  Hash,
  Calendar,
  Mail,
  Phone,
  Building2,
  FileText,
  CheckSquare,
  Square,
  AlertTriangle,
  Clock,
  MessageSquare,
} from "lucide-react";
import type { Case, CaseStatusPhase } from "@/types";
import { cn, formatDate } from "@/lib/utils";
import { caseStatusColor, caseStatusLabel } from "@/components/CasesTable";
import Tooltip from "@/components/Tooltip";
import { useReadOnlyNotice } from "@/hooks/useReadOnlyNotice";

type CasePatch = Partial<
  Pick<
    Case,
    | "statusPhase"
    | "feeDisbursed"
    | "estimatedLoss"
    | "feeRate"
    | "lor"
    | "plumbingInvoice"
    | "waterMitigation"
    | "estimateDate"
    | "inspectionDate"
    | "srlDate"
    | "cdl1Date"
    | "cdl2Date"
    | "cdl3Date"
    | "notes"
  >
>;

interface CaseDrawerProps {
  kase: Case;
  onClose: () => void;
  onSave: (id: string, patch: CasePatch) => Promise<boolean | void> | boolean | void;
  readOnly?: boolean;
}

const STATUS_OPTIONS: CaseStatusPhase[] = [
  "OpenPhase: Claim Originated",
  "OpenPhase: Estimating",
  "OpenPhase: Inspection",
  "OpenPhase: Under Review",
  "OpenPhase: Negotiation",
  "OpenPhase: Appraisal",
  "OpenPhase: Mediation",
  "OpenPhase: Mortgage Processing",
  "OpenPhase: Initial Payment",
  "OpenPhase: Recovering Depreciation",
  "OpenPhase: Ready to Close",
  "OpenPhase: Settled",
  "Settled",
  "Appraisal",
  "Litigation",
  "Closed w/o Pay",
];

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

interface TimelineStep {
  label: string;
  date: string | undefined;
  isBool?: boolean;
  boolValue?: boolean;
}

function getTimelineSteps(kase: Case): TimelineStep[] {
  return [
    { label: "Claim Logged", date: kase.dateLogged },
    { label: "LOR Signed", date: undefined, isBool: true, boolValue: kase.lor },
    { label: "Inspection", date: kase.inspectionDate },
    { label: "Estimate", date: kase.estimateDate },
    { label: "SRL Filed", date: kase.srlDate },
    { label: "CDL 1", date: kase.cdl1Date },
    { label: "CDL 2", date: kase.cdl2Date },
    { label: "CDL 3", date: kase.cdl3Date },
  ];
}

function getDaysInCurrentStage(kase: Case): number {
  const lastDate = [
    kase.cdl3Date,
    kase.cdl2Date,
    kase.cdl1Date,
    kase.srlDate,
    kase.estimateDate,
    kase.inspectionDate,
    kase.dateLogged,
  ].find((d) => d != null);
  if (!lastDate) return 0;
  return Math.floor(
    (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function CaseTimeline({ kase }: { kase: Case }) {
  const steps = getTimelineSteps(kase);
  const daysInStage = getDaysInCurrentStage(kase);
  const isStalled =
    daysInStage > 30 &&
    !["Settled", "Litigation", "Closed w/o Pay"].includes(kase.statusPhase);

  // Find index of last completed step
  let lastCompletedIdx = -1;
  steps.forEach((s, i) => {
    if (s.isBool ? s.boolValue : s.date) lastCompletedIdx = i;
  });

  return (
    <div>
      {isStalled && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-xs text-amber-700 font-medium">
            Stalled — {daysInStage} days since last milestone
          </span>
        </div>
      )}
      <div className="relative">
        {steps.map((step, i) => {
          const completed = step.isBool ? !!step.boolValue : !!step.date;
          const isCurrent = i === lastCompletedIdx + 1;
          const isPast = i <= lastCompletedIdx;
          const isFuture = i > lastCompletedIdx + 1;

          return (
            <div
              key={step.label}
              className="flex items-start gap-3 mb-3 last:mb-0"
            >
              {/* Dot + connector */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0",
                    completed
                      ? "bg-emerald-500"
                      : isCurrent
                        ? "bg-blue-500"
                        : "bg-slate-200",
                  )}
                />
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-0.5 h-5 mt-1",
                      isPast ? "bg-emerald-200" : "bg-slate-100",
                    )}
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      completed
                        ? "text-emerald-700"
                        : isCurrent
                          ? "text-blue-700"
                          : "text-slate-400",
                    )}
                  >
                    {step.label}
                  </span>
                  {completed && step.date && (
                    <span className="text-xs text-slate-400">
                      {new Date(step.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "2-digit",
                      })}
                    </span>
                  )}
                  {completed && step.isBool && (
                    <span className="text-xs text-slate-400">Signed</span>
                  )}
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full">
                      <Clock className="w-2.5 h-2.5" />
                      {daysInStage}d
                    </span>
                  )}
                  {isFuture && (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main drawer
// ---------------------------------------------------------------------------

export default function CaseDrawer({
  kase,
  onClose,
  onSave,
  readOnly = false,
}: CaseDrawerProps) {
  const [notesValue, setNotesValue] = useState(kase.notes ?? "");
  const drawerRef = useRef<HTMLDivElement>(null);
  const showReadOnlyNotice = useReadOnlyNotice();

  useEffect(() => {
    setNotesValue(kase.notes ?? "");
  }, [kase.id, kase.notes]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    drawerRef.current?.focus();
  }, [kase.id]);

  const pipelineValue =
    kase.estimatedLoss != null && kase.feeRate != null
      ? Math.round(kase.estimatedLoss * kase.feeRate)
      : null;

  function handleReadOnlyInteraction(section: string) {
    showReadOnlyNotice(
      `${section} requires configured browser writes or an authenticated save path.`,
      "Case edits unavailable",
    );
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
        aria-label={`Case: ${kase.clientName}`}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] lg:w-[520px] bg-white shadow-drawer
                   flex flex-col animate-slide-in focus:outline-none overflow-hidden"
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 leading-snug truncate">
                {kase.clientName}
              </h2>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{kase.lossAddress}</span>
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

          {/* Status + peril badges */}
          <div className="flex items-center gap-2.5 mt-3 flex-wrap">
            <span className={cn("badge", caseStatusColor(kase.statusPhase))}>
              {caseStatusLabel(kase.statusPhase)}
            </span>
            {kase.perilType && (
              <span className="badge bg-slate-100 text-slate-700 border-slate-200">
                {kase.perilType}
              </span>
            )}
            <span className="text-xs text-slate-400 ml-auto">
              #{kase.fileNumber}
            </span>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {readOnly && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">
                Case edits are disabled in browser anon mode. Keep the app
                read-only until you add a secure server-side or authenticated
                write path.
              </p>
            </section>
          )}

          {/* Case Details */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Case Details
            </h3>
            <div className="space-y-2.5">
              {kase.lossDate && (
                <DetailRow
                  icon={<Calendar className="w-4 h-4" />}
                  label="Loss Date"
                  value={formatDate(kase.lossDate)}
                />
              )}
              {kase.insuranceCompany && (
                <DetailRow
                  icon={<Building2 className="w-4 h-4" />}
                  label="Insurance Company"
                  value={kase.insuranceCompany}
                />
              )}
              {kase.policyNumber && (
                <DetailRow
                  icon={<Hash className="w-4 h-4" />}
                  label="Policy #"
                  value={kase.policyNumber}
                />
              )}
              {kase.claimNumber && (
                <DetailRow
                  icon={<FileText className="w-4 h-4" />}
                  label="Claim #"
                  value={kase.claimNumber}
                />
              )}
              <DetailRow
                icon={<Calendar className="w-4 h-4" />}
                label="Date Logged"
                value={formatDate(kase.dateLogged)}
              />
            </div>
          </section>

          {/* Contact */}
          {(kase.phone || kase.email) && (
            <section>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Contact
              </h3>
              <div className="space-y-2.5">
                {kase.phone && (
                  <DetailRow
                    icon={<Phone className="w-4 h-4 text-green-500" />}
                    label="Phone"
                    value={
                      <a
                        href={`tel:${kase.phone}`}
                        className="text-green-700 hover:text-green-900 hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {kase.phone}
                      </a>
                    }
                  />
                )}
                {kase.email && (
                  <DetailRow
                    icon={<Mail className="w-4 h-4 text-blue-500" />}
                    label="Email"
                    value={
                      <a
                        href={`mailto:${kase.email}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {kase.email}
                      </a>
                    }
                  />
                )}
              </div>
            </section>
          )}

          {/* Financials */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Financials
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-slate-900 score-number">
                  {kase.feeRate != null
                    ? `${Math.round(kase.feeRate * 100)}%`
                    : "—"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Fee Rate</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-emerald-700 score-number">
                  {kase.feeDisbursed != null && kase.feeDisbursed > 0
                    ? `$${kase.feeDisbursed.toLocaleString()}`
                    : "—"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Collected</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-blue-700 score-number">
                  {pipelineValue != null && kase.statusPhase !== "Settled"
                    ? `$${pipelineValue.toLocaleString()}`
                    : kase.estimatedLoss != null
                      ? `$${kase.estimatedLoss.toLocaleString()}`
                      : "—"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {kase.statusPhase === "Settled" ? "Est. Loss" : "Pipeline"}
                </p>
              </div>
            </div>
          </section>

          {/* Process Checklist */}
          <section>
            <Tooltip
              text="Track which documents and milestones have been completed for this case. Click to toggle."
              position="bottom"
            >
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 cursor-help inline-block underline decoration-dotted decoration-slate-300">
                Process Checklist
              </h3>
            </Tooltip>
            <div className="space-y-2">
              {(
                [
                  { key: "lor", label: "LOR Signed", value: kase.lor },
                  {
                    key: "plumbingInvoice",
                    label: "Plumbing Invoice",
                    value: kase.plumbingInvoice,
                  },
                  {
                    key: "waterMitigation",
                    label: "Water Mitigation",
                    value: kase.waterMitigation,
                  },
                ] as const
              ).map(({ key, label, value }) => (
                <button
                  key={key}
                  aria-disabled={readOnly}
                  onClick={() => {
                    if (readOnly) {
                      handleReadOnlyInteraction(`${label} updates`);
                      return;
                    }
                    void onSave(kase.id, { [key]: !value } as CasePatch);
                  }}
                  className={cn(
                    "flex items-center gap-2.5 w-full text-left rounded-lg px-2 py-1.5 transition-colors",
                    readOnly
                      ? "cursor-not-allowed opacity-60"
                      : "hover:bg-slate-50",
                  )}
                >
                  {value ? (
                    <CheckSquare className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  )}
                  <span
                    className={cn(
                      "text-sm",
                      value ? "text-emerald-700 font-medium" : "text-slate-500",
                    )}
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Timeline */}
          <section>
            <Tooltip
              text="Process timeline showing completed milestones and current stage. A blue badge shows days in the current stage — over 30 days triggers a stall warning."
              position="bottom"
            >
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 cursor-help inline-block underline decoration-dotted decoration-slate-300">
                Timeline
              </h3>
            </Tooltip>
            <CaseTimeline kase={kase} />
          </section>

          {/* Status Selector */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Update Status
            </h3>
            <select
              value={kase.statusPhase}
              aria-disabled={readOnly}
              onClick={() => {
                if (readOnly) handleReadOnlyInteraction("Case status changes");
              }}
              onChange={(e) => {
                if (readOnly) {
                  e.preventDefault();
                  handleReadOnlyInteraction("Case status changes");
                  return;
                }
                void onSave(kase.id, {
                  statusPhase: e.target.value as CaseStatusPhase,
                });
              }}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-blue-500",
                caseStatusColor(kase.statusPhase),
                readOnly ? "cursor-not-allowed opacity-60" : "",
              )}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </section>

          {/* Notes */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Notes
              </h3>
            </div>
            <textarea
              rows={3}
              placeholder="Add case notes…"
              value={notesValue}
              readOnly={readOnly}
              onClick={() => {
                if (readOnly) handleReadOnlyInteraction("Case notes");
              }}
              onChange={(e) => {
                if (readOnly) {
                  handleReadOnlyInteraction("Case notes");
                  return;
                }
                setNotesValue(e.target.value);
              }}
              onBlur={() => {
                if (readOnly) return;
                void onSave(kase.id, { notes: notesValue.trim() || undefined });
              }}
              className={cn(
                "w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 resize-none",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                readOnly ? "cursor-not-allowed bg-slate-50 text-slate-400" : "",
              )}
            />
          </section>

          {/* Mailing address (if different from loss address) */}
          {kase.mailingAddress && kase.mailingAddress !== kase.lossAddress && (
            <section>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Mailing Address
              </h3>
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>{kase.mailingAddress}</span>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
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
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-slate-400 flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-xs text-slate-400 block">{label}</span>
        <span className="text-sm text-slate-800 font-medium">{value}</span>
      </div>
    </div>
  );
}
