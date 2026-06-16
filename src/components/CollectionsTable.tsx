"use client";

import { useMemo, useState } from "react";
import type { RivhitRow } from "@/lib/parseRivhit";

// ── Formatting ──────────────────────────────────────────────────────────────

const ILS = new Intl.NumberFormat("he-IL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtCurrency(n: number): string {
  return "₪ " + ILS.format(n);
}

function fmtImportDate(ms: number): string {
  return new Date(ms).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

// ── Aging ───────────────────────────────────────────────────────────────────

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
  yellow: "bg-amber-50 hover:bg-amber-100",
  red:    "bg-red-50 hover:bg-red-100",
};

const AGE_BADGE: Record<AgingBand, string> = {
  fresh:  "bg-gray-100 text-gray-600",
  yellow: "bg-amber-200 text-amber-900",
  red:    "bg-red-200 text-red-900",
};

// ── Sorting ─────────────────────────────────────────────────────────────────

type SortColumn =
  | "customerName"
  | "remainingBalance"
  | "ageDays"
  | "documentType"
  | "documentNumber"
  | "documentDate";

type SortDir = "asc" | "desc";

// Which direction to apply on first click of a column
const INITIAL_DIR: Record<SortColumn, SortDir> = {
  customerName:     "asc",
  remainingBalance: "desc",
  ageDays:          "desc",
  documentType:     "asc",
  documentNumber:   "desc",
  documentDate:     "asc",
};

type EnrichedRow = RivhitRow & { ageDays: number; band: AgingBand };

function sortRows(rows: EnrichedRow[], col: SortColumn, dir: SortDir): EnrichedRow[] {
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (col) {
      case "customerName":     cmp = a.customerName.localeCompare(b.customerName, "he"); break;
      case "remainingBalance": cmp = a.remainingBalance - b.remainingBalance;             break;
      case "ageDays":          cmp = a.ageDays          - b.ageDays;                      break;
      case "documentType":     cmp = a.documentType.localeCompare(b.documentType, "he"); break;
      case "documentNumber":   cmp = a.documentNumber   - b.documentNumber;               break;
      case "documentDate":     cmp = a.documentDateMs   - b.documentDateMs;               break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// ── Summary card sub-components ─────────────────────────────────────────────

function PrimaryCard({ value, sub }: { value: string; sub: string }) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-blue-300 bg-blue-600 px-6 py-4 text-white shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">יתרה לגבייה מיידית</p>
      <p className="mt-1 text-3xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-2 text-xs text-blue-300">{sub}</p>
    </div>
  );
}

interface SecondaryCardProps {
  label: string;
  value: string;
  count: number;
  variant: "yellow" | "red" | "neutral";
}

