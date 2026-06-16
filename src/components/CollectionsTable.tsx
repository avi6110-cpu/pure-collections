"use client";

import { useMemo, useState } from "react";
import type { RivhitRow } from "@/lib/parseRivhit";

// ── Formatting ─────────────────────────────────────────────────────────────

const ILS = new Intl.NumberFormat("he-IL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtCurrency(n: number): string {
  return "₪ " + ILS.format(n);
}

// ── Aging ──────────────────────────────────────────────────────────────────

type AgingBand = "fresh" | "yellow" | "red";

function computeAgeDays(documentDateMs: number): number {
  if (!documentDateMs) return 0;
  return Math.max(0, Math.floor((Date.now() - documentDateMs) / 86_400_000));
}

function toBand(days: number): AgingBand {
  if (days >= 60) return "red";
  if (days >= 30) return "yellow";
  return "fresh";
}

const ROW_BG: Record<AgingBand, string> = {
  fresh:  "hover:bg-gray-50",
  yellow: "bg-yellow-50 hover:bg-yellow-100",
  red:    "bg-red-50 hover:bg-red-100",
};

const AGE_BADGE: Record<AgingBand, string> = {
  fresh:  "bg-gray-100 text-gray-600",
  yellow: "bg-yellow-200 text-yellow-900",
  red:    "bg-red-200 text-red-900",
};

// ── Summary card ───────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  sub?: string;
  variant?: "yellow" | "red";
}

function SummaryCard({ label, value, sub, variant }: SummaryCardProps) {
  const border =
    variant === "red"    ? "border-red-200 bg-red-50" :
    variant === "yellow" ? "border-yellow-200 bg-yellow-50" :
                           "border-gray-200 bg-white";
  const valueColor =
    variant === "red"    ? "text-red-700" :
    variant === "yellow" ? "text-yellow-800" :
                           "text-gray-900";
  return (
    <div className={`rounded-lg border p-4 ${border}`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${valueColor}`}>{value}</p>
      {sub !== undefined && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type EnrichedRow = RivhitRow & { ageDays: number; band: AgingBand };

interface CollectionsTableProps {
  rows: RivhitRow[];
}

export function CollectionsTable({ rows }: CollectionsTableProps) {
  const [query, setQuery] = useState("");

  // Enrich once: add computed ageDays + band
  const enriched: EnrichedRow[] = useMemo(
    () =>
      rows.map((r) => {
        const ageDays = computeAgeDays(r.documentDateMs);
        return { ...r, ageDays, band: toBand(ageDays) };
      }),
    [rows]
  );

  // Summary counters from ALL imported rows (not filtered)
  const summary = useMemo(() => {
    let totalBalance = 0;
    let balance30to60 = 0;
    let balance60plus = 0;
    for (const r of enriched) {
      totalBalance += r.remainingBalance;
      if (r.band === "yellow") balance30to60 += r.remainingBalance;
      if (r.band === "red")    balance60plus += r.remainingBalance;
    }
    return { totalRows: enriched.length, totalBalance, balance30to60, balance60plus };
  }, [enriched]);

  // Default sort: remaining balance descending
  const sorted: EnrichedRow[] = useMemo(
    () => [...enriched].sort((a, b) => b.remainingBalance - a.remainingBalance),
    [enriched]
  );

  // Search filter across four fields
  const filtered: EnrichedRow[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (r) =>
        r.customerName.toLowerCase().includes(q) ||
        String(r.documentNumber).includes(q) ||
        r.documentType.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q)
    );
  }, [sorted, query]);

  return (
    <div className="flex flex-col gap-5">

      {/* ── Summary counters ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="רשומות מיובאות"
          value={String(summary.totalRows)}
        />
        <SummaryCard
          label="יתרה כוללת"
          value={fmtCurrency(summary.totalBalance)}
        />
        <SummaryCard
          label="30–60 יום"
          value={fmtCurrency(summary.balance30to60)}
          variant="yellow"
        />
        <SummaryCard
          label="60+ יום"
          value={fmtCurrency(summary.balance60plus)}
          variant="red"
        />
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש: שם לקוח, מס׳ מסמך, סוג מסמך, אסמכתא..."
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />
      </div>

      {/* ── Row count ── */}
      <p className="text-sm text-gray-500">
        מציג{" "}
        <span className="font-semibold text-gray-800">{filtered.length}</span>
        {" "}מתוך{" "}
        <span className="font-semibold text-gray-800">{summary.totalRows}</span>
        {" "}רשומות
      </p>

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <Th>שם לקוח</Th>
              <Th>מסמך</Th>
              <Th numeric>מס׳ מסמך</Th>
              <Th>אסמכתא</Th>
              <Th>תאריך מסמך</Th>
              <Th>גיל חוב</Th>
              <Th>תאריך פרעון</Th>
              <Th numeric>סה״כ למסמך</Th>
              <Th numeric>שולם / נסגר</Th>
              <Th numeric>יתרה לתשלום</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((row, i) => (
              <tr key={i} className={`transition-colors ${ROW_BG[row.band]}`}>
                <Td>{row.customerName}</Td>
                <Td>{row.documentType}</Td>
                <Td numeric>{row.documentNumber}</Td>
                <Td>{row.reference}</Td>
                <Td>{row.documentDate}</Td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${AGE_BADGE[row.band]}`}>
                    {row.ageDays} יום
                  </span>
                </td>
                <Td>{row.dueDate}</Td>
                <Td numeric>{fmtCurrency(row.documentTotal)}</Td>
                <Td numeric>{fmtCurrency(row.paidAmount)}</Td>
                <td
                  className={`whitespace-nowrap px-3 py-2 text-left tabular-nums font-semibold ${
                    row.remainingBalance < 0 ? "text-green-700" : "text-gray-900"
                  }`}
                >
                  {fmtCurrency(row.remainingBalance)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-gray-400">
                  לא נמצאו תוצאות
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Table sub-components ───────────────────────────────────────────────────

function Th({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <th
      className={`whitespace-nowrap border-b border-gray-200 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 ${
        numeric ? "text-left" : "text-right"
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <td
      className={`whitespace-nowrap px-3 py-2 text-gray-700 ${
        numeric ? "text-left tabular-nums" : "text-right"
      }`}
    >
      {children}
    </td>
  );
}
