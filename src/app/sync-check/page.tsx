"use client";

import { useRef, useState, startTransition } from "react";
import type { ReactNode, ChangeEvent } from "react";
import Link from "next/link";
import { extractRivhitRows } from "@/lib/parseRivhit";
import type { RivhitRow } from "@/lib/parseRivhit";
import { ALLOWED_DOC_TYPES } from "@/lib/parseRivhitApi";

// ── Document type maps ────────────────────────────────────────────────────────

const DOC_TYPE_NUM: Readonly<Record<string, number>> = {
  "חשבונית מס": 1,
  "חשבונית מס קבלה": 2,
  "חשבונית מס זיכוי": 3,
  "חשבון חיוב": 8,
};

const DOC_NUM_TYPE: Record<number, string> = {};
for (const [name, num] of Object.entries(DOC_TYPE_NUM)) {
  DOC_NUM_TYPE[num] = name;
}

// ── Case-insensitive field lookup ─────────────────────────────────────────────

/**
 * Finds the first matching key in obj, trying exact match first then
 * case-insensitive match. Returns the ACTUAL key name found (preserves case).
 */
function findKey(
  obj: Record<string, unknown>,
  candidates: readonly string[],
): string | null {
  for (const c of candidates) {
    if (c in obj) return c;
  }
  const objKeys = Object.keys(obj);
  for (const c of candidates) {
    const cl = c.toLowerCase();
    const found = objKeys.find((k) => k.toLowerCase() === cl);
    if (found !== undefined) return found;
  }
  return null;
}

function pickCI(obj: Record<string, unknown>, ...candidates: string[]): unknown {
  const k = findKey(obj, candidates);
  return k !== null ? obj[k] : undefined;
}

/**
 * Finds a document-creation date key. Prefers specific doc-date variants,
 * falls back to any key containing "date" that isn't "due".
 * Handles WCF /Date(ms)/ encoding transparently.
 */
function findDocDateKey(obj: Record<string, unknown>): string | null {
  const specific = findKey(obj, [
    "document_date",
    "documentDate",
    "doc_date",
    "docDate",
    "invoice_date",
    "issue_date",
    "date_created",
    "creation_date",
    "date",
  ]);
  if (specific !== null) return specific;
  const objKeys = Object.keys(obj);
  const fallback = objKeys.find(
    (k) =>
      k.toLowerCase().includes("date") && !k.toLowerCase().includes("due"),
  );
  return fallback ?? null;
}

// ── Date parsing and formatting ───────────────────────────────────────────────

/**
 * Parses a date string in multiple formats and returns a Unix day number.
 * Supports: WCF /Date(ms)/, ISO 2025-04-20, DD/MM/YYYY, DD.MM.YYYY
 */
function parseDateStr(s: string): number | null {
  if (!s) return null;
  // WCF .NET: /Date(1713571200000)/ or /Date(1713571200000+0300)/
  const wcf = /^\/Date\((-?\d+)/.exec(s);
  if (wcf) {
    const ms = Number(wcf[1]);
    return isNaN(ms) ? null : Math.floor(ms / 86_400_000);
  }
  // ISO 2025-04-20
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}`);
    return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 86_400_000);
  }
  // DD/MM/YYYY or DD.MM.YYYY
  const dmy = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/.exec(s);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 86_400_000);
  }
  return null;
}

/**
 * Formats a raw API date value for display.
 * Converts WCF /Date(ms)/ to a he-IL locale string.
 */
function formatApiDate(val: unknown): string {
  const s = String(val ?? "");
  if (!s) return "";
  const wcf = /^\/Date\((-?\d+)/.exec(s);
  if (wcf) {
    const ms = Number(wcf[1]);
    if (!isNaN(ms)) return new Date(ms).toLocaleDateString("he-IL");
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}`);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("he-IL");
  }
  return s;
}

// ── Field coverage spec ───────────────────────────────────────────────────────

interface FieldSpec {
  appField: string;
  label: string;
  candidates: readonly string[];
  note?: string;
  derivedFrom?: string;
  useDateSearch?: boolean;
}

