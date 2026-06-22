// ── Document type constants ───────────────────────────────────────────────────

export const CREDIT_INVOICE_TYPE = "חשבונית מס זיכוי" as const;

// ── Public row type ───────────────────────────────────────────────────────────

export interface RivhitRow {
  customerName:     string;
  documentType:     string;
  documentNumber:   number;
  reference:        string;
  documentDate:     string;   // formatted he-IL string for display
  documentDateMs:   number;   // Unix ms for age computation (0 if missing)
  dueDate:          string;
  documentTotal:    number;
  paidAmount:       number;
  remainingBalance: number;
}

// ── Stable cross-source key ───────────────────────────────────────────────────

/**
 * Stable key used as the StatusMap index.
 * Does NOT include documentDate — date formatting differs between Excel and API imports.
 */
export function docStatusKey(
  row: Pick<RivhitRow, "customerName" | "documentType" | "documentNumber">,
): string {
  return `${row.customerName}|${row.documentType}|${row.documentNumber}`;
}

// ── Value coercers ────────────────────────────────────────────────────────────

function asString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  return 0;
}

function excelSerialToDate(v: unknown): string {
  if (typeof v !== "number" || v <= 0) return "";
  const ms = Math.round((v - 25569) * 86400 * 1000);
  return new Date(ms).toLocaleDateString("he-IL");
}

function excelSerialToMs(v: unknown): number {
  if (typeof v !== "number" || v <= 0) return 0;
  return Math.round((v - 25569) * 86400 * 1000);
}

// ── Header-based column detection ─────────────────────────────────────────────

// Invisible Unicode characters Rivhit embeds in cell strings.
// Standard .trim() misses them; they must be stripped before header comparison.
const INVIS_RE = /[­​‌‍‎‏﻿]/g;

function normalizeHeader(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(INVIS_RE, "").trim();
}

// Logical field names that map to RivhitRow fields.
type FieldName =
  | "remainingBalance"
  | "paidAmount"
  | "documentTotal"
  | "dueDate"
  | "documentDate"
  | "reference"
  | "documentNumber"
  | "documentType"
  | "customerName";

// Header candidates per field.
// Ordered most-specific → least-specific within each array.
// Generic single-word headers (e.g. "שם", "תאריך") are intentionally excluded
// to avoid false matches against preamble or summary rows.
const FIELD_CANDIDATES: Record<FieldName, string[]> = {
  remainingBalance: ["יתרה לגבייה", "יתרה לתשלום", "יתרה פתוחה", "סכום פתוח"],
  paidAmount:       ["סכום ששולם", "שולם", "תשלומים"],
  documentTotal:    ['סכום מסמך', 'סה"כ מסמך', "סכום חשבונית", 'סה"כ חשבונית'],
  dueDate:          ["תאריך פירעון", "ת. פירעון", "פירעון"],
  documentDate:     ["תאריך מסמך", "ת. מסמך", "תאריך חשבונית", "ת. חשבונית"],
  reference:        ["אסמכתא", "מסמך מקור", "הפניה", "מספר הפניה"],
  documentNumber:   ["מס' מסמך", "מספר מסמך", "מס מסמך", "מס. מסמך"],
  documentType:     ["סוג מסמך"],
  customerName:     ["שם לקוח", "שם חברה"],
};

// Fields that must be present; import fails loudly if any are missing.
const REQUIRED_FIELDS: FieldName[] = [
  "documentNumber",
  "customerName",
  "remainingBalance",
  "documentDate",
];

// Label shown in the Hebrew error message when a required field is absent.
const FIELD_LABEL: Record<FieldName, string> = {
  remainingBalance: "יתרה לגבייה",
  paidAmount:       "סכום ששולם",
  documentTotal:    "סכום מסמך",
  dueDate:          "תאריך פירעון",
  documentDate:     "תאריך מסמך",
  reference:        "אסמכתא",
  documentNumber:   "מס' מסמך",
  documentType:     "סוג מסמך",
  customerName:     "שם לקוח",
};

// Flattened set of every recognized header string, used to detect the header row.
const ALL_RECOGNIZED = new Set<string>(
  (Object.values(FIELD_CANDIDATES) as string[][]).flat(),
);