function SecondaryCard({ label, value, count, variant }: SecondaryCardProps) {
  const s = {
    yellow:  { wrap: "border-amber-200 bg-amber-50",  label: "text-amber-700", value: "text-amber-900" },
    red:     { wrap: "border-red-200 bg-red-50",       label: "text-red-700",   value: "text-red-900"   },
    neutral: { wrap: "border-gray-200 bg-white",       label: "text-gray-500",  value: "text-gray-900"  },
  }[variant];
  return (
    <div className={`flex flex-col justify-between rounded-xl border px-4 py-3 ${s.wrap}`}>
      <p className={`text-xs font-semibold ${s.label}`}>{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${s.value}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-400">{count} רשומות</p>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

interface CollectionsTableProps {
  rows: RivhitRow[];
  importedAt: number;
  onNewImport: () => void;
}

export function CollectionsTable({ rows, importedAt, onNewImport }: CollectionsTableProps) {
  const [query,   setQuery]   = useState("");
  const [sortCol, setSortCol] = useState<SortColumn>("remainingBalance");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(col: SortColumn) {
    if (col === sortCol) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(INITIAL_DIR[col]);
    }
  }

  // Enrich once
  const enriched: EnrichedRow[] = useMemo(
    () =>
      rows.map((r) => {
        const ageDays = computeAgeDays(r.documentDateMs);
        return { ...r, ageDays, band: toBand(ageDays) };
      }),
    [rows]
  );

  // Summary always reflects all rows, regardless of search filter
  const summary = useMemo(() => {
    let totalBalance  = 0;
    let balance30to60 = 0;
    let balance60plus = 0;
    let count30to60   = 0;
    let count60plus   = 0;
    for (const r of enriched) {
      totalBalance += r.remainingBalance;
      if (r.band === "yellow") { balance30to60 += r.remainingBalance; count30to60++; }
      if (r.band === "red")    { balance60plus += r.remainingBalance; count60plus++; }
    }
    return { totalRows: enriched.length, totalBalance, balance30to60, balance60plus, count30to60, count60plus };
  }, [enriched]);

  // Search → then sort
  const filtered: EnrichedRow[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter(
      (r) =>
        r.customerName.toLowerCase().includes(q) ||
        String(r.documentNumber).includes(q) ||
        r.documentType.toLowerCase().includes(q)
    );
  }, [enriched, query]);

  const displayed: EnrichedRow[] = useMemo(
    () => sortRows(filtered, sortCol, sortDir),
    [filtered, sortCol, sortDir]
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-base font-bold tracking-tight text-gray-900">PURE COLLECTIONS</span>
          <span className="text-sm text-gray-400">דוחות גבייה</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">
            עודכן: {fmtImportDate(importedAt)}
          </span>
          <button
            type="button"
            onClick={onNewImport}
            className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            ייבוא דוח חדש
          </button>
        </div>
      </header>

      {/* ── Summary strip ───────────────────────────────────────────────── */}
      <section className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="grid grid-cols-4 gap-4">
          <PrimaryCard
            value={fmtCurrency(summary.totalBalance)}
            sub={`${summary.totalRows} רשומות בדוח`}
          />
          <SecondaryCard
            label="60+ יום"
            value={fmtCurrency(summary.balance60plus)}
            count={summary.count60plus}
            variant="red"
          />
          <SecondaryCard
            label="30–60 יום"
            value={fmtCurrency(summary.balance30to60)}
            count={summary.count30to60}
            variant="yellow"
          />
          <SecondaryCard
            label="סה״כ רשומות"
            value={String(summary.totalRows)}
            count={summary.totalRows}
            variant="neutral"
          />
        </div>
      </section>

      {/* ── Search bar ──────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש: שם לקוח, מס׳ מסמך, סוג מסמך..."
            className="w-full max-w-lg rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
          <p className="shrink-0 text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{displayed.length}</span>
            {" "}מתוך{" "}
            <span className="font-semibold text-gray-800">{summary.totalRows}</span>
          </p>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="sticky top-0 z-10">
              <Th col="customerName"     label="שם לקוח"       sortCol={sortCol} sortDir={sortDir} onSort={handleSort} wide />
              <Th col="remainingBalance" label="יתרה לתשלום"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} numeric />
              <Th col="ageDays"          label="זמן חריגה"      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} center />
              <Th col="documentType"     label="מסמך"           sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <Th col="documentNumber"   label="מס׳ מסמך"      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} numeric />
              <Th col="documentDate"     label="תאריך מסמך"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="bg-white">
            {displayed.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-gray-100 transition-colors ${ROW_BG[row.band]}`}
              >
                {/* שם לקוח */}
                <td className="max-w-xs truncate whitespace-nowrap px-4 py-2.5 text-right font-medium text-gray-900">
                  {row.customerName}
                </td>

                {/* יתרה לתשלום — most prominent */}
                <td className="whitespace-nowrap px-4 py-2.5 text-left">
                  <span
                    className={`text-base font-bold tabular-nums ${
                      row.remainingBalance < 0
                        ? "text-green-700"
                        : row.band === "red"
                        ? "text-red-700"
                        : "text-gray-900"
                    }`}
                  >
                    {fmtCurrency(row.remainingBalance)}
                  </span>
                </td>

                {/* זמן חריגה */}
                <td className="whitespace-nowrap px-4 py-2.5 text-center">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${AGE_BADGE[row.band]}`}>
                    {row.ageDays} יום
                  </span>
                </td>

                {/* מסמך */}
                <Td>{row.documentType}</Td>

                {/* מס׳ מסמך */}
                <Td numeric>{row.documentNumber}</Td>

                {/* תאריך מסמך */}
                <Td>{row.documentDate}</Td>
              </tr>
            ))}

            {displayed.length === 0 && (
              <tr>
                <td colSpan={6} className="py-16 text-center text-gray-400">
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

// ── Table sub-components ────────────────────────────────────────────────────

interface ThProps {
  col: SortColumn;
  label: string;
  sortCol: SortColumn;
  sortDir: SortDir;
  onSort: (col: SortColumn) => void;
  numeric?: boolean;
  center?: boolean;
  wide?: boolean;
}

function Th({ col, label, sortCol, sortDir, onSort, numeric, center, wide }: ThProps) {
  const active = sortCol === col;
  const icon   = active ? (sortDir === "asc" ? "↑" : "↓") : "↕";
  return (
    <th
      className={[
        "whitespace-nowrap border-b border-gray-200 bg-gray-50 px-4 py-3",
        "text-xs font-semibold uppercase tracking-wide text-gray-600",
        numeric ? "text-left" : center ? "text-center" : "text-right",
        wide ? "min-w-48" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        className="inline-flex cursor-pointer select-none items-center gap-1 transition-colors hover:text-gray-900"
      >
        {label}
        <span className={active ? "text-blue-600" : "text-gray-300"}>{icon}</span>
      </button>
    </th>
  );
}

function Td({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <td
      className={`whitespace-nowrap px-4 py-2.5 text-gray-700 ${
        numeric ? "text-left tabular-nums" : "text-right"
      }`}
    >
      {children}
    </td>
  );
}
