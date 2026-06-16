"use client";

import { useEffect } from "react";
import type { EnrichedRow } from "@/types/collections";

// ── Formatting ──────────────────────────────────────────────────────────────

const ILS = new Intl.NumberFormat("he-IL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtCurrency(n: number): string {
  return "₪ " + ILS.format(n);
}

// ── Aging badge colours ─────────────────────────────────────────────────────

const BAND_BADGE: Record<EnrichedRow["band"], string> = {
  fresh:  "bg-gray-100 text-gray-600",
  yellow: "bg-amber-200 text-amber-900",
  red:    "bg-red-200 text-red-900",
};

// ── Props ───────────────────────────────────────────────────────────────────

interface DebtorPanelProps {
  row: EnrichedRow | null;
  onClose: () => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export function DebtorPanel({ row, onClose }: DebtorPanelProps) {
  // Close on Escape key — registered only while the panel is open
  useEffect(() => {
    if (!row) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [row, onClose]);

  return (
    <div
      aria-hidden={row === null}
      className={[
        "fixed inset-y-0 right-0 z-30 w-96 bg-white",
        "shadow-[-4px_0_32px_rgba(0,0,0,0.10)]",
        "transition-transform duration-200 ease-out",
        row ? "translate-x-0" : "translate-x-full",
      ].join(" ")}
    >
      {row !== null && (
        <div className="flex h-full flex-col overflow-y-auto">

          {/* ── Header: customer name + close ──────────────────────────── */}
          <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">לקוח</p>
              <h2 className="mt-0.5 text-base font-bold leading-snug text-gray-900">
                {row.customerName}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="סגור פאנל"
              className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {/* ── Balance & aging ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
            <div>
              <p className="text-xs font-medium text-gray-400">זמן חריגה</p>
              <span
                className={`mt-1.5 inline-block rounded-full px-3 py-0.5 text-sm font-semibold ${BAND_BADGE[row.band]}`}
              >
                {row.ageDays} יום
              </span>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-gray-400">יתרה לתשלום</p>
              <p
                className={`mt-0.5 text-2xl font-bold tabular-nums leading-none ${
                  row.remainingBalance < 0
                    ? "text-green-700"
                    : row.band === "red"
                    ? "text-red-700"
                    : "text-gray-900"
                }`}
              >
                {fmtCurrency(row.remainingBalance)}
              </p>
            </div>
          </div>

          {/* ── Document details ────────────────────────────────────────── */}
          <div className="border-b border-gray-200 px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              פרטי מסמך
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="סוג מסמך"    value={row.documentType} />
              <Field label="מס׳ מסמך"    value={String(row.documentNumber)} mono />
              <Field label="תאריך מסמך"  value={row.documentDate} />
              <Field label="תאריך פרעון" value={row.dueDate || "—"} />
              {row.reference !== "" && (
                <div className="col-span-2">
                  <Field label="אסמכתא" value={row.reference} />
                </div>
              )}
            </dl>
          </div>

          {/* ── Financial summary ───────────────────────────────────────── */}
          <div className="px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              סיכום כספי
            </p>
            <dl className="space-y-2.5">
              <FinRow label="סה״כ למסמך"         value={fmtCurrency(row.documentTotal)} />
              <FinRow label="סכום ששולם / נסגר"  value={fmtCurrency(row.paidAmount)} />
            </dl>
            {/* Remaining balance — highlighted footer */}
            <div className="mt-4 flex items-baseline justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <dt className="text-sm font-semibold text-gray-700">יתרה לתשלום</dt>
              <dd
                className={`text-base font-bold tabular-nums ${
                  row.remainingBalance < 0
                    ? "text-green-700"
                    : row.band === "red"
                    ? "text-red-700"
                    : "text-gray-900"
                }`}
              >
                {fmtCurrency(row.remainingBalance)}
              </dd>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium text-gray-900 ${mono ? "tabular-nums" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function FinRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-gray-900">{value}</dd>
    </div>
  );
}