const REQUIRED_FIELDS: readonly FieldSpec[] = [
  {
    appField: "customerName",
    label: "שם לקוח",
    candidates: ["customer_name", "customerName", "client_name", "contact_name"],
  },
  {
    appField: "documentType",
    label: "סוג מסמך",
    candidates: ["document_type", "documentType", "doc_type"],
    note: "מספרי — ימופה לשם מסמך",
  },
  {
    appField: "documentNumber",
    label: "מספר מסמך",
    candidates: ["document_number", "documentNumber", "doc_number"],
  },
  {
    appField: "documentDate",
    label: "תאריך מסמך",
    candidates: [
      "document_date",
      "documentDate",
      "doc_date",
      "docDate",
      "invoice_date",
      "issue_date",
      "creation_date",
      "date",
    ],
    useDateSearch: true,
  },
  {
    appField: "documentDateMs",
    label: "תאריך ms לחישוב גיל",
    candidates: [
      "document_date",
      "documentDate",
      "doc_date",
      "docDate",
      "invoice_date",
      "issue_date",
      "creation_date",
      "date",
    ],
    derivedFrom: "documentDate",
    useDateSearch: true,
  },
  {
    appField: "dueDate",
    label: "תאריך פירעון",
    candidates: ["due_date", "dueDate", "payment_due_date", "maturity_date"],
  },
  {
    appField: "reference",
    label: "אסמכתא",
    candidates: ["reference", "doc_reference", "document_reference", "ref_number"],
  },
  {
    appField: "remainingBalance",
    label: "יתרה לגבייה",
    candidates: [
      "remaining_balance",
      "remainingBalance",
      "remaining_amount",
      "balance",
      "open_amount",
    ],
  },
  {
    appField: "documentTotal",
    label: "סכום מסמך",
    candidates: ["document_total", "documentTotal", "total_amount", "amount"],
  },
  {
    appField: "paidAmount",
    label: "סכום ששולם",
    candidates: ["paid_amount", "paidAmount", "payment_amount", "sum_paid"],
  },
];

interface FieldCoverageEntry {
  appField: string;
  label: string;
  covered: boolean;
  matchedKey: string | null;
  derivedFrom: string | undefined;
  note: string | undefined;
  candidates: readonly string[];
}

function analyzeCoverage(
  rawSample: Record<string, unknown>,
): FieldCoverageEntry[] {
  return REQUIRED_FIELDS.map((spec) => {
    let matchedKey = findKey(rawSample, spec.candidates);
    if (matchedKey === null && spec.useDateSearch === true) {
      matchedKey = findDocDateKey(rawSample);
    }
    return {
      appField: spec.appField,
      label: spec.label,
      covered: matchedKey !== null,
      matchedKey,
      derivedFrom: spec.derivedFrom,
      note: spec.note,
      candidates: spec.candidates,
    };
  });
}

// ── API response helpers ──────────────────────────────────────────────────────

function findDocumentArray(
  data: unknown,
): Record<string, unknown>[] | null {
  if (Array.isArray(data)) {
    if (data.length === 0) return [];
    const first: unknown = data[0];
    if (first !== null && typeof first === "object") {
      const rec = first as Record<string, unknown>;
      if (
        "document_number" in rec ||
        "document_type" in rec ||
        "documentNumber" in rec
      ) {
        return data as Record<string, unknown>[];
      }
    }
  }
  if (data !== null && typeof data === "object") {
    for (const val of Object.values(data as Record<string, unknown>)) {
      const found = findDocumentArray(val);
      if (found !== null) return found;
    }
  }
  return null;
}

// ── Normalized API row ────────────────────────────────────────────────────────

interface NormalizedApiRow {
  customerName: string;
  documentTypeNum: number;
  documentTypeName: string;
  documentNumber: number;
  documentDate: string;
  remainingBalance: number;
  raw: Record<string, unknown>;
}

