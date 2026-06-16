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

// ── Styling maps ────────────────────────────────────────────────────────────

const BAND_BADGE: Record<EnrichedRow["band"], string> = {
  fresh:  "bg-gray-100 text-gray-600",
  yellow: "bg-amber-200 text-amber-900",
  red:    "bg-red-200 text-red-900",
};

const CARD_BG: Record<EnrichedRow["band"], string> = {
  fresh:  "bg-white border-gray-200",
  yellow: "bg-amber-50 border-amber-200",
  red:    "bg-red-50 border-red-200",
};

// ── Props ───────────────────────────────────────────────────────────────────

interface CustomerPanelProps {
  customerRows: EnrichedRow[];      // all open docs for this customer
  clickedRow:   EnrichedRow | null; // the row that was clicked (null = panel closed)
  onClose:      () => void;
}

// ── Main component ──────────────────────────────────────────────────────────

export function CustomerPanel({ customerRows, clickedRow, onClose }: CustomerPanelProps) {
  // Close on Escape — only while panel is open
  useEffect(() => {
    if (!clickedRow) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [clickedRow, onClose]);

  // Customer-level aggregates
  const customerName  = clickedRow?.customerName ?? "";
  const totalBalance  = customerRows.reduce((s, r) => s + r.remainingBalance, 0);
  const docCount      = customerRows.length;
  const maxAgeDays    = customerRows.reduce((m, r) => Math.max(m, r.ageDays), 0);
  const balance60plus = customerRows
    .filter((r) => r.band === "red")
    .reduce((s, r) => s + r.remainingBalance, 0);

  // Documents sorted: most overdue first
  const sortedDocs = [...customerRows].sort((a, b) => b.ageDays - a.ageDays);

  return (
    <div
      aria-hidden={clickedRow === null}
      className={[
        "fixed inset-y-0 right-0 z-30 w-[28rem] bg-white",
        "shadow-[-4px_0_32px_rgba(0,0,0,0.10)]",
        "transition-transform duration-200 ease-out",
        clickedRow ? "translate-x-0" : "translate-x-full",
      ].join(" ")}
    >
      {clickedRow !== null && (
        <div className="flex h-full flex-col overflow-hidden">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">לקוח</p>
              <h2 className="mt-0.5 text-base font-bold leading-snug text-gray-900">
                {customerName}
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

          {/* ── Customer summary ─────────────────────────────────────────── */}
          <div className="shrink-0 border-b border-gray-200 bg-gray-50 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <SummaryItem
                label="יתרה כוללת"
                value={fmtCurrency(totalBalance)}
                size="large"
              />
              <SummaryItem
                label="מסמכים פתוחים"
                value={String(docCount)}
              />
              <SummaryItem
                label="זמן חריגה מקסימלי"
                value={`${maxAgeDays} יום`}
              />
              <SummaryItem
                label="יתרה 60+ יום"
                value={balance60plus > 0 ? fmtCurrency(balance60plus) : "—"}
                variant={balance60plus > 0 ? "red" : "neutral"}
              />
            </div>
          </div>

          {/* ── Document list ────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {docCount === 1 ? "מסמך פתוח אחד" : `${docCount} מסמכים פתוחים`}
            </p>
            <div className="space-y-2">
              {sortedDocs.map((doc) => (
                <DocCard
                  key={doc.documentNumber}
                  doc={doc}
                  isClicked={doc.documentNumber === clickedRow.documentNumber}
                />
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface SummaryItemProps {
  label: string;
  value: string;
  size?: "large";
  variant?: "red" | "neutral";
}

function SummaryItem({ label, value, size, variant }: SummaryItemProps) {
  const valueColor =
    variant === "red" ? "text-red-700" : "text-gray-900";
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
      <p className="text-xs text-gray-400">{label}</p>
      <p
        className={`mt-0.5 font-bold tabular-nums ${
          size === "large" ? "text-base" : "text-sm"
        } ${valueColor}`}
      >
        {value}
      </p>
    </div>
  );
}

interface DocCardProps {
  doc:       EnrichedRow;
  isClicked: boolean;
}

function DocCard({ doc, isClicked }: DocCardProps) {
  const cardBg = isClicked
    ? "border-blue-300 bg-blue-50"
    : CARD_BG[doc.band];

  const balanceColor =
    doc.remainingBalance < 0
      ? "text-green-700"
      : doc.band === "red"
      ? "text-red-700"
      : "text-gray-900";

  return (
    <div className={`rounded-lg border px-4 py-3 ${cardBg}`}>

      {/* Line 1: document type · number  |  balance */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-right text-sm font-semibold text-gray-900">
          {doc.documentType}
          <span className="mx-1 text-gray-300">·</span>
          <span className="font-normal tabular-nums text-gray-600">
            {doc.documentNumber}
          </span>
        </p>
        <p className={`shrink-0 text-left text-sm font-bold tabular-nums ${balanceColor}`}>
          {fmtCurrency(doc.remainingBalance)}
        </p>
      </div>

      {/* Line 2: dates  |  aging badge */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="text-right text-xs text-gray-500">
          {doc.documentDate}
          {doc.dueDate !== "" && (
            <span className="text-gray-400"> · פרעון: {doc.dueDate}</span>
          )}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${BAND_BADGE[doc.band]}`}
        >
          {doc.ageDays} יום
        </span>
      </div>

    </div>
  );
}
