import { CREDIT_INVOICE_TYPE } from "@/lib/parseRivhit";
import type { EnrichedRow } from "@/types/collections";
import type { DocumentStatus } from "@/types/status";

// Days before the computed Net+30 due date at which a document enters the
// "לקראת חריגה" (approaching overdue) window. Fixed for V1.
export const APPROACHING_WINDOW_DAYS = 5;

// Returns true when a document qualifies for the approaching-overdue workflow:
// not yet overdue, due within the window, and actionable by the clerk.
export function isApproachingDue(
  row: EnrichedRow,
  docStatus: DocumentStatus | undefined,
): boolean {
  if (row.documentType === CREDIT_INVOICE_TYPE) return false;
  if (row.remainingBalance <= 0) return false;
  const status = docStatus?.status;
  if (status === "שולם" || status === "במחלוקת") return false;
  return row.daysUntilDue >= 0 && row.daysUntilDue <= APPROACHING_WINDOW_DAYS;
}