function normalizeApiRow(obj: Record<string, unknown>): NormalizedApiRow {
  const typeNum = Number(
    pickCI(obj, "document_type", "documentType", "doc_type") ?? 0,
  );
  const typeName: string = DOC_NUM_TYPE[typeNum] ?? `סוג ${typeNum}`;

  // Date: case-insensitive candidates + broad date scan fallback
  const dateKey =
    findKey(obj, [
      "document_date",
      "documentDate",
      "doc_date",
      "docDate",
      "invoice_date",
      "issue_date",
      "creation_date",
      "date",
    ]) ?? findDocDateKey(obj);
  const dateRaw: unknown = dateKey !== null ? obj[dateKey] : undefined;

  return {
    customerName: String(
      pickCI(obj, "customer_name", "customerName", "client_name", "contact_name") ?? "",
    ),
    documentTypeNum: typeNum,
    documentTypeName: typeName,
    documentNumber: Number(
      pickCI(obj, "document_number", "documentNumber", "doc_number") ?? 0,
    ),
    documentDate: formatApiDate(dateRaw),
    remainingBalance: Number(
      pickCI(
        obj,
        "remaining_balance",
        "remainingBalance",
        "remaining_amount",
        "balance",
        "open_amount",
      ) ?? 0,
    ),
    raw: obj,
  };
}

// ── Comparison types ──────────────────────────────────────────────────────────

function toDay(ms: number): number | null {
  return ms > 0 ? Math.floor(ms / 86_400_000) : null;
}

interface FieldMismatch {
  field: string;
  excelValue: string;
  apiValue: string;
}

interface MismatchRow {
  excelRow: RivhitRow;
  apiRow: NormalizedApiRow;
  mismatches: FieldMismatch[];
}

interface ComparisonReport {
  excelTotal: number;
  apiTotal: number;
  matchedCount: number;
  closedSinceExport: RivhitRow[];
  newSinceExport: NormalizedApiRow[];
  fieldMismatches: MismatchRow[];
  unmappedExcelTypes: string[];
  excludedDocTypes: string[];
  apiFieldKeys: string[];
  fieldCoverage: FieldCoverageEntry[] | null;
}

// ── Comparison logic ──────────────────────────────────────────────────────────

const BALANCE_TOLERANCE = 0.02;

function compareFields(
  excel: RivhitRow,
  api: NormalizedApiRow,
): FieldMismatch[] {
  const out: FieldMismatch[] = [];

  if (Math.abs(excel.remainingBalance - api.remainingBalance) > BALANCE_TOLERANCE) {
    out.push({
      field: "remainingBalance",
      excelValue: String(excel.remainingBalance),
      apiValue: String(api.remainingBalance),
    });
  }

  const excelDay = toDay(excel.documentDateMs);
  const apiDay = parseDateStr(api.documentDate);
  if (excelDay !== null && apiDay !== null && excelDay !== apiDay) {
    out.push({
      field: "documentDate",
      excelValue: excel.documentDate,
      apiValue: api.documentDate,
    });
  }

  const en = excel.customerName.trim().toLowerCase();
  const an = api.customerName.trim().toLowerCase();
  if (en && an && en !== an) {
    out.push({
      field: "customerName",
      excelValue: excel.customerName,
      apiValue: api.customerName,
    });
  }

  return out;
}

function runComparison(
  excelRows: RivhitRow[],
  apiRows: NormalizedApiRow[],
): ComparisonReport {
  const unmappedTypes = new Set<string>();
  const excludedTypes = new Set<string>();
  const excelMap = new Map<string, RivhitRow>();
  for (const r of excelRows) {
    const typeNum = DOC_TYPE_NUM[r.documentType.trim()];
    if (typeNum === undefined) {
      unmappedTypes.add(r.documentType);
      continue;
    }
    if (!ALLOWED_DOC_TYPES.has(typeNum)) {
      excludedTypes.add(r.documentType);
      continue;
    }
    excelMap.set(`${typeNum}|${r.documentNumber}`, r);
  }

  const apiMap = new Map<string, NormalizedApiRow>();
  for (const r of apiRows) {
    if (r.documentNumber > 0 && ALLOWED_DOC_TYPES.has(r.documentTypeNum)) {
      apiMap.set(`${r.documentTypeNum}|${r.documentNumber}`, r);
    }
  }

  let matchedCount = 0;
  const closedSinceExport: RivhitRow[] = [];
  const fieldMismatches: MismatchRow[] = [];
  for (const [key, excelRow] of excelMap) {
    const apiRow = apiMap.get(key);
    if (!apiRow) {
      closedSinceExport.push(excelRow);
    } else {
      const mis = compareFields(excelRow, apiRow);
      if (mis.length === 0) {
        matchedCount++;
      } else {
        fieldMismatches.push({ excelRow, apiRow, mismatches: mis });
      }
    }
  }

  const newSinceExport: NormalizedApiRow[] = [];
  for (const [key, apiRow] of apiMap) {
    if (!excelMap.has(key)) newSinceExport.push(apiRow);
  }

  const first = apiRows[0];
  const apiFieldKeys = first !== undefined ? Object.keys(first.raw) : [];
  const fieldCoverage =
    first !== undefined ? analyzeCoverage(first.raw) : null;

  return {
    excelTotal: excelRows.length,
    apiTotal: apiRows.length,
    matchedCount,
    closedSinceExport,
    newSinceExport,
    fieldMismatches,
    unmappedExcelTypes: [...unmappedTypes],
    excludedDocTypes: [...excludedTypes],
    apiFieldKeys,
    fieldCoverage,
  };
}

