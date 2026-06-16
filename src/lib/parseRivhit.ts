export interface RivhitRow {
  customerName: string;
  documentType: string;
  documentNumber: number;
  reference: string;
  documentDate: string;
  dueDate: string;
  documentTotal: number;
  paidAmount: number;
  remainingBalance: number;
}

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
  // Excel epoch offset: days since 1899-12-30 → Unix ms
  const ms = Math.round((v - 25569) * 86400 * 1000);
  return new Date(ms).toLocaleDateString("he-IL");
}

/**
 * Accepts raw rows from XLSX.utils.sheet_to_json(ws, { header: 1 }).
 * A row is a real Rivhit data row when column 7 (מס' מסמך) is a number.
 * All other rows are metadata, section headers, or subtotals.
 */
export function extractRivhitRows(rawRows: unknown[][]): RivhitRow[] {
  return rawRows
    .filter((row) => typeof row[7] === "number")
    .map((row) => ({
      customerName: asString(row[11]),
      documentType: asString(row[8]),
      documentNumber: asNumber(row[7]),
      reference: asString(row[6]),
      documentDate: excelSerialToDate(row[5]),
      dueDate: excelSerialToDate(row[4]),
      documentTotal: asNumber(row[3]),
      paidAmount: asNumber(row[1]),
      remainingBalance: asNumber(row[0]),
    }));
}
