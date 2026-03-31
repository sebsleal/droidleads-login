import { useState, useEffect, useRef } from "react";
import { X, Briefcase, User, MapPin, Building2, AlertCircle } from "lucide-react";
import type { Lead, DamageType } from "@/types";
import { cn } from "@/lib/utils";
import { displayOwnerName } from "@/lib/utils";

interface ConvertToCaseModalProps {
  lead: Lead;
  onClose: () => void;
  onConvert: (caseData: {
    clientName: string;
    lossAddress: string;
    mailingAddress?: string;
    lossDate?: string;
    perilType?: string;
    insuranceCompany?: string;
    phone?: string;
    email?: string;
    claimNumber?: string;
    policyNumber?: string;
    estimatedLoss?: number;
    notes?: string;
  }) => void;
}

export default function ConvertToCaseModal({
  lead,
  onClose,
  onConvert,
}: ConvertToCaseModalProps) {
  const [clientName, setClientName] = useState(() => {
    const { display } = displayOwnerName(lead.ownerName);
    return display;
  });
  const [lossAddress, setLossAddress] = useState(
    `${lead.propertyAddress}, ${lead.city}, FL ${lead.zip}`,
  );
  const [mailingAddress, setMailingAddress] = useState(
    lead.ownerMailingAddress ?? "",
  );
  const [lossDate, setLossDate] = useState(
    lead.permitDate ?? new Date().toISOString().split("T")[0],
  );
  const [perilType, setPerilType] = useState<DamageType>(lead.damageType as DamageType);
  const [insuranceCompany, setInsuranceCompany] = useState(
    lead.insuranceCompany ?? "",
  );
  const [phone, setPhone] = useState(lead.contact?.phone ?? "");
  const [email, setEmail] = useState(lead.contact?.email ?? "");
  const [estimatedLoss, setEstimatedLoss] = useState(
    lead.claimValue != null ? String(lead.claimValue) : "",
  );
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim() || !lossAddress.trim()) return;

    setIsSubmitting(true);
    onConvert({
      clientName: clientName.trim(),
      lossAddress: lossAddress.trim(),
      mailingAddress: mailingAddress.trim() || undefined,
      lossDate: lossDate || undefined,
      perilType: perilType || undefined,
      insuranceCompany: insuranceCompany.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      estimatedLoss: estimatedLoss ? parseFloat(estimatedLoss) : undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label="Convert lead to case"
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto flex flex-col max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Convert to Case
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Pre-filled from lead record
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="px-6 py-5 space-y-5">
              {/* Lead source indicator */}
              <div className="flex items-start gap-2.5 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  Converting lead for{" "}
                  <span className="font-semibold">
                    {displayOwnerName(lead.ownerName).display}
                  </span>{" "}
                  at{" "}
                  <span className="font-semibold">
                    {lead.propertyAddress}, {lead.city}
                  </span>
                  . Review and edit fields before creating the case.
                </div>
              </div>

              {/* Client Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Client Name <span className="text-red-500">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                  className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Loss Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Loss Address <span className="text-red-500">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  value={lossAddress}
                  onChange={(e) => setLossAddress(e.target.value)}
                  required
                  className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Mailing Address (optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Mailing Address
                  </span>
                  <span className="text-slate-400 normal-case font-normal ml-1">(if different)</span>
                </label>
                <input
                  type="text"
                  value={mailingAddress}
                  onChange={(e) => setMailingAddress(e.target.value)}
                  placeholder="Optional"
                  className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Row: Loss Date + Peril Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Loss Date
                  </label>
                  <input
                    type="date"
                    value={lossDate}
                    onChange={(e) => setLossDate(e.target.value)}
                    className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Peril Type
                  </label>
                  <select
                    value={perilType}
                    onChange={(e) => setPerilType(e.target.value as DamageType)}
                    className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Hurricane/Wind">Hurricane/Wind</option>
                    <option value="Flood">Flood</option>
                    <option value="Roof">Roof</option>
                    <option value="Fire">Fire</option>
                    <option value="Structural">Structural</option>
                    <option value="Accidental Discharge">Accidental Discharge</option>
                  </select>
                </div>
              </div>

              {/* Insurance Company */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Insurance Company
                  </span>
                </label>
                <input
                  type="text"
                  value={insuranceCompany}
                  onChange={(e) => setInsuranceCompany(e.target.value)}
                  placeholder="e.g. Citizens Property Insurance"
                  className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Row: Phone + Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Optional"
                    className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Optional"
                    className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Estimated Loss */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Estimated Loss
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={estimatedLoss}
                    onChange={(e) => setEstimatedLoss(e.target.value)}
                    placeholder="From lead claim value"
                    className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Pre-filled from lead notes"
                  className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !clientName.trim() || !lossAddress.trim()}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isSubmitting || !clientName.trim() || !lossAddress.trim()
                    ? "bg-emerald-300 text-white cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
                )}
              >
                {isSubmitting ? "Creating..." : "Create Case"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
