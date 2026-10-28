import { useState, useEffect } from "react";
import { AlertTriangle, ShieldAlert, Trash2, X, Check, Building2, School } from "lucide-react";

export type ConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options?: { scope?: "SCHOOL_ONLY" | "ALL_ORGANIZATION" }) => Promise<void> | void;
  title: string;
  description: string;
  targetName?: string;
  targetType?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  requireKeyword?: string;
  showMultiSchoolScope?: boolean;
  isLoading?: boolean;
  scope?: "SCHOOL_ONLY" | "ALL_ORGANIZATION";
  onScopeChange?: (scope: "SCHOOL_ONLY" | "ALL_ORGANIZATION") => void;
};

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  targetName,
  targetType,
  confirmText = "Haa, Tirtir",
  cancelText = "Ka Noqo",
  isDestructive = true,
  requireKeyword,
  showMultiSchoolScope = false,
  isLoading = false,
  scope: controlledScope,
  onScopeChange,
}: ConfirmModalProps) {
  const [keywordInput, setKeywordInput] = useState("");
  const [internalScope, setInternalScope] = useState<"SCHOOL_ONLY" | "ALL_ORGANIZATION">("SCHOOL_ONLY");
  const scope = controlledScope ?? internalScope;
  const setScope = (val: "SCHOOL_ONLY" | "ALL_ORGANIZATION") => {
    setInternalScope(val);
    onScopeChange?.(val);
  };
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKeywordInput("");
      setInternalScope("SCHOOL_ONLY");
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const keywordMatched = !requireKeyword || keywordInput.trim().toUpperCase() === requireKeyword.trim().toUpperCase();

  async function handleConfirm() {
    if (!keywordMatched || submitting || isLoading) return;
    setSubmitting(true);
    try {
      await onConfirm({ scope });
      onClose();
    } catch {
      // Error handled by caller
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Icon + Close */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
                isDestructive
                  ? "bg-rose-50 text-rose-600 border border-rose-100 ring-4 ring-rose-50/50"
                  : "bg-amber-50 text-amber-600 border border-amber-100 ring-4 ring-amber-50/50"
              }`}
            >
              {isDestructive ? <AlertTriangle className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h3>
              {targetType && (
                <span className="inline-block mt-0.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {targetType}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Target Name Badge (if provided) */}
        {targetName && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Target</div>
              <div className="text-sm font-bold text-slate-900">{targetName}</div>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isDestructive ? "bg-rose-100/70 text-rose-700" : "bg-amber-100/70 text-amber-700"
              }`}
            >
              {isDestructive ? "Tirtirid / Deletion" : "Xaaladda / Status"}
            </span>
          </div>
        )}

        {/* Description / Explanation Text */}
        <p className="text-sm text-slate-600 leading-relaxed">{description}</p>

        {/* Super Admin / Multi-School Scope Selector */}
        {showMultiSchoolScope && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span>Xulo Xadka Tirtiridda (Deletion Scope)</span>
            </div>
            <p className="text-xs text-slate-500">
              Maadaama aad tahay Super Admin ama qofkani ka tirsan karo dugsiyo kale:
            </p>

            <div className="grid gap-2">
              <label
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                  scope === "SCHOOL_ONLY"
                    ? "border-blue-500 bg-white shadow-sm ring-1 ring-blue-500"
                    : "border-slate-200 bg-white/70 hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="deletionScope"
                  value="SCHOOL_ONLY"
                  checked={scope === "SCHOOL_ONLY"}
                  onChange={() => setScope("SCHOOL_ONLY")}
                  className="mt-0.5 accent-blue-600"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <School className="h-3.5 w-3.5 text-blue-600" />
                    <span>Dugsigan hadda oo kaliya ka saar (School Only)</span>
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    Haddii qofkani carruur ama xil ku leeyahay dugsiyo kale, saamayn kuma yeelanayso dugsiyadaas kale.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                  scope === "ALL_ORGANIZATION"
                    ? "border-rose-500 bg-white shadow-sm ring-1 ring-rose-500"
                    : "border-slate-200 bg-white/70 hover:bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="deletionScope"
                  value="ALL_ORGANIZATION"
                  checked={scope === "ALL_ORGANIZATION"}
                  onChange={() => setScope("ALL_ORGANIZATION")}
                  className="mt-0.5 accent-rose-600"
                />
                <div className="text-xs">
                  <div className="font-bold text-rose-700 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-rose-600" />
                    <span>Dhammaan ururka/schools-ka oo dhan ka tirtir (All Organization)</span>
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    Waxaa gebi ahaanba la tirtiri doonaa koontada iyo dhammaan xogtiisa ururka oo dhan.
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Keyword Requirement (if any) */}
        {requireKeyword && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Fadlan qor <span className="font-mono font-bold text-rose-600">{requireKeyword}</span> si aad u xaqiijiso:
            </label>
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder={`Geli "${requireKeyword}"`}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-mono font-semibold text-slate-900 focus:bg-white focus:border-rose-500 focus:outline-none transition uppercase"
              autoFocus
            />
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || isLoading}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!keywordMatched || submitting || isLoading}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${
              isDestructive
                ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20"
                : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
            }`}
          >
            {submitting || isLoading ? (
              <span>Fadlan sug...</span>
            ) : (
              <>
                {isDestructive ? <Trash2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