// A row qualifies as the header row when it contains at least 3 recognized
// header strings. Threshold of 3 tolerates minor label changes while being
// strict enough to exclude preamble rows (company name, report title, etc.).
function isHeaderRow(row: unknown[]): boolean {
  let hits = 0;
  for (const cell of row) {
    if (ALL_RECOGNIZED.has(normalizeHeader(cell))) {
      hits++;
      if (hits >= 3) return true;
    }
  }
  return false;
}

type ColMap = Record<FieldName, number | null>;

function buildColMap(headerRow: unknown[]): ColMap {
  const normalized = headerRow.map(normalizeHeader);

  const result: ColMap = {
    remainingBalance: null,
    paidAmount:       null,
    documentTotal:    null,
    dueDate:          null,
    documentDate:     null,
    reference:        null,
    documentNumber:   null,
    documentType:     null,
    customerName:     null,
  };

  for (const field of Object.keys(FIELD_CANDIDATES) as FieldName[]) {
    for (const candidate of FIELD_CANDIDATES[field]) {
      const idx = normalized.indexOf(candidate);
      if (idx !== -1) {
        result[field] = idx;
        break; // first match wins; candidates are ordered most→least specific
      }
    }
  }

  return result;
}

function pick(row: unknown[], idx: number | null): unknown {
  return idx !== null ? row[idx] : undefined;
}

// ── Public parser ─────────────────────────────────────────────────────────────

/**
 * Converts raw rows from XLSX.utils.sheet_to_json(ws, { header: 1 }) into
 * typed RivhitRow objects using header-name detection instead of fixed indexes.
 *
 * Throws a Hebrew Error if:
 *   - No header row is found (file is not a recognizable Rivhit export)
 *   - Any required column (documentNumber, customerName, remainingBalance,
 *     documentDate) is absent from the header row
 */
export function extractRivhitRows(rawRows: unknown[][]): RivhitRow[] {
  // 1. Locate the header row by scanning top-to-bottom
  const headerIdx = rawRows.findIndex(isHeaderRow);
  if (headerIdx === -1) {
    throw new Error(
      "לא נמצאה שורת כותרות בקובץ. " +
      "ודא שהקובץ יוצא מ-Rivhit עם עמודות סטנדרטיות " +
      "(כגון \"יתרה לגבייה\", \"מס' מסמך\", \"שם לקוח\").",
    );
  }

  // 2. Map each recognized field name to its column index
  // noUncheckedIndexedAccess requires an explicit guard even after findIndex
  const headerRow = rawRows[headerIdx];
  if (headerRow === undefined) {
    throw new Error("שגיאה פנימית: שורת כותרות נמצאה אך לא ניתן לקרוא אותה.");
  }
  const colMap = buildColMap(headerRow);

  // 3. Fail loudly if any required column is missing
  const missing = REQUIRED_FIELDS.filter((f) => colMap[f] === null);
  if (missing.length > 0) {
    const labels = missing.map((f) => `"${FIELD_LABEL[f]}"`).join(", ");
    throw new Error(
      `חסרות עמודות נדרשות בקובץ: ${labels}. ` +
      "בדוק שהקובץ יוצא מ-Rivhit במבנה המלא ושלא חסרות עמודות.",
    );
  }

  // 4. Parse data rows that follow the header
  // A row is a real document row when its documentNumber cell holds a positive integer.
  // This excludes preamble rows, the header row itself, customer subtotals, and totals.
  return rawRows
    .slice(headerIdx + 1)
    .filter((row) => {
      const v = pick(row, colMap.documentNumber);
      return typeof v === "number" && Number.isInteger(v) && v > 0;
    })
    .map((row) => ({
      customerName:     asString(pick(row, colMap.customerName)),
      documentType:     asString(pick(row, colMap.documentType)),
      documentNumber:   asNumber(pick(row, colMap.documentNumber)),
      reference:        asString(pick(row, colMap.reference)),
      documentDate:     excelSerialToDate(pick(row, colMap.documentDate)),
      documentDateMs:   excelSerialToMs(pick(row, colMap.documentDate)),
      dueDate:          excelSerialToDate(pick(row, colMap.dueDate)),
      documentTotal:    asNumber(pick(row, colMap.documentTotal)),
      paidAmount:       asNumber(pick(row, colMap.paidAmount)),
      remainingBalance: asNumber(pick(row, colMap.remainingBalance)),
    }));
}
