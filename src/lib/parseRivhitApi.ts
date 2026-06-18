import type { RivhitRow } from "@/lib/parseRivhit";

// ── Document type mapping ─────────────────────────────────────────────────────

const DOC_TYPE_NUM: Readonly<Record<string, number>> = {
  "חשבונית מס":       1,
  "חשבונית מס קבלה": 2,
  "חשבונית מס זיכוי": 3,
  "חשבון חיוב":       8,
};

const DOC_NUM_TYPE: Record<number, string> = {};
for (const [name, num] of Object.entries(DOC_TYPE_NUM)) {
  DOC_NUM_TYPE[num] = name;
}

/**
 * Only these Rivhit document types are imported by API sync.
 * Other types (e.g. חשבון חיוב = 8, delivery notes, quotes) are excluded.
 */
export const ALLOWED_DOC_TYPES = new Set<number>([1, 2, 3]);

// ── Case-insensitive field helpers ────────────────────────────────────────────

function findKey(obj: Record<string, unknown>, candidates: readonly string[]): string | null {
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

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Finds the document-creation date key. Tries specific names first,
 * falls back to any key containing "date" that isn't "due".
 */
function findDocDateKey(obj: Record<string, unknown>): string | null {
  const key = findKey(obj, [
    "document_date", "documentDate", "doc_date", "docDate",
    "invoice_date", "issue_date", "creation_date", "date",
  ]);
  if (key !== null) return key;
  const objKeys = Object.keys(obj);
  return (
    objKeys.find(
      (k) => k.toLowerCase().includes("date") && !k.toLowerCase().includes("due"),
    ) ?? null
  );
}

/** Converts a raw API date value to Unix milliseconds. */
function toMs(val: unknown): number {
  const s = String(val ?? "");
  if (!s) return 0;
  // WCF .NET: /Date(1713571200000)/ or /Date(ms+offset)/
  const wcf = /^\/Date\((-?\d+)/.exec(s);
  if (wcf) {
    const ms = Number(wcf[1]);
    return isNaN(ms) ? 0 : ms;
  }
  // ISO: 2025-04-20
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}`);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  // DD/MM/YYYY or DD.MM.YYYY
  const dmy = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/.exec(s);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}

/** Formats a raw API date value as a he-IL locale string for display. */
function formatDate(val: unknown): string {
  const ms = toMs(val);
  if (ms === 0) return String(val ?? "");
  return new Date(ms).toLocaleDateString("he-IL");
}

// ── Row converter ─────────────────────────────────────────────────────────────

/** Converts one raw Customer.OpenDocuments document object to a RivhitRow. */
export function apiDocToRivhitRow(doc: Record<string, unknown>): RivhitRow {
  const typeNum = Number(
    pickCI(doc, "document_type", "documentType", "doc_type") ?? 0,
  );
  const typeName: string = DOC_NUM_TYPE[typeNum] ?? `סוג ${typeNum}`;

  const dateKey = findDocDateKey(doc);
  const dateRaw: unknown = dateKey !== null ? doc[dateKey] : undefined;
  const dateMs = toMs(dateRaw);

  const dueDateKey = findKey(doc, ["due_date", "dueDate", "payment_due_date", "maturity_date"]);
  const dueRaw: unknown = dueDateKey !== null ? doc[dueDateKey] : undefined;

  return {
    customerName:    String(pickCI(doc, "customer_name", "customerName", "client_name", "contact_name") ?? ""),
    documentType:    typeName,
    documentNumber:  Number(pickCI(doc, "document_number", "documentNumber", "doc_number") ?? 0),
    reference:       String(pickCI(doc, "reference", "doc_reference", "document_reference", "ref_number") ?? ""),
    documentDate:    dateMs > 0 ? new Date(dateMs).toLocaleDateString("he-IL") : formatDate(dateRaw),
    documentDateMs:  dateMs,
    dueDate:         dueRaw !== undefined ? formatDate(dueRaw) : "",
    documentTotal:   Number(pickCI(doc, "document_total", "documentTotal", "total_amount", "amount") ?? 0),
    paidAmount:      Number(pickCI(doc, "paid_amount", "paidAmount", "payment_amount", "sum_paid") ?? 0),
    remainingBalance: Number(
      pickCI(doc, "remaining_balance", "remainingBalance", "remaining_amount", "balance", "open_amount") ?? 0,
    ),
  };
}

// ── Response parser ───────────────────────────────────────────────────────────

/** Recursively finds the first array that looks like a document list. */
function findDocumentArray(data: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(data)) {
    if (data.length === 0) return [];
    const first: unknown = data[0];
    if (first !== null && typeof first === "object") {
      const rec = first as Record<string, unknown>;
      if ("document_number" in rec || "document_type" in rec || "documentNumber" in rec) {
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

/**
 * Parses a raw Customer.OpenDocuments API response into RivhitRow[].
 * Returns null if the response is an error or contains no document array.
 */
export function parseApiResponse(data: unknown): RivhitRow[] | null {
  if (data === null || typeof data !== "object") return null;
  const rec = data as Record<string, unknown>;

  // Proxy error
  if (typeof rec["error"] === "string") return null;

  // Rivhit API error
  if (typeof rec["error_code"] === "number" && rec["error_code"] !== 0) return null;

  const docArray = findDocumentArray(data);
  if (docArray === null) return null;

  const allowed = docArray.filter((doc) => {
    const typeNum = Number(
      pickCI(doc, "document_type", "documentType", "doc_type") ?? 0,
    );
    return ALLOWED_DOC_TYPES.has(typeNum);
  });

  return allowed.map(apiDocToRivhitRow);
}

/**
 * Extracts a human-readable error message from a raw API response,
 * for use in error UI.
 */
export function extractApiError(data: unknown): string {
  if (data === null || typeof data !== "object") return "שגיאת רשת";
  const rec = data as Record<string, unknown>;
  if (typeof rec["error"] === "string") return rec["error"];
  if (typeof rec["error_code"] === "number" && rec["error_code"] !== 0) {
    const msg = typeof rec["client_message"] === "string" ? rec["client_message"] : "";
    return msg || `שגיאת API (${String(rec["error_code"])})`;
  }
  return "תגובה לא צפויה מה-API";
}

// ── Customer contact helpers ──────────────────────────────────────────────────

// Removes invisible Unicode characters that Israeli accounting systems embed in strings.
// Standard .trim() only strips ASCII whitespace — these survive and corrupt mailto: URLs.
// ­ soft-hyphen, ​ zero-width space, ‌‍ ZW non/joiner,
// ‎‏ LTR/RTL marks, ﻿ BOM.
const INVIS_RE = new RegExp("[­​‌‍‎‏﻿]", "g");

export interface ApiContactFields {
  phone: string;
  email: string;
}

/** Finds the first array that looks like a customer list. */
function findCustomerArray(data: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(data)) {
    if (data.length === 0) return [];
    const first: unknown = data[0];
    if (first !== null && typeof first === "object") {
      const rec = first as Record<string, unknown>;
      const hasId = "customer_id" in rec || "customerId" in rec || "client_id" in rec;
      const hasContact =
        "phone" in rec || "email" in rec ||
        "customer_name" in rec || "customerName" in rec;
      if (hasId && hasContact) return data as Record<string, unknown>[];
    }
  }
  if (data !== null && typeof data === "object") {
    for (const val of Object.values(data as Record<string, unknown>)) {
      const found = findCustomerArray(val);
      if (found !== null) return found;
    }
  }
  return null;
}

/**
 * Extracts a Map of customer_id → customerName from a raw
 * Customer.OpenDocuments response. Used to join document records
 * with contact data from Customer.List.
 */
export function extractCustomerIds(data: unknown): Map<number, string> {
  const result = new Map<number, string>();
  const docArray = findDocumentArray(data);
  if (docArray === null) return result;
  for (const doc of docArray) {
    const idRaw = pickCI(doc, "customer_id", "customerId", "client_id", "clientId");
    const nameRaw = pickCI(doc, "customer_name", "customerName", "client_name", "contact_name");
    const id = Number(idRaw ?? 0);
    const name = String(nameRaw ?? "").trim();
    if (id > 0 && name) result.set(id, name);
  }
  return result;
}

/**
 * Parses a raw Customer.List response into a Map of
 * customer_id → { phone, email }.
 * Returns an empty map on any error or missing data.
 */
export function parseCustomerList(data: unknown): Map<number, ApiContactFields> {
  const result = new Map<number, ApiContactFields>();
  if (data === null || typeof data !== "object") return result;
  const rec = data as Record<string, unknown>;
  if (typeof rec["error_code"] === "number" && rec["error_code"] !== 0) return result;
  if (typeof rec["error"] === "string") return result;
  const arr = findCustomerArray(data);
  if (arr === null) return result;
  for (const customer of arr) {
    const idRaw = pickCI(customer, "customer_id", "customerId", "client_id", "clientId");
    const id = Number(idRaw ?? 0);
    if (id <= 0) continue;
    const phone = String(
      pickCI(customer, "phone", "phone_number", "phone1", "telephone") ?? "",
    ).replace(INVIS_RE, "").trim();
    const email = String(
      pickCI(customer, "email", "email_address", "e_mail", "mail") ?? "",
    ).replace(INVIS_RE, "").trim();
    result.set(id, { phone, email });
  }
  return result;
}