// ── Formatting ────────────────────────────────────────────────────────────────

const ILS = new Intl.NumberFormat("he-IL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function fmtCurrency(n: number) {
  return "₪ " + ILS.format(n);
}

// ── Page state ────────────────────────────────────────────────────────────────

type PageState =
  | { step: "idle" }
  | { step: "excel_ready"; excelRows: RivhitRow[] }
  | { step: "fetching"; excelRows: RivhitRow[] }
  | {
      step: "fetch_error";
      excelRows: RivhitRow[];
      error: string;
      rawResponse: string | null;
    }
  | {
      step: "done";
      excelRows: RivhitRow[];
      report: ComparisonReport;
      rawSample: unknown;
    };

function getExcelRows(s: PageState): RivhitRow[] {
  if (s.step === "idle") return [];
  return s.excelRows;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SyncCheckPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<PageState>({ step: "idle" });
  const [parseError, setParseError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setParseError(null);
    try {
      const buffer = await file.arrayBuffer();
      const XLSX = await import("xlsx");
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
      const wsName = wb.SheetNames[0];
      if (!wsName) throw new Error("לא נמצא גיליון בקובץ");
      const ws = wb.Sheets[wsName];
      if (!ws) throw new Error("גיליון ריק");
      const rawRows = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: "",
      }) as unknown[][];
      const rows = extractRivhitRows(rawRows);
      if (rows.length === 0) throw new Error("לא נמצאו שורות נתונים בקובץ");
      startTransition(() => setState({ step: "excel_ready", excelRows: rows }));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "שגיאה בקריאת הקובץ");
    }
  }

  async function handleFetch() {
    if (state.step !== "excel_ready" && state.step !== "fetch_error") return;
    const excelRows = state.excelRows;
    startTransition(() => setState({ step: "fetching", excelRows }));

    const extra: Record<string, unknown> = {};
    if (customerId.trim()) extra["customer_id"] = Number(customerId.trim());
    if (fromDate) extra["from_date"] = fromDate;
    if (toDate) extra["to_date"] = toDate;

    try {
      const res = await fetch("/api/rivhit/customer-open-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extra),
      });
      const data: unknown = await res.json();

      if (data !== null && typeof data === "object") {
        const rec = data as Record<string, unknown>;
        if (typeof rec["error"] === "string") {
          startTransition(() =>
            setState({
              step: "fetch_error",
              excelRows,
              error: rec["error"] as string,
              rawResponse: JSON.stringify(data, null, 2).slice(0, 3000),
            }),
          );
          return;
        }
        if (
          typeof rec["error_code"] === "number" &&
          rec["error_code"] !== 0
        ) {
          const msg =
            typeof rec["client_message"] === "string"
              ? rec["client_message"]
              : "שגיאה לא ידועה";
          startTransition(() =>
            setState({
              step: "fetch_error",
              excelRows,
              error: `Rivhit error ${String(rec["error_code"])}: ${msg}`,
              rawResponse: JSON.stringify(data, null, 2).slice(0, 3000),
            }),
          );
          return;
        }
      }

      const docArray = findDocumentArray(data);
      if (docArray === null) {
        startTransition(() =>
          setState({
            step: "fetch_error",
            excelRows,
            error:
              "לא נמצא מערך מסמכים בתגובת ה-API. ייתכן שהנקודת-קצה זקוקה לפרמטרים.",
            rawResponse: JSON.stringify(data, null, 2).slice(0, 3000),
          }),
        );
        return;
      }

      const apiRows = docArray.map(normalizeApiRow);
      const report = runComparison(excelRows, apiRows);
      startTransition(() =>
        setState({ step: "done", excelRows, report, rawSample: data }),
      );
    } catch (err) {
      startTransition(() =>
        setState({
          step: "fetch_error",
          excelRows,
          error: err instanceof Error ? err.message : "שגיאת רשת",
          rawResponse: null,
        }),
      );
    }
  }

  const hasExcel = state.step !== "idle";
  const excelRows = getExcelRows(state);

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="mx-auto max-w-4xl space-y-4">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              בדיקת היתכנות — Rivhit API מול Excel
            </h1>
            <p className="mt-0.5 text-sm text-gray-400">
              בדיקה זמנית בלבד. אינה משנה את תהליך הייבוא הקיים.
            </p>
          </div>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
            ← חזרה לדוחות
          </Link>
        </div>

        {/* Step 1 */}
        <StepCard number={1} title="טעינת קובץ Excel">
          <p className="mb-3 text-sm text-gray-500">
            טען את קובץ הדוח הנוכחי שיוצא מ-Rivhit
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            בחר קובץ Excel
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            onChange={handleFile}
            className="hidden"
          />
          {parseError !== null && (
            <p className="mt-2 text-sm text-red-600">{parseError}</p>
          )}
          {hasExcel && (
            <div className="mt-3">
              <ExcelSummary rows={excelRows} />
            </div>
          )}
        </StepCard>

        {/* Step 2 */}
        {hasExcel && (
          <StepCard number={2} title="קריאה ל-API — Customer.OpenDocuments">
            {state.step === "fetch_error" && (
              <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm">
                <p className="font-medium text-red-700">שגיאה מה-API</p>
                <p className="mt-1 font-mono text-xs text-red-600">
                  {state.error}
                </p>
                {state.rawResponse !== null && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-red-400">
                      תגובה גולמית
                    </summary>
                    <pre
                      className="mt-1 max-h-40 overflow-auto rounded bg-gray-900 p-2 text-xs text-gray-100"
                      dir="ltr"
                    >
                      {state.rawResponse}
                    </pre>
                  </details>
                )}
              </div>
            )}
            {state.step === "done" && (
              <p className="mb-3 text-sm text-green-700">
                ✓ התקבלו {state.report.apiTotal} שורות מה-API
              </p>
            )}
            {state.step === "fetching" ? (
              <p className="text-sm text-gray-400">מושך נתונים מ-Rivhit…</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => { void handleFetch(); }}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {state.step === "fetch_error" ? "נסה שוב" : "קרא ל-API"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  {showAdvanced ? "הסתר פרמטרים ▴" : "פרמטרים מתקדמים ▾"}
                </button>
              </div>
            )}
            {showAdvanced && (
              <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
                <p className="mb-3 text-xs text-gray-400">
                  אם ה-API דורש פרמטרים נוספים, הזן אותם כאן:
                </p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex flex-col gap-0.5 text-xs text-gray-500">
                    מזהה לקוח
                    <input
                      type="number"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      placeholder="ריק = כל הלקוחות"
                      className="mt-0.5 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-xs text-gray-500">
                    מתאריך
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="mt-0.5 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-xs text-gray-500">
                    עד תאריך
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="mt-0.5 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
                    />
                  </label>
                </div>
              </div>
            )}
          </StepCard>
        )}

        {/* Step 3 */}
        {state.step === "done" && (
          <StepCard number={3} title="דוח השוואה">
            <ReportView report={state.report} rawSample={state.rawSample} />
          </StepCard>
        )}

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepCard({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
          {number}
        </span>
        <h2 className="text-base font-semibold text-gray-700">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 font-bold text-gray-900">{value}</p>
    </div>
  );
}

function ExcelSummary({ rows }: { rows: RivhitRow[] }) {
  const customers = new Set(rows.map((r) => r.customerName)).size;
  const total = rows.reduce((s, r) => s + r.remainingBalance, 0);
  const types = [...new Set(rows.map((r) => r.documentType))].join(" · ");
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="שורות" value={String(rows.length)} />
        <Stat label="לקוחות" value={String(customers)} />
        <Stat label="סה״כ יתרה" value={fmtCurrency(total)} />
      </div>
      <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        סוגי מסמכים: {types || "—"}
      </p>
    </div>
  );
}

// ── CoverageTable ─────────────────────────────────────────────────────────────

function CoverageTable({ coverage }: { coverage: FieldCoverageEntry[] }) {
  const missing = coverage.filter((f) => !f.covered);
  const allCovered = missing.length === 0;

  return (
    <div className="space-y-3">
      <div
        className={`rounded-lg px-4 py-3 text-sm font-semibold ${
          allCovered
            ? "bg-green-50 text-green-800"
            : "bg-red-50 text-red-800"
        }`}
      >
        {allCovered
          ? "✅ ה-API יכול להחליף ייבוא Excel — כל השדות הדרושים נמצאו"
          : `⚠️ ה-API אינו יכול להחליף Excel עדיין — ${missing.length} שדות חסרים`}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-right text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 font-medium text-gray-500">שדה נדרש</th>
              <th className="px-3 py-2 font-medium text-gray-500">שם שדה ב-API</th>
              <th className="px-3 py-2 font-medium text-gray-500">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {coverage.map((f) => {
              const isDerived = f.derivedFrom !== undefined;
              const statusText = !f.covered
                ? "⚠️ חסר"
                : isDerived
                ? "✅ נגזר"
                : "✅ נמצא";
              const statusColor = !f.covered
                ? "text-red-500"
                : isDerived
                ? "text-blue-600"
                : "text-green-600";

              return (
                <tr key={f.appField} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <span className="font-medium text-gray-700">{f.label}</span>
                    {f.note !== undefined && (
                      <span className="mr-1 text-[10px] text-gray-400">
                        ({f.note})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2" dir="ltr">
                    {isDerived ? (
                      <span className="text-blue-600">
                        נגזר מ-
                        <code className="rounded bg-blue-50 px-1 py-0.5 text-[11px]">
                          {f.matchedKey ?? f.derivedFrom}
                        </code>
                      </span>
                    ) : f.matchedKey !== null ? (
                      <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] text-gray-700">
                        {f.matchedKey}
                      </code>
                    ) : (
                      <span className="text-gray-300">
                        {[...f.candidates].slice(0, 3).join(" / ")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`font-medium ${statusColor}`}>
                      {statusText}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {missing.length > 0 && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-xs text-red-700">
          <p className="mb-1 font-medium">שמות שדה אפשריים לחיפוש בתגובת ה-API:</p>
          {missing.map((f) => (
            <p key={f.appField} className="mt-0.5 font-mono" dir="ltr">
              {f.appField}: {[...f.candidates].join(" | ")}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ReportView ────────────────────────────────────────────────────────────────

function ReportView({
  report,
  rawSample,
}: {
  report: ComparisonReport;
  rawSample: unknown;
}) {
  return (
    <div className="space-y-5">

      <Section title="כיסוי שדות API">
        {report.fieldCoverage !== null ? (
          <CoverageTable coverage={report.fieldCoverage} />
        ) : (
          <p className="text-sm text-gray-400">
            ה-API לא החזיר שורות — לא ניתן לבדוק כיסוי שדות.
          </p>
        )}
      </Section>

      <Section title="השוואת נתונים — צילום רגע זה">
        <p className="mb-3 text-xs text-gray-400">
          הבדלים בין ה-Excel לבין ה-API צפויים: ה-API הוא תמונת מצב חיה,
          ה-Excel הוא צילום של שעת הייצוא.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="שורות Excel" value={String(report.excelTotal)} />
          <Stat label="שורות API" value={String(report.apiTotal)} />
          <Stat label="תואמות" value={String(report.matchedCount)} />
          <Stat label="נסגרו מאז ייצוא" value={String(report.closedSinceExport.length)} />
          <Stat label="נפתחו מאז ייצוא" value={String(report.newSinceExport.length)} />
          <Stat label="שינויי יתרה" value={String(report.fieldMismatches.length)} />
        </div>
        {report.unmappedExcelTypes.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-medium">
              סוגי מסמך לא ממופים ({report.unmappedExcelTypes.length})
            </p>
            <p className="mt-1 text-xs">
              {report.unmappedExcelTypes.join(", ")}
            </p>
          </div>
        )}
        {report.excludedDocTypes.length > 0 && (
          <div className="mt-3 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
            <p className="font-medium">
              סוגי מסמך שסוננו בכוונה (לא כלולים בהשוואה)
            </p>
            <p className="mt-1 text-xs">
              {report.excludedDocTypes.join(", ")} — רק חשבונית מס, חשבונית מס קבלה וחשבונית מס זיכוי (סוגים 1–3) נכנסות לסנכרון
            </p>
          </div>
        )}
      </Section>

      {(report.closedSinceExport.length > 0 ||
        report.newSinceExport.length > 0 ||
        report.fieldMismatches.length > 0) && (
        <Section title="פירוט הבדלי תזמון (מידע בלבד)">
          <p className="mb-3 text-xs text-gray-400">
            כל ההבדלים למטה נובעים מתנועות שהתרחשו בין שעת ייצוא ה-Excel לרגע
            הקריאה ל-API — צפוי ותקין.
          </p>

          {report.closedSinceExport.length > 0 && (
            <details className="mb-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-blue-700">
                נסגרו / שולמו מאז ייצוא ({report.closedSinceExport.length})
              </summary>
              <div className="mt-3 space-y-1">
                {report.closedSinceExport.map((r, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-4 gap-2 rounded bg-white px-3 py-1.5 text-xs"
                  >
                    <span>{r.documentType}</span>
                    <span dir="ltr">{r.documentNumber}</span>
                    <span className="truncate">{r.customerName}</span>
                    <span className="text-end" dir="ltr">
                      {fmtCurrency(r.remainingBalance)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {report.newSinceExport.length > 0 && (
            <details className="mb-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-blue-700">
                נפתחו מאז ייצוא ({report.newSinceExport.length})
              </summary>
              <div className="mt-3 space-y-1">
                {report.newSinceExport.map((r, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-4 gap-2 rounded bg-white px-3 py-1.5 text-xs"
                  >
                    <span>{r.documentTypeName}</span>
                    <span dir="ltr">{r.documentNumber}</span>
                    <span className="truncate">{r.customerName}</span>
                    <span className="text-end" dir="ltr">
                      {fmtCurrency(r.remainingBalance)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {report.fieldMismatches.length > 0 && (
            <details className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-blue-700">
                שינויי יתרה / תאריך ({report.fieldMismatches.length})
              </summary>
              <div className="mt-3 space-y-2">
                {report.fieldMismatches.map((m, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs"
                  >
                    <p className="font-medium text-gray-700">
                      {m.excelRow.documentType} {m.excelRow.documentNumber} —{" "}
                      {m.excelRow.customerName}
                    </p>
                    {m.mismatches.map((mm, j) => (
                      <div
                        key={j}
                        className="mt-1 grid grid-cols-3 gap-2 text-gray-500"
                      >
                        <span className="text-gray-400">{mm.field}</span>
                        <span dir="ltr">Excel: {mm.excelValue}</span>
                        <span dir="ltr">API: {mm.apiValue}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          )}
        </Section>
      )}

      <Section title="שדות גולמיים מה-API">
        {report.apiFieldKeys.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {report.apiFieldKeys.map((k) => (
              <span
                key={k}
                className="rounded border border-gray-200 bg-white px-2 py-0.5 font-mono text-xs text-gray-600"
              >
                {k}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            אין שדות — ה-API לא החזיר מסמכים.
          </p>
        )}
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-gray-400">
            תגובה גולמית מלאה
          </summary>
          <pre
            className="mt-1 max-h-72 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100"
            dir="ltr"
          >
            {JSON.stringify(rawSample, null, 2).slice(0, 6000)}
          </pre>
        </details>
      </Section>

    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-600">{title}</h3>
      {children}
    </div>
  );
}
